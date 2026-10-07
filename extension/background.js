importScripts("config.js"); // generated at build time: self.SCRESHOT_CONFIG

let id = 1;

const SITE_URL = (self.SCRESHOT_CONFIG && self.SCRESHOT_CONFIG.appUrl) || "https://www.screshot.com";
const FULL_PAGE_MENU_ID = "capture-full-page";
const VISIBLE_MENU_ID = "capture-visible";

// Chrome cho phép tối đa 2 lần captureVisibleTab mỗi giây.
const CAPTURE_INTERVAL_MS = 550;
// Giới hạn chiều cao canvas (pixel thật) để không vượt giới hạn bộ nhớ của Chrome.
const MAX_FULL_PAGE_HEIGHT = 30000;

// page: "screenshot.html" (editor) hoặc "fullpage.html" (chỉ xem ảnh chụp cả trang).
// meta: { title, sourceUrl } of the captured tab, used as defaults when sharing.
function openEditor(screenshotUrl, page = "screenshot.html", meta = {}) {
  const viewTabUrl = chrome.runtime.getURL(page + "?id=" + id++);
  let targetId = null;

  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === targetId && info.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.sendMessage(
        targetId,
        { action: "setScreenshotUrl", screenshotUrl: screenshotUrl, meta },
        function (response) {
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
          } else {
            console.log(response);
          }
        }
      );
    }
  });

  chrome.tabs.create({ url: viewTabUrl }, (tab) => {
    targetId = tab.id;
  });
}

function captureVisible(tab) {
  chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (screenshotUrl) => {
    if (chrome.runtime.lastError || !screenshotUrl) {
      console.log(chrome.runtime.lastError?.message);
      return;
    }
    openEditor(screenshotUrl, "screenshot.html", { title: tab.title, sourceUrl: tab.url });
  });
}

// --- Full page -------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runInTab(tabId, func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result;
}

