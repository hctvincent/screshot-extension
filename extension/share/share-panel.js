// Share panel (T14, T15): upload the current screenshot and share it by link.
// Used by the editor (screenshot.html) and the full-page viewer (fullpage.html).
// Tokens live in the background service worker; this page asks it for an access token per call.
(() => {
  const MODES = [
    { id: "private", title: "Only me", body: "Nobody else can open the link." },
    { id: "shared", title: "Invited people", body: "They sign in with the invited email." },
    { id: "public", title: "Anyone with the link", body: "No sign-in. Preview in Slack and Jira." },
  ];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .panel { position: fixed; top: 16px; right: 16px; width: 360px; max-height: calc(100vh - 32px); overflow: auto; z-index: 2147483000;
      background: #fff; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 16px 40px rgba(15,23,42,.18); }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; }
    h2 { margin: 0; font-size: 15px; font-weight: 700; }
    .x { border: 0; background: transparent; width: 28px; height: 28px; border-radius: 6px; color: #64748b; cursor: pointer; font-size: 16px; }
    .x:hover { background: #f1f5f9; color: #0f172a; }
    .body { padding: 16px; font-size: 14px; line-height: 1.5; }
    p { margin: 0 0 12px; color: #475569; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 14px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .primary { background: #1f57d6; color: #fff; } .primary:hover { background: #1a46b0; }
    .outline { background: #fff; color: #0f172a; border-color: #cbd5e1; } .outline:hover { background: #f8fafc; }
    .btn[disabled] { opacity: .55; cursor: default; }
    .block { width: 100%; }
    .bar { height: 6px; border-radius: 999px; background: #e2e8f0; overflow: hidden; margin: 8px 0 4px; }
    .fill { height: 100%; width: 0; background: #1f57d6; transition: width .2s; }
    .muted { color: #64748b; font-size: 12px; }
    .link { display: flex; gap: 8px; margin-bottom: 16px; }
    .link input { flex: 1; min-width: 0; height: 36px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 10px; font-size: 13px; color: #334155; background: #f8fafc; }
    fieldset { border: 0; padding: 0; margin: 0 0 12px; }
    legend { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
    .mode { display: flex; gap: 10px; padding: 9px 10px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
    .mode.on { border-color: #3470f0; background: #eff5ff; }
    .mode input { margin-top: 3px; accent-color: #1f57d6; }
    .mode b { display: block; font-size: 13px; } .mode span { display: block; font-size: 12px; color: #64748b; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .chips:focus-within { border-color: #3470f0; box-shadow: 0 0 0 3px #bfd6fe; }
    .chip { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; border-radius: 999px; padding: 3px 8px; font-size: 12px; }
    .chip button { border: 0; background: none; color: #94a3b8; cursor: pointer; padding: 0; }
    .chips input { flex: 1; min-width: 120px; border: 0; outline: 0; font-size: 13px; height: 24px; }
    ul { list-style: none; padding: 0; margin: 10px 0 0; border: 1px solid #e2e8f0; border-radius: 8px; }
    li { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-size: 13px; border-top: 1px solid #f1f5f9; }
    li:first-child { border-top: 0; }
    .err { background: #fef2f2; color: #b91c1c; border-radius: 6px; padding: 8px 10px; font-size: 13px; margin: 0 0 12px; }
    .ok { color: #047857; font-size: 12px; margin-left: 8px; }
    a { color: #1f57d6; }
    .row { display: flex; gap: 8px; align-items: center; }
    .google { gap: 10px; }
    .google svg { width: 18px; height: 18px; }
    .account { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; }
    .account b { color: #334155; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .linkbtn { border: 0; background: none; color: #1f57d6; cursor: pointer; font-size: 12px; padding: 0; white-space: nowrap; }
  `;

  const GOOGLE_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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

  class SharePanel {
    constructor({ getBlob, title, sourceUrl }) {
      this.getBlob = getBlob;
      this.title = (title || "").slice(0, 200);
      this.sourceUrl = sourceUrl || null;
      this.shot = null;
      this.chips = [];
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
    }

    close() {
      chrome.runtime.onMessage.removeListener(this.onConnected);
      document.removeEventListener("keydown", this.onKey, true);
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("beforeunload", this.onBeforeUnload);
      clearTimeout(this.retryTimer);
      this.host.remove();
      SharePanel.current = null;
    }

    render(inner) {
      this.root.innerHTML = `<style>${css}</style>
        <section class="panel" role="dialog" aria-label="Share screenshot">
          <header><h2>Share screenshot</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
          <div class="body">${inner}</div>
        </section>`;
      this.root.querySelector('[data-act="close"]').onclick = () => this.close();
    }

    async start() {
      const { token } = await send({ type: "screshot:token" });
      if (token) return this.upload();
      this.renderConnect();
    }

    /** Google sign-in right here (no trip to the website). Also signs in screshot.com in this browser. */
    renderConnect(error) {
      this.render(`
        ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
        <p>Sign in to share this screenshot by link. Only screenshots you share are uploaded; everything else stays on your computer.</p>
        <button class="btn outline block google" data-act="google">${GOOGLE_ICON}Sign in with Google</button>
        <p class="muted" style="margin:10px 0 0">New to Screshot? This creates your account. You&#39;ll be signed in on screshot.com in this browser too.</p>`);
      const btn = this.root.querySelector('[data-act="google"]');
      btn.onclick = async () => {
        btn.disabled = true;
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

    /**
     * Resumable upload (T16): create → PUT the file → complete. Progress is kept in this.pending, so a
     * retry continues where the network dropped instead of starting over, and the Idempotency-Key
     * means a create that did reach the server is never repeated as a second screenshot.
     */
    async upload() {
      if (this.uploading) return;
      this.uploading = true;
      this.waiting = false;
      clearTimeout(this.retryTimer);
      this.render(`<p>Uploading…</p><div class="bar"><div class="fill"></div></div><p class="muted" aria-live="polite">Preparing</p>`);
      const fill = this.root.querySelector(".fill");
      const label = this.root.querySelector(".muted");
      try {
        this.blob ??= await this.getBlob();
        const blob = this.blob;
        this.pending ??= { key: crypto.randomUUID(), created: null, uploaded: false };
        const p = this.pending;
        if (!p.created) {
          p.created = await api("/screenshots", {
            method: "POST",
            headers: { "Idempotency-Key": p.key },
            body: { mime: blob.type || "image/png", size_bytes: blob.size, title: this.title || null, source_url: this.sourceUrl },
          });
        }
        if (!p.uploaded) {
          try {
            await putWithProgress(p.created.upload.url, blob, p.created.upload.headers["Content-Type"], (x) => {
              fill.style.width = `${Math.round(x * 90)}%`;
              label.textContent = `${Math.round(x * 100)}% of ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
            });
          } catch (err) {
            // The signed upload URL expired while we were offline: start a fresh upload.
            if (err.status === 403) this.pending = null;
            throw err;
          }
          p.uploaded = true;
        }
        label.textContent = "Processing";
        this.shot = await api(`/screenshots/${p.created.screenshot.id}/complete`, { method: "POST" });
        // Processing runs as a background job in production: wait for it (up to 2 minutes).
        const deadline = Date.now() + 120_000;
        while (this.shot.status === "processing") {
          if (Date.now() > deadline) throw new ApiError(0, "slow", "Still processing. Your link will work in a minute; check the dashboard.");
          await new Promise((r) => setTimeout(r, 1500));
          this.shot = await api(`/screenshots/${p.created.screenshot.id}`);
        }
        if (this.shot.status === "failed") {
          this.pending = null; // "Try again" starts a fresh upload
          throw new ApiError(422, "processing_failed", "The image could not be processed. Try again.");
        }
        this.pending = null;
        this.attempts = 0;
        fill.style.width = "100%";
        const me = await api("/me").catch(() => null);
        if (me?.preferences?.auto_copy_link !== false) await navigator.clipboard.writeText(this.shot.url).then(() => (this.copied = true), () => {});
        await this.loadShares();
        this.account = (await send({ type: "screshot:account" }).catch(() => null))?.account ?? null;
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
      }
    }

    renderError(err) {
      if (err.status === 401) return this.renderConnect("Your session ended. Sign in again to share.");
      if (err.code === "offline") return this.renderWaiting();
      const extra =
        err.code === "quota_exceeded"
          ? `<p><a href="#" data-act="dash">Free up space in the dashboard</a></p>`
          : `<button class="btn primary" data-act="again">Try again</button>`;
      this.render(`<div class="err" role="alert">${esc(err.message)}</div>${extra}`);
      const again = this.root.querySelector('[data-act="again"]');
      if (again) again.onclick = () => this.upload();
      const dash = this.root.querySelector('[data-act="dash"]');
      if (dash) dash.onclick = async (e) => {
        e.preventDefault();
        const { appUrl } = await send({ type: "screshot:token" });
        window.open(`${appUrl}/dashboard`, "_blank");
      };
    }

    /** Offline: wait for the connection, retry on "online" and on a backoff (5s, 15s, 30s, then every 60s). */
    renderWaiting() {
      this.waiting = true;
      this.attempts = (this.attempts ?? 0) + 1;
      const delay = [5, 15, 30][this.attempts - 1] ?? 60;
      this.render(`<p><b>You're offline.</b> Your screenshot will upload as soon as the connection is back.</p>
        <p class="muted" aria-live="polite">Trying again in ${delay} seconds. Keep this tab open.</p>
        <button class="btn outline" data-act="again">Try now</button>`);
      this.root.querySelector('[data-act="again"]').onclick = () => this.upload();
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.upload(), delay * 1000);
    }

    async loadShares() {
      const detail = await api(`/screenshots/${this.shot.id}`);
      this.shot = detail;
    }

    renderDone(error) {
      const s = this.shot;
      this.render(`
        ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
        <div class="link">
          <input readonly value="${esc(s.url)}" aria-label="Link">
          <button class="btn outline" data-act="copy">${this.copied ? "Copied" : "Copy"}</button>
        </div>
        <fieldset><legend>Who can view</legend>
          ${MODES.map((m) => `<label class="mode ${s.visibility === m.id ? "on" : ""}"><input type="radio" name="v" value="${m.id}" ${s.visibility === m.id ? "checked" : ""}><span><b>${m.title}</b><span>${m.body}</span></span></label>`).join("")}
        </fieldset>
        ${
          s.visibility === "shared"
            ? `<legend style="font-size:13px;font-weight:600;color:#334155;margin-bottom:6px">Invite by email</legend>
               <div class="chips">${this.chips.map((c) => `<span class="chip">${esc(c)}<button data-rm="${esc(c)}" aria-label="Remove ${esc(c)}">✕</button></span>`).join("")}<input id="emails" placeholder="${this.chips.length ? "" : "name@company.com"}" aria-label="Invite by email"></div>
               <div class="row" style="margin-top:8px"><button class="btn primary" data-act="invite">Send invite</button></div>
               ${s.shares?.length ? `<ul>${s.shares.map((x) => `<li><span>${esc(x.email)}</span><button class="x" data-revoke="${x.id}" aria-label="Remove ${esc(x.email)}">✕</button></li>`).join("")}</ul>` : ""}`
            : ""
        }
        <p class="muted" style="margin-top:14px"><a href="#" data-act="dash">Open in dashboard</a></p>
        <div class="account"><span>Signed in as <b>${esc(this.account?.email || "your account")}</b></span><button class="linkbtn" data-act="signout">Sign out</button></div>`);

      const $ = (sel) => this.root.querySelector(sel);
      $('[data-act="signout"]').onclick = async () => {
        await send({ type: "screshot:signout" });
        this.renderConnect();
      };
      $('[data-act="copy"]').onclick = async () => {
        await navigator.clipboard.writeText(s.url);
        this.copied = true;
        $('[data-act="copy"]').textContent = "Copied";
      };
      this.root.querySelectorAll('input[name="v"]').forEach((r) => {
        r.onchange = async () => {
          try {
            this.shot = { ...(await api(`/screenshots/${s.id}`, { method: "PATCH", body: { visibility: r.value } })), shares: s.shares };
            this.renderDone();
          } catch (err) {
            this.renderDone(err.message);
          }
        };
      });
      $('[data-act="dash"]').onclick = (e) => {
        e.preventDefault();
        window.open(s.url.replace(/\/s\/.*$/, `/dashboard?open=${s.id}`), "_blank");
      };
      const input = $("#emails");
      if (input) {
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
        this.root.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
          this.chips = this.chips.filter((c) => c !== b.dataset.rm);
          this.renderDone();
        }));
        $('[data-act="invite"]').onclick = async () => {
          const pending = EMAIL.test(input.value.trim()) ? [input.value.trim().toLowerCase()] : [];
          const emails = [...this.chips, ...pending];
          if (!emails.length) return;
          try {
            const res = await api(`/screenshots/${s.id}/shares`, { method: "POST", body: { emails } });
            this.chips = [];
            this.shot = { ...this.shot, shares: res.shares };
            this.renderDone();
          } catch (err) {
            this.renderDone(err.message);
          }
        };
        this.root.querySelectorAll("[data-revoke]").forEach((b) => (b.onclick = async () => {
          try {
            const res = await api(`/screenshots/${s.id}/shares/${b.dataset.revoke}`, { method: "DELETE" });
            this.shot = { ...this.shot, shares: res.shares };
            this.renderDone();
          } catch (err) {
            this.renderDone(err.message);
          }
        }));
      }
    }
  }

  // Public entry point: one panel at a time.
  window.ScreshotShare = {
    open(opts) {
      if (SharePanel.current) return SharePanel.current;
      SharePanel.current = new SharePanel(opts);
      SharePanel.current.start();
      return SharePanel.current;
    },
  };
})();
