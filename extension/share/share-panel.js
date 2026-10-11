// Share panel (T14, T15): upload the current screenshot and share it by link.
// Used by the editor (screenshot.html) and the full-page viewer (fullpage.html).
// Tokens live in the background service worker; this page asks it for an access token per call.
//
// End-to-end encrypted (e2ee.js, the same file as the website's src/shared/e2ee.js): the image and
// a thumbnail are encrypted here with a new content key before upload, and the key is wrapped for
// the owner. Screshot only ever receives ciphertext. Who can view is then just who gets the key:
// invitees get it wrapped for them, and a public link carries it after the #.
//
// UI: a Fluent popover anchored under the Share button (ui/fluent.css), with toasts from
// ui/ui.js, and a busy state on every control that waits for the API.
(() => {
  const MODES = [
    { id: "private", icon: "lock", title: "Only me", body: "Nobody else can open the link." },
    { id: "shared", icon: "people", title: "Invited people", body: "They sign in with the invited email." },
    { id: "public", icon: "globe", title: "Anyone with the link", body: "No sign-in. The key is in the link, after the #." },
  ];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const UI = window.ScreshotUI;
  const esc = UI.esc;
  const icon = UI.icon;
  const spin = () => UI.spinner();

  // Layout of the popover only; components (buttons, inputs, choices, progress) come from fluent.css.
  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .panel { position: fixed; z-index: 2147483000; width: 360px; max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px); overflow: auto; opacity: 0; transform: translateY(-4px);
      transition: opacity .15s var(--sf-ease), transform .15s var(--sf-ease); }
    .panel.in { opacity: 1; transform: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 12px 12px 4px 16px; }
    header h2 { flex: 1; margin: 0; font: 600 16px/22px var(--sf-font); color: var(--sf-fg1); }
    header .e2ee { display: inline-flex; align-items: center; gap: 4px; color: var(--sf-success); font: 600 12px/16px var(--sf-font); }
    header .e2ee svg { width: 14px; height: 14px; }
    .body { padding: 8px 16px 16px; color: var(--sf-fg2); }
    p { margin: 0 0 12px; }
    .muted { color: var(--sf-fg3); font-size: 12px; line-height: 16px; }
    .row { display: flex; gap: 8px; align-items: center; }
    .stack > * + * { margin-top: 12px; }
    .link { display: flex; gap: 8px; }
    .section-label { margin: 16px 0 6px; color: var(--sf-fg1); font: 600 14px/20px var(--sf-font); }
    .choice-icon { flex: none; width: 20px; height: 20px; color: var(--sf-fg2); }
    .choice-icon svg { width: 20px; height: 20px; }
    .sf-choice input:checked + .sf-choice-body .choice-icon { color: var(--sf-brand); }
    .choice-main { flex: 1; min-width: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid var(--sf-stroke1);
      border-bottom-color: var(--sf-stroke-accessible); border-radius: var(--sf-radius-m); background: #fff; }
    .chips:focus-within { border-bottom-color: var(--sf-brand); box-shadow: inset 0 -1px 0 var(--sf-brand); }
    .chip { display: inline-flex; align-items: center; gap: 2px; height: 24px; padding: 0 2px 0 8px; border-radius: var(--sf-radius-m);
      background: var(--sf-bg3); color: var(--sf-fg1); font: 12px/16px var(--sf-font); }
    .chip button { width: 20px; height: 20px; border: 0; border-radius: var(--sf-radius-m); background: none; color: var(--sf-fg3); cursor: pointer; display: grid; place-items: center; }
    .chip button:hover { background: var(--sf-bg-pressed); color: var(--sf-fg1); }
    .chip svg { width: 12px; height: 12px; }
    .chips input { flex: 1; min-width: 140px; height: 24px; border: 0; outline: 0; font: 14px/20px var(--sf-font); color: var(--sf-fg1); background: transparent; }
    ul { list-style: none; padding: 0; margin: 8px 0 0; border: 1px solid var(--sf-stroke2); border-radius: var(--sf-radius-m); }
    li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 6px 6px 10px; border-top: 1px solid var(--sf-stroke2); font-size: 13px; color: var(--sf-fg1); }
    li:first-child { border-top: 0; }
    li .who { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .progress-label { display: flex; justify-content: space-between; margin-top: 8px; }
    .footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 16px -16px -16px; padding: 10px 16px;
      border-top: 1px solid var(--sf-stroke2); background: var(--sf-bg2); border-radius: 0 0 var(--sf-radius-l) var(--sf-radius-l); font-size: 12px; }
    .footer .sf-link { flex: none; white-space: nowrap; font-size: 12px; }
    .footer .acct { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sf-fg3); }
    .footer b { color: var(--sf-fg1); font-weight: 600; }
    .google svg { width: 18px; height: 18px; }
    .steps { margin: 0 0 12px; padding: 0; border: 0; }
    .steps li { border: 0; padding: 2px 0; color: var(--sf-fg2); justify-content: flex-start; gap: 8px; }
    .steps li svg { width: 16px; height: 16px; color: var(--sf-success); }
  `;

  const GOOGLE_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

  const send = (msg) => chrome.runtime.sendMessage(msg);

  class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = "GET", body, headers = {} } = {}) {
    const { token, appUrl } = await send({ type: "screshot:token" });
    if (!token) throw new ApiError(401, "unauthorized", "Sign in to share.");
    let res;
    try {
      res = await fetch(`${appUrl}/api/v1${path}`, {
        method,
        credentials: "omit", // Bearer auth only: never send the website cookies
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, "offline", "You seem to be offline. Check your connection and try again.");
    }
    const data = res.status === 204 ? null : await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data?.code ?? "error", data?.detail ?? data?.title ?? "Something went wrong.");
    return data;
  }

  /**
   * Encrypt the screenshot for upload: a thumbnail made here (the server can't), both encrypted with
   * a new content key, and the key wrapped for the owner's public key.
   */
  async function encryptForUpload(blob, ownerPublicKey) {
    const E = self.ScreshotE2EE;
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    // Thumbnail: 480 px wide, the top of the page (at most 1200 px tall), as the dashboard shows it.
    const tw = Math.min(480, width);
    const scale = tw / width;
    const th = Math.max(1, Math.min(Math.round(height * scale), 1200));
    const canvas = new OffscreenCanvas(tw, th);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, th / scale, 0, 0, tw, th);
    bitmap.close();
    const thumb = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    const ck = E.generateContentKey();
    return {
      ck,
      width,
      height,
      original: await E.encryptBlob(ck, new Uint8Array(await blob.arrayBuffer())),
      thumb: await E.encryptBlob(ck, new Uint8Array(await thumb.arrayBuffer())),
      envelope: await E.wrapForRecipient(ck, ownerPublicKey),
    };
  }

  // PUT with progress (fetch has no upload progress).
  function putWithProgress(url, blob, contentType, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "upload_failed", "Upload failed. Try again.")));
      xhr.onerror = () => reject(new ApiError(0, "offline", "Upload interrupted. Check your connection and try again."));
      xhr.send(blob);
    });
  }

  async function copyText(text, title) {
    try {
      await navigator.clipboard.writeText(text);
      UI.toast({ intent: "success", title });
      return true;
    } catch {
      UI.toast({ intent: "error", title: "Couldn't copy the link", body: "Select the link and copy it by hand." });
      return false;
    }
  }

  class SharePanel {
    constructor({ getBlob, title, sourceUrl, anchor }) {
      this.getBlob = getBlob;
      this.title = (title || "").slice(0, 200);
      this.sourceUrl = sourceUrl || null;
      this.anchor = anchor || null;
      this.shot = null;
      this.chips = [];
      /** The control waiting on the API, e.g. "visibility:public", "invite", "revoke:<id>". */
      this.busy = null;
      UI.ensureStyles();
      this.host = document.createElement("div");
      this.host.id = "screshot-share";
      this.root = this.host.attachShadow({ mode: "open" });
      document.body.appendChild(this.host);

      // Signed in from the website in another tab: carry on. Signed out elsewhere: ask again.
      this.onConnected = (msg) => {
        if (msg?.type === "screshot:connected" && !this.shot) this.upload();
        if (msg?.type === "screshot:signed-out" && !this.uploading) this.renderConnect();
      };
      chrome.runtime.onMessage.addListener(this.onConnected);
      // Keys typed in the panel must not reach the editor (its shortcuts, or Esc closing the tab).
      this.host.addEventListener("keydown", (e) => e.stopPropagation());
      this.onKey = (e) => {
        if (e.key !== "Escape") return;
        e.stopImmediatePropagation();
        e.preventDefault();
        this.close();
      };
      document.addEventListener("keydown", this.onKey, true);
      // T16: an upload interrupted by the network resumes by itself.
      this.onOnline = () => this.waiting && this.upload();
      window.addEventListener("online", this.onOnline);
      this.onBeforeUnload = (e) => {
        if (!this.pending || this.shot) return;
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", this.onBeforeUnload);
      // Stay attached to the Share button (the editor's toolbar can be dragged).
      this.onReposition = () => this.position();
      window.addEventListener("resize", this.onReposition);
      window.addEventListener("scroll", this.onReposition, true);
      this.follow = setInterval(this.onReposition, 250);
    }

    close() {
      chrome.runtime.onMessage.removeListener(this.onConnected);
      document.removeEventListener("keydown", this.onKey, true);
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("beforeunload", this.onBeforeUnload);
      window.removeEventListener("resize", this.onReposition);
      window.removeEventListener("scroll", this.onReposition, true);
      if (this.onFocus) window.removeEventListener("focus", this.onFocus);
      clearInterval(this.follow);
      clearTimeout(this.retryTimer);
      this.setAnchorBusy(false);
      this.host.remove();
      SharePanel.current = null;
      this.anchor?.focus?.();
    }

    /** Below the Share button, right edges aligned; above it when there's no room; always on screen. */
    position() {
      const panel = this.root.querySelector(".panel");
      if (!panel) return;
      const gap = 8;
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const a = this.anchor?.isConnected ? this.anchor.getBoundingClientRect() : null;
      let left = a ? a.right - w : window.innerWidth - w - 16;
      let top = a ? a.bottom + gap : 16;
      if (a && top + h > window.innerHeight - gap && a.top - gap - h > gap) top = a.top - gap - h;
      left = Math.max(gap, Math.min(left, window.innerWidth - w - gap));
      top = Math.max(gap, Math.min(top, window.innerHeight - h - gap));
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
    }

    /**
     * The shell (stylesheet, header) is built once; every later render only swaps the body.
     * Rebuilding the <link> each time made the panel flash unstyled and jump on every API call.
     */
    render(inner) {
      let panel = this.root.querySelector(".panel");
      if (!panel) {
        this.root.innerHTML = `<link rel="stylesheet" href="${chrome.runtime.getURL("ui/fluent.css")}"><style>${css}</style>
          <section class="panel sf-surface" role="dialog" aria-label="Share screenshot">
            <header>
              <h2>Share screenshot</h2>
              <span class="e2ee" title="Encrypted on this device before upload. Screshot can't see it.">${icon("shield")}End-to-end encrypted</span>
              <button class="sf-btn subtle icon" data-act="close" aria-label="Close">${icon("dismiss")}</button>
            </header>
            <div class="body"></div>
          </section>`;
        panel = this.root.querySelector(".panel");
        this.root.querySelector('[data-act="close"]').onclick = () => this.close();
        // Shown once its stylesheet is in, so it never appears unstyled.
        const show = () => requestAnimationFrame(() => panel.classList.add("in"));
        const link = this.root.querySelector("link");
        link.addEventListener("load", show, { once: true });
        link.addEventListener("error", show, { once: true });
      }
      panel.querySelector(".body").innerHTML = inner;
      this.position();
    }

    /** The Share button that opened the panel is disabled while encrypting and uploading. */
    setAnchorBusy(busy) {
      const a = this.anchor;
      if (!a) return;
      a.classList.toggle("is-busy", busy);
      if (busy) a.setAttribute("aria-disabled", "true");
      else a.removeAttribute("aria-disabled");
      if ("disabled" in a) a.disabled = busy;
    }

    errorBox(message) {
      return message ? `<div class="sf-message error" role="alert">${icon("error")}<span>${esc(message)}</span></div>` : "";
    }

    async start() {
      this.render(`<div class="row" aria-busy="true">${spin()}<span>Checking your account…</span></div>`);
      const { token } = await send({ type: "screshot:token" });
      if (token) return this.upload();
      this.renderConnect();
    }

    /** Google sign-in right here (no trip to the website). Also signs in screshot.com in this browser. */
    renderConnect(error) {
      this.render(`<div class="stack">
        ${this.errorBox(error)}
        <p>Sign in to share this screenshot by link. Only screenshots you share are uploaded, encrypted; everything else stays on your computer.</p>
        <button class="sf-btn block google" data-act="google">${GOOGLE_ICON}Sign in with Google</button>
        <p class="muted">New to Screshot? This creates your account. You&#39;ll be signed in on screshot.com in this browser too.</p>
      </div>`);
      const btn = this.root.querySelector('[data-act="google"]');
      btn.onclick = async () => {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.innerHTML = `${spin()} Waiting for Google…`;
        const res = await send({ type: "screshot:google-signin" }).catch(() => ({ ok: false, error: "network" }));
        if (res?.ok) return this.upload();
        if (res?.error === "cancelled") return this.renderConnect();
        this.renderConnect(
          res?.error === "unavailable"
            ? "Sign-in isn't available right now. Try again later."
            : res?.error === "network"
              ? "You seem to be offline. Check your connection and try again."
              : "Google sign-in didn't complete. Try again."
        );
      };
    }

    renderProgress(step, fraction, detail) {
      const steps = ["Encrypting on your device", "Uploading", "Finishing"];
      const at = steps.indexOf(step);
      this.render(`
        <ul class="steps" aria-label="Progress">${steps
          .map((s, i) => `<li>${i < at ? icon("success") : i === at ? spin() : `<span style="width:16px"></span>`}<span${i === at ? ' style="color:var(--sf-fg1);font-weight:600"' : ""}>${s}</span></li>`)
          .join("")}</ul>
        <div class="sf-progress ${fraction == null ? "indeterminate" : ""}"><div style="width:${fraction == null ? "" : Math.round(fraction * 100) + "%"}"></div></div>
        <div class="progress-label muted" aria-live="polite"><span>${esc(detail || "")}</span><span>${fraction == null ? "" : Math.round(fraction * 100) + "%"}</span></div>`);
    }

    /**
     * Resumable upload (T16): encrypt → create → PUT the files → complete. Progress is kept in
     * this.pending, so a retry continues where the network dropped instead of starting over, and the
     * Idempotency-Key means a create that did reach the server is never repeated as a second screenshot.
     */
    async upload() {
      if (this.uploading) return;
      this.uploading = true;
      this.setAnchorBusy(true);
      this.waiting = false;
      clearTimeout(this.retryTimer);
      try {
        this.renderProgress("Encrypting on your device", null, "Your screenshot never leaves this device unencrypted");
        this.blob ??= await this.getBlob();
        const blob = this.blob;
        // Encrypted once per screenshot: a retry re-sends the same ciphertext (same sizes, same key).
        this.pending ??= { key: crypto.randomUUID(), enc: null, created: null, uploaded: false, thumbUploaded: false };
        const p = this.pending;
        if (!p.enc) {
          const keys = await api("/me/keys");
          if (!keys.public_key) throw new ApiError(409, "keys_required", "Turn on end-to-end encryption to share.");
          p.enc = await encryptForUpload(blob, keys.public_key);
        }
        if (!p.created) {
          p.created = await api("/screenshots", {
            method: "POST",
            headers: { "Idempotency-Key": p.key },
            body: {
              mime: blob.type || "image/png",
              size_bytes: p.enc.original.length,
              thumb_size_bytes: p.enc.thumb.length,
              encryption: "e2ee-v1",
              envelope: p.enc.envelope,
              title: this.title || null,
              source_url: this.sourceUrl,
            },
          });
        }
        try {
          const total = p.enc.original.length;
          const mb = (total / 1024 / 1024).toFixed(1);
          if (!p.uploaded) {
            this.renderProgress("Uploading", 0, `${mb} MB, encrypted`);
            let last = 0;
            await putWithProgress(p.created.upload.url, p.enc.original, p.created.upload.headers["Content-Type"], (x) => {
              if (x - last < 0.02 && x < 1) return; // don't re-render on every byte
              last = x;
              this.renderProgress("Uploading", x * 0.95, `${mb} MB, encrypted`);
            });
            p.uploaded = true;
          }
          if (!p.thumbUploaded) {
            await putWithProgress(p.created.thumb_upload.url, p.enc.thumb, p.created.thumb_upload.headers["Content-Type"], () => {});
            p.thumbUploaded = true;
          }
        } catch (err) {
          // The signed upload URLs expired while we were offline: start a fresh upload (new key too).
          if (err.status === 403) this.pending = null;
          throw err;
        }
        this.renderProgress("Finishing", 0.98, "Almost there");
        this.shot = await api(`/screenshots/${p.created.screenshot.id}/complete`, { method: "POST", body: { width: p.enc.width, height: p.enc.height } });
        this.ck = p.enc.ck;
        this.pending = null;
        this.attempts = 0;
        const [me] = await Promise.all([api("/me").catch(() => null), this.loadShares()]);
        this.account = (await send({ type: "screshot:account" }).catch(() => null))?.account ?? null;
        if (me?.preferences?.auto_copy_link !== false) await copyText(this.linkFor(this.shot), "Uploaded, link copied");
        else UI.toast({ intent: "success", title: "Uploaded and encrypted" });
        this.renderDone();
      } catch (err) {
        // Expired upload URL (pending was reset above): one immediate fresh attempt, then normal errors.
        if (err.status === 403 && this.pending === null && !this.retriedExpired) {
          this.retriedExpired = true;
          this.uploading = false;
          return this.upload();
        }
        this.renderError(err);
      } finally {
        this.uploading = false;
        this.setAnchorBusy(false);
      }
    }

    /** The link to give out. Public links carry the content key after the # (browsers never send it). */
    linkFor(shot) {
      return shot.visibility === "public" && this.ck ? `${shot.url}#${self.ScreshotE2EE.contentKeyToFragment(this.ck)}` : shot.url;
    }

    /** One-time: encryption keys are created on the website (passkey + recovery code). */
    async renderSetupKeys() {
      const { appUrl } = await send({ type: "screshot:token" });
      this.render(`<div class="stack">
        <div class="sf-message">${icon("shield")}<span><b>Turn on end-to-end encryption</b><br>Before your first share, set up the key that keeps your screenshots private. Screshot only ever receives encrypted files.</span></div>
        <p class="muted">It takes a minute on screshot.com: a passkey (fingerprint, face or PIN) and a recovery code.</p>
        <div class="row"><button class="sf-btn primary" data-act="setup">Set up encryption</button><button class="sf-btn" data-act="again">I&#39;ve done it</button></div>
      </div>`);
      this.root.querySelector('[data-act="setup"]').onclick = () => window.open(`${appUrl}/settings#encryption`, "_blank");
      this.root.querySelector('[data-act="again"]').onclick = () => this.upload();
      // Coming back from the setup tab: try again by itself.
      this.onFocus ??= () => this.awaitingKeys && !this.uploading && this.upload();
      window.addEventListener("focus", this.onFocus);
      this.awaitingKeys = true;
    }

    renderError(err) {
      if (err.code === "keys_required") return this.renderSetupKeys();
      this.awaitingKeys = false;
      if (err.status === 401) return this.renderConnect("Your session ended. Sign in again to share.");
      if (err.code === "offline") return this.renderWaiting();
      const extra =
        err.code === "quota_exceeded"
          ? `<button class="sf-btn" data-act="dash">Free up space in the dashboard</button>`
          : `<button class="sf-btn primary" data-act="again">Try again</button>`;
      this.render(`<div class="stack">${this.errorBox(err.message)}<div class="row">${extra}</div></div>`);
      const again = this.root.querySelector('[data-act="again"]');
      if (again) again.onclick = () => this.upload();
      const dash = this.root.querySelector('[data-act="dash"]');
      if (dash)
        dash.onclick = async () => {
          const { appUrl } = await send({ type: "screshot:token" });
          window.open(`${appUrl}/dashboard`, "_blank");
        };
    }

    /** Offline: wait for the connection, retry on "online" and on a backoff (5s, 15s, 30s, then every 60s). */
    renderWaiting() {
      this.waiting = true;
      this.attempts = (this.attempts ?? 0) + 1;
      const delay = [5, 15, 30][this.attempts - 1] ?? 60;
      this.render(`<div class="stack">
        <div class="sf-message">${icon("warning")}<span><b>You&#39;re offline.</b> Your screenshot will upload as soon as the connection is back.</span></div>
        <p class="muted" aria-live="polite">Trying again in ${delay} seconds. Keep this tab open.</p>
        <button class="sf-btn" data-act="again">Try now</button>
      </div>`);
      this.root.querySelector('[data-act="again"]').onclick = () => this.upload();
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.upload(), delay * 1000);
    }

    /** Wrap the content key for invitees who already have encryption keys. Others get it later, automatically. */
    async grantKeys(id, shares) {
      const pending = (shares || []).filter((x) => x.key === "pending" && x.user_id && x.public_key);
      if (!pending.length || !this.ck) return shares;
      const keys = await Promise.all(pending.map(async (x) => ({ user_id: x.user_id, envelope: await self.ScreshotE2EE.wrapForRecipient(this.ck, x.public_key) })));
      await api(`/screenshots/${id}/keys`, { method: "POST", body: { keys } });
      return (await api(`/screenshots/${id}`)).shares;
    }

    async loadShares() {
      this.shot = await api(`/screenshots/${this.shot.id}`);
    }

    /** Run an API action with `key` marked busy: its control shows a spinner, every control is disabled. */
    async act(key, fn) {
      if (this.busy) return;
      this.busy = key;
      this.renderDone();
      let error = null;
      try {
        await fn();
      } catch (err) {
        error = err.message;
      } finally {
        this.busy = null;
        this.renderDone(error);
      }
    }

    renderDone(error) {
      const s = this.shot;
      const busy = this.busy;
      const dis = busy ? "disabled" : "";
      const mark = (key, label) => (busy === key ? `${spin()} ${label}` : label);
      const invitees = s.shares || [];
      this.render(`
        ${this.errorBox(error)}
        <label class="sf-label" for="link">Link</label>
        <div class="link">
          <input id="link" class="sf-input" readonly value="${esc(this.linkFor(s))}" aria-label="Link">
          <button class="sf-btn primary" data-act="copy" ${dis}>${icon("copy")}Copy</button>
        </div>
        <div class="section-label" id="who">Who can view</div>
        <div role="radiogroup" aria-labelledby="who">
          ${MODES.map(
            (m) => `<label class="sf-choice" ${busy === `visibility:${m.id}` ? 'aria-busy="true"' : ""}>
              <input type="radio" name="v" value="${m.id}" ${s.visibility === m.id ? "checked" : ""} ${dis}>
              <span class="sf-choice-body">
                <span class="choice-icon">${icon(m.icon)}</span>
                <span class="choice-main"><span class="sf-choice-title">${m.title}</span><span class="sf-choice-text">${m.body}</span></span>
                ${busy === `visibility:${m.id}` ? spin() : `<span class="sf-choice-dot"></span>`}
              </span>
            </label>`
          ).join("")}
        </div>
        ${
          s.visibility === "shared"
            ? `<div class="section-label"><label for="emails">Invite by email</label></div>
               <div class="chips">${this.chips
                 .map((c) => `<span class="chip">${esc(c)}<button data-rm="${esc(c)}" aria-label="Remove ${esc(c)}" ${dis}>${icon("dismiss")}</button></span>`)
                 .join("")}<input id="emails" placeholder="${this.chips.length ? "" : "name@company.com"}" ${dis}></div>
               <div class="row" style="margin-top:8px"><button class="sf-btn primary" data-act="invite" ${dis} ${busy === "invite" ? 'aria-busy="true"' : ""}>${mark("invite", "Send invite")}</button></div>
               ${
                 invitees.length
                   ? `<ul aria-label="People with access">${invitees
                       .map(
                         (x) => `<li><span class="who">${esc(x.email)}${
                           x.key === "waiting" ? ` <span class="muted" title="They get the key once they turn on encryption">· waiting for them to turn on encryption</span>` : ""
                         }</span><button class="sf-btn subtle small" data-revoke="${x.id}" aria-label="Remove ${esc(x.email)}" ${dis}>${busy === `revoke:${x.id}` ? spin() : "Remove"}</button></li>`
                       )
                       .join("")}</ul>`
                   : ""
               }`
            : ""
        }
        <div class="footer">
          <button class="sf-link" data-act="dash">Open in dashboard</button>
          <span class="row" style="min-width:0">
            <span class="acct">Signed in as <b>${esc(this.account?.email || "your account")}</b></span>
            <button class="sf-btn subtle small" data-act="signout" ${dis}>${mark("signout", "Sign out")}</button>
          </span>
        </div>`);

      const $ = (sel) => this.root.querySelector(sel);
      $('[data-act="copy"]').onclick = () => copyText(this.linkFor(this.shot), "Link copied");
      $('[data-act="dash"]').onclick = () => window.open(s.url.replace(/\/s\/.*$/, `/dashboard?open=${s.id}`), "_blank");
      $('[data-act="signout"]').onclick = async () => {
        if (this.busy) return;
        this.busy = "signout";
        this.renderDone();
        await send({ type: "screshot:signout" }).catch(() => {});
        this.busy = null;
        this.shot = null;
        UI.toast({ intent: "info", title: "Signed out", body: "Also signed out of screshot.com in this browser." });
        this.renderConnect();
      };
      this.root.querySelectorAll('input[name="v"]').forEach((r) => {
        r.onchange = () =>
          this.act(`visibility:${r.value}`, async () => {
            this.shot = { ...(await api(`/screenshots/${s.id}`, { method: "PATCH", body: { visibility: r.value } })), shares: s.shares };
            UI.toast({ intent: "success", title: `Now: ${MODES.find((m) => m.id === r.value).title}` });
          });
      });
      const input = $("#emails");
      if (!input) return;
      const commit = () => {
        const parts = input.value.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
        const good = parts.filter((p) => EMAIL.test(p));
        if (good.length) {
          this.chips = [...new Set([...this.chips, ...good])];
          const rest = parts.filter((p) => !EMAIL.test(p)).join(" ");
          this.renderDone();
          const next = this.root.querySelector("#emails");
          next.value = rest;
          next.focus();
        }
      };
      input.onkeydown = (e) => {
        if (["Enter", ",", " ", "Tab"].includes(e.key) && input.value.trim()) {
          e.preventDefault();
          commit();
        } else if (e.key === "Backspace" && !input.value && this.chips.length) {
          this.chips.pop();
          this.renderDone();
          this.root.querySelector("#emails").focus();
        }
      };
      input.onpaste = (e) => {
        e.preventDefault();
        input.value += e.clipboardData.getData("text");
        commit();
      };
      this.root.querySelectorAll("[data-rm]").forEach(
        (b) =>
          (b.onclick = () => {
            this.chips = this.chips.filter((c) => c !== b.dataset.rm);
            this.renderDone();
          })
      );
      $('[data-act="invite"]').onclick = () => {
        const typed = EMAIL.test(input.value.trim()) ? [input.value.trim().toLowerCase()] : [];
        const emails = [...this.chips, ...typed];
        if (!emails.length) return;
        this.act("invite", async () => {
          const res = await api(`/screenshots/${s.id}/shares`, { method: "POST", body: { emails } });
          this.chips = [];
          this.shot = { ...this.shot, shares: await this.grantKeys(s.id, res.shares) };
          UI.toast({ intent: "success", title: emails.length === 1 ? `Invited ${emails[0]}` : `Invited ${emails.length} people` });
        });
      };
      this.root.querySelectorAll("[data-revoke]").forEach(
        (b) =>
          (b.onclick = () =>
            this.act(`revoke:${b.dataset.revoke}`, async () => {
              const res = await api(`/screenshots/${s.id}/shares/${b.dataset.revoke}`, { method: "DELETE" });
              this.shot = { ...this.shot, shares: res.shares };
              UI.toast({ intent: "success", title: "Access removed" });
            }))
      );
    }
  }

  // Public entry point: one panel at a time. `anchor`: the Share button it opens from.
  window.ScreshotShare = {
    open(opts) {
      if (SharePanel.current) return SharePanel.current;
      SharePanel.current = new SharePanel(opts);
      SharePanel.current.start();
      return SharePanel.current;
    },
  };
})();