// Chạy trong trang: ẩn thanh cuộn, ghi nhớ trạng thái để khôi phục sau,
// chặn thao tác của người dùng và hiện thanh tiến độ ở đáy màn hình.
//
// Không làm mờ toàn màn hình: Chrome chụp đúng những gì đang hiển thị, nên lớp mờ sẽ phải
// tắt/bật ở mỗi lần chụp và gây chớp. Thanh tiến độ nằm ở dải đáy; mỗi lần chỉ cuộn
// (viewport - chiều cao thanh), nên dải đáy của mỗi đoạn bị đoạn kế tiếp vẽ đè lên
// và thanh không bao giờ lọt vào ảnh. Chỉ ở đoạn cuối thanh mới trượt xuống trước khi chụp.
function pagePrepare() {
  const html = document.documentElement;
  const body = document.body;
  const state = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    overflow: html.style.overflow,
    // Trang có CSS "scroll-behavior: smooth" sẽ biến mỗi scrollTo thành một chuyển động kéo dài;
    // vị trí ghi nhận sẽ lệch với vị trí lúc chụp và các đoạn bị ghép sai. Tắt trong lúc chụp.
    scrollBehavior: [html.style.scrollBehavior, body ? body.style.scrollBehavior : ""],
    hidden: [],
    cancelled: false,
  };
  window.__screshot = state;
  html.style.overflow = "hidden";
  html.style.setProperty("scroll-behavior", "auto", "important");
  if (body) body.style.setProperty("scroll-behavior", "auto", "important");
  const height = Math.max(html.scrollHeight, document.body ? document.body.scrollHeight : 0);

  // Host trong suốt phủ cả màn hình để chặn chuột/chạm; gắn vào <html> (không phải <body>)
  // để pageHideFixed không ẩn nhầm nó. Shadow DOM tách style khỏi trang.
  const host = document.createElement("div");
  host.id = "screshot-capture-overlay";
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;cursor:wait;pointer-events:auto;";
  const root = host.attachShadow({ mode: "closed" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    .bar { position: fixed; left: 0; right: 0; bottom: 0; height: 56px; box-sizing: border-box;
      display: flex; align-items: center; gap: 12px; padding: 0 20px;
      background: #fff; color: #111827; border-top: 1px solid #e5e7eb; /* không dùng box-shadow: bóng lan ra ngoài dải bị vẽ đè và lọt vào ảnh */
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      transition: transform .22s ease-in; }
    .bar.out { transform: translateY(100%); }
    .track { position: absolute; left: 0; right: 0; top: 0; height: 3px; background: #e0e7ff; }
    .fill { height: 100%; width: 0; background: #4f46e5; transition: width .4s ease-out; }
    .spinner { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 3px solid #e0e7ff; border-top-color: #4f46e5;
      animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .title { font-weight: 600; }
    .hint { margin-left: auto; color: #6b7280; font-size: 12px; }
  `);
  root.adoptedStyleSheets = [sheet];
  root.innerHTML = `<div class="bar">
    <div class="track"><div class="fill"></div></div>
    <div class="spinner"></div>
    <div class="title">Capturing full page… <span class="pct">0%</span></div>
    <div class="hint">Press Esc to cancel</div>
  </div>`;
  html.appendChild(host);

  // Chặn cuộn và phím (trừ Esc để huỷ) ở pha capture, trước khi trang kịp xử lý.
  const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const onKey = (e) => {
    if (e.key === "Escape") state.cancelled = true;
    block(e);
  };
  const listeners = [["wheel", block], ["touchmove", block], ["keydown", onKey], ["keyup", block], ["keypress", block]];
  for (const [type, fn] of listeners) window.addEventListener(type, fn, { capture: true, passive: false });

  const bar = root.querySelector(".bar");
  state.overlay = { host, bar, pct: root.querySelector(".pct"), fill: root.querySelector(".fill"), listeners };
  return { height, viewport: window.innerHeight, width: window.innerWidth, barHeight: Math.ceil(bar.getBoundingClientRect().height) };
}

// Cuộn mượt tới y (easing) thay vì nhảy cóc, rồi đợi trình duyệt vẽ xong.
// Mỗi bước dùng behavior "instant" để CSS scroll-behavior của trang không can thiệp,
// và chỉ trả về khi vị trí cuộn đã đứng yên (vị trí trả về phải đúng với ảnh sẽ chụp).
function pageScrollTo(y) {
  const state = window.__screshot;
  const jump = (top) => window.scrollTo({ top, left: 0, behavior: "instant" });
  const from = window.scrollY;
  const distance = y - from;
  const duration = Math.min(450, Math.max(200, Math.abs(distance) * 0.4));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const settle = (resolve, last = NaN, stableFrames = 0, frames = 0) =>
    requestAnimationFrame(() => {
      const now = window.scrollY;
      const stable = now === last ? stableFrames + 1 : 0;
      if (stable >= 2 || frames > 60) resolve({ y: now, cancelled: state.cancelled });
      else settle(resolve, now, stable, frames + 1);
    });
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      jump(from + distance * ease(t));
      if (t < 1) return requestAnimationFrame(tick);
      jump(y);
      settle(resolve);
    };
    if (distance === 0) tick(start + duration);
    else requestAnimationFrame(tick);
  });
}

// Cập nhật tiến độ; visible=false cho thanh trượt xuống (chỉ dùng trước lần chụp cuối).
function pageSetOverlay(visible, progress) {
  const { overlay, cancelled } = window.__screshot;
  if (typeof progress === "number") {
    overlay.pct.textContent = `${progress}%`;
    overlay.fill.style.width = `${progress}%`;
  }
  const wasOut = overlay.bar.classList.contains("out");
  overlay.bar.classList.toggle("out", !visible);
  const wait = !visible && !wasOut ? 260 : 0; // đợi hiệu ứng trượt xong
  return new Promise((resolve) =>
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve(cancelled))), wait)
  );
}

// Sau khung đầu tiên, ẩn header/thanh dính để chúng không lặp lại ở mỗi đoạn.
function pageHideFixed() {
  const state = window.__screshot;
  for (const el of document.querySelectorAll("body *")) {
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      state.hidden.push([el, el.style.visibility]);
      el.style.visibility = "hidden";
    }
  }
}

function pageRestore() {
  const state = window.__screshot;
  if (!state) return;
  for (const [el, visibility] of state.hidden) el.style.visibility = visibility;
  if (state.overlay) {
    for (const [type, fn] of state.overlay.listeners) window.removeEventListener(type, fn, { capture: true });
    state.overlay.host.remove();
  }
  document.documentElement.style.overflow = state.overflow;
  // Về lại vị trí cũ ngay lập tức, rồi mới trả lại scroll-behavior gốc của trang.
  window.scrollTo({ top: state.scrollY, left: state.scrollX, behavior: "instant" });
  document.documentElement.style.scrollBehavior = state.scrollBehavior[0];
  if (document.body) document.body.style.scrollBehavior = state.scrollBehavior[1];
  delete window.__screshot;
}

function captureTab(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (url) => {
      if (chrome.runtime.lastError || !url) reject(new Error(chrome.runtime.lastError?.message || "capture failed"));
      else resolve(url);
    });
  });
}

async function toBitmap(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function captureFullPage(tab) {
  let info;
  try {
    info = await runInTab(tab.id, pagePrepare);
  } catch (e) {
    // Trang không cho chạy script (chrome://, Web Store...): chụp phần đang thấy như cũ.
    console.log(e.message);
    captureVisible(tab);
    return;
  }

  chrome.action.setBadgeText({ tabId: tab.id, text: "…" });
  try {
    const frames = [];
    const maxScroll = Math.max(0, info.height - info.viewport);
    // Chồng lên nhau đúng bằng chiều cao thanh tiến độ để dải có thanh luôn bị đoạn sau vẽ đè.
    const step = Math.max(1, info.viewport - info.barHeight);
    const totalFrames = Math.ceil(maxScroll / step) + 1;
    let lastCaptureAt = 0;
    for (let y = 0; ; y += step) {
      const { y: actualY, cancelled } = await runInTab(tab.id, pageScrollTo, [Math.min(y, maxScroll)]);
      if (cancelled) throw new Error("cancelled by user");
      if (frames.length === 1) await runInTab(tab.id, pageHideFixed);
      const isLast = actualY >= maxScroll || y >= maxScroll;
      // Đoạn cuối không có đoạn nào vẽ đè lên, nên cho thanh trượt khỏi màn hình trước khi chụp.
      if (isLast) await runInTab(tab.id, pageSetOverlay, [false, 100]);
      await sleep(Math.max(0, CAPTURE_INTERVAL_MS - (Date.now() - lastCaptureAt)));
      const shot = await captureTab(tab.windowId);
      lastCaptureAt = Date.now();
      frames.push({ y: actualY, bitmap: await toBitmap(shot) });
      if (isLast) break;
      const progress = Math.min(99, Math.round((frames.length / totalFrames) * 100));
      await runInTab(tab.id, pageSetOverlay, [true, progress]);
    }

    const scale = frames[0].bitmap.width / info.width;
    const lastFrame = frames[frames.length - 1];
    const fullHeight = Math.round(lastFrame.y * scale) + lastFrame.bitmap.height;
    const height = Math.min(fullHeight, MAX_FULL_PAGE_HEIGHT);
    const canvas = new OffscreenCanvas(frames[0].bitmap.width, height);
    const ctx = canvas.getContext("2d");
    for (const frame of frames) {
      ctx.drawImage(frame.bitmap, 0, Math.round(frame.y * scale));
      frame.bitmap.close();
    }

    let blob = await canvas.convertToBlob({ type: "image/png" });
    // Ảnh PNG quá lớn có thể vượt giới hạn tin nhắn giữa các tab.
    if (blob.size > 40 * 1024 * 1024) {
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    }
    openEditor(await blobToDataUrl(blob), "fullpage.html", { title: tab.title, sourceUrl: tab.url });
  } catch (e) {
    console.log(e.message);
  } finally {
    chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    runInTab(tab.id, pageRestore).catch(() => {});
  }
}

// --- Entry points ------------------------------------------------------------

chrome.action.onClicked.addListener(captureVisible);

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "capture_full_page" && tab) captureFullPage(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;
  if (info.menuItemId === FULL_PAGE_MENU_ID) captureFullPage(tab);
  if (info.menuItemId === VISIBLE_MENU_ID) captureVisible(tab);
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  // Menu chuột phải trên icon extension.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: VISIBLE_MENU_ID, title: "Capture visible area", contexts: ["action"] });
    chrome.contextMenus.create({ id: FULL_PAGE_MENU_ID, title: "Capture full page", contexts: ["action"] });
  });

  // Welcome page on first install only; updates stay silent. Skip it when IT force-installs
  // the extension by policy, so employees don't get an unexpected tab.
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.management.getSelf((self) => {
      if (self.installType !== "admin") chrome.tabs.create({ url: `${SITE_URL}/welcome` });
    });
  }
});

// Ask why when someone uninstalls. The version helps tie answers to a release.
chrome.runtime.setUninstallURL(
  `${SITE_URL}/uninstall?v=${chrome.runtime.getManifest().version}`
);

// --- Upload & Share: account connection and tokens ---------------------------------
// The background service worker is the only place that holds tokens. Editor and viewer pages
// ask it for an access token; refreshes are serialized because refresh tokens rotate.

const AUTH_KEY = "screshotAuth";
const PENDING_KEY = "screshotConnectState";

function deviceName() {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : "Chrome";
  return `${browser}${os ? " on " + os : ""}`;
}

async function saveTokens(tokens) {
  await chrome.storage.local.set({
    [AUTH_KEY]: {
      accessToken: tokens.access_token,
      accessExp: Date.now() + (tokens.expires_in - 60) * 1000, // refresh a minute early
      refreshToken: tokens.refresh_token,
    },
  });
}

let refreshing = null;

async function getAccessToken() {
  const { [AUTH_KEY]: auth } = await chrome.storage.local.get(AUTH_KEY);
  if (!auth) return null;
  if (auth.accessExp > Date.now()) return auth.accessToken;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${SITE_URL}/api/v1/auth/extension/refresh`, {
        method: "POST",
        credentials: "omit", // Bearer/body auth only: never send the website cookies
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: auth.refreshToken }),
      });
      if (res.status === 401) {
        await chrome.storage.local.remove(AUTH_KEY); // revoked from the dashboard, or expired
        return null;
      }
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
      const tokens = await res.json();
      await saveTokens(tokens);
      return tokens.access_token;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function startConnect() {
  const state = crypto.randomUUID().replace(/-/g, "");
  await chrome.storage.local.set({ [PENDING_KEY]: { state, at: Date.now() } });
  const url = `${SITE_URL}/extension/connect?ext=${chrome.runtime.id}&state=${state}`;
  const tab = await chrome.tabs.create({ url });
  return tab.id;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "screshot:token") {
    getAccessToken().then(
      (token) => sendResponse({ token, appUrl: SITE_URL }),
      () => sendResponse({ token: null, appUrl: SITE_URL, error: "network" })
    );
    return true;
  }
  if (msg?.type === "screshot:connect-start") {
    startConnect().then((tabId) => sendResponse({ ok: true, tabId }));
    return true;
  }
  if (msg?.type === "screshot:signout") {
    chrome.storage.local.remove(AUTH_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

// The connect page on screshot.com hands over a one-time code (externally_connectable).
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "screshot:connect") return false;
  (async () => {
    if (sender.origin !== SITE_URL) return { ok: false, error: "origin" };
    const { [PENDING_KEY]: pending } = await chrome.storage.local.get(PENDING_KEY);
    if (!pending || pending.state !== msg.state || Date.now() - pending.at > 10 * 60 * 1000) return { ok: false, error: "state" };
    await chrome.storage.local.remove(PENDING_KEY);
    const res = await fetch(`${SITE_URL}/api/v1/auth/extension/token`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: msg.code, device_name: deviceName() }),
    });
    if (!res.ok) return { ok: false, error: "exchange" };
    await saveTokens(await res.json());
    // Wake up the Share panel that is waiting for the connection.
    chrome.runtime.sendMessage({ type: "screshot:connected" }).catch(() => {});
    if (sender.tab?.id) setTimeout(() => chrome.tabs.remove(sender.tab.id).catch(() => {}), 1500);
    return { ok: true };
  })().then(sendResponse, () => sendResponse({ ok: false, error: "network" }));
  return true;
});
