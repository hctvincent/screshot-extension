// Shared UI helpers for every extension page (editor, full-page viewer, Share panel), in the
// style of Fluent 2. Classic script: exposes window.ScreshotUI. Styles: ui/fluent.css.
//
//   const t = ScreshotUI.toast({ intent: "progress", title: "Copying…" });
//   t.update({ intent: "success", title: "Copied to clipboard" });   // auto-dismisses
//
// One toaster per page, bottom center, newest at the bottom; a live region so screen readers hear it.
(() => {
  // Fluent-style 20px icons (outline), currentColor.
  const svg = (body, filled) =>
    `<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="${filled ? "currentColor" : "none"}" stroke="${filled ? "none" : "currentColor"}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const ICONS = {
    // Status: a filled shape in the status colour with a white glyph on top.
    success: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M6.75 10.25l2.25 2.25 4.25-4.75" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 6v4.75" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="13.5" r="1" fill="#fff"/></svg>',
    warning: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M8.68 2.79a1.5 1.5 0 0 1 2.64 0l6.5 12A1.5 1.5 0 0 1 16.5 17h-13a1.5 1.5 0 0 1-1.32-2.21l6.5-12Z" fill="currentColor"/><path d="M10 7v4.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="14" r="1" fill="#fff"/></svg>',
    info: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 9v5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.5" r="1" fill="#fff"/></svg>',
    dismiss: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'),
    copy: svg('<rect x="7" y="7" width="9" height="9" rx="1.75"/><path d="M13 7V5.75A1.75 1.75 0 0 0 11.25 4h-5.5A1.75 1.75 0 0 0 4 5.75v5.5A1.75 1.75 0 0 0 5.75 13H7"/>'),
    link: svg('<path d="M8.25 11.75l3.5-3.5"/><path d="M10.75 6.25l1.25-1.25a3.18 3.18 0 0 1 4.5 4.5l-1.25 1.25"/><path d="M9.25 13.75L8 15a3.18 3.18 0 0 1-4.5-4.5l1.25-1.25"/>'),
    lock: svg('<rect x="4.75" y="8.75" width="10.5" height="7.5" rx="1.75"/><path d="M7.25 8.75V6.5a2.75 2.75 0 0 1 5.5 0v2.25"/>'),
    globe: svg('<circle cx="10" cy="10" r="6.75"/><path d="M3.25 10h13.5M10 3.25c1.9 2 2.75 4.25 2.75 6.75S11.9 14.75 10 16.75C8.1 14.75 7.25 12.5 7.25 10S8.1 5.25 10 3.25Z"/>'),
    people: svg('<circle cx="7.5" cy="7" r="2.5"/><path d="M3 15.25c.4-2.3 2.2-3.75 4.5-3.75s4.1 1.45 4.5 3.75"/><circle cx="13.75" cy="7.5" r="2"/><path d="M13.5 11.5c1.9.1 3.2 1.3 3.5 3.25"/>'),
    shield: svg('<path d="M10 2.75 4.25 5v4.25c0 3.4 2.4 6.3 5.75 8 3.35-1.7 5.75-4.6 5.75-8V5L10 2.75Z"/><path d="M7.75 10l1.5 1.5 3-3"/>'),
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const spinner = (cls = "") => `<span class="sf-spinner ${cls}" role="presentation"></span>`;

  // Make sure a page that only loads ui.js still gets the styles.
  function ensureStyles() {
    if (document.querySelector('link[data-sf-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("ui/fluent.css") : "ui/fluent.css";
    link.dataset.sfStyles = "";
    document.head.appendChild(link);
  }

  let toaster = null;
  function getToaster() {
    if (toaster && toaster.isConnected) return toaster;
    ensureStyles();
    toaster = document.createElement("div");
    toaster.className = "sf-toaster";
    toaster.setAttribute("role", "status");
    toaster.setAttribute("aria-live", "polite");
    document.body.appendChild(toaster);
    return toaster;
  }

  const DEFAULT_TIMEOUT = { success: 3000, info: 4000, warning: 6000, error: 7000, progress: null };
  const MAX_TOASTS = 3;

  /**
   * Show a toast. intent: "success" | "error" | "warning" | "info" | "progress" (spinner, stays
   * until updated). Returns { update(options), dismiss() }.
   */
  function toast(options) {
    const host = getToaster();
    const el = document.createElement("div");
    let timer = null;

    const render = ({ intent = "info", title = "", body = "", timeout } = {}) => {
      clearTimeout(timer);
      el.className = `sf-toast ${intent}${el.classList.contains("in") ? " in" : ""}`;
      el.innerHTML = `<span class="sf-toast-icon">${intent === "progress" ? spinner() : ICONS[intent] ?? ICONS.info}</span>
        <div class="sf-toast-main">${title ? `<div class="sf-toast-title">${esc(title)}</div>` : ""}${body ? `<div class="sf-toast-body">${esc(body)}</div>` : ""}</div>
        ${intent === "progress" ? "" : `<button type="button" class="sf-toast-close" aria-label="Dismiss">${ICONS.dismiss}</button>`}`;
      el.querySelector(".sf-toast-close")?.addEventListener("click", dismiss);
      const ms = timeout === undefined ? DEFAULT_TIMEOUT[intent] : timeout;
      if (ms) timer = setTimeout(dismiss, ms);
    };
    function dismiss() {
      clearTimeout(timer);
      el.classList.remove("in");
      setTimeout(() => el.remove(), 220);
    }

    render(options);
    host.appendChild(el);
    // Keep the stack short: the oldest goes first.
    while (host.children.length > MAX_TOASTS) host.firstElementChild.remove(); // oldest is first
    requestAnimationFrame(() => el.classList.add("in"));
    return { update: (next) => render({ ...options, ...next }), dismiss };
  }

  window.ScreshotUI = { toast, spinner, icon: (name) => ICONS[name] ?? "", esc, ensureStyles };
})();
