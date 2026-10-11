// Trang xem ảnh chụp cả trang: chỉ hiển thị ảnh, không tải editor, để người dùng thấy ngay toàn bộ kết quả.
const shot = document.getElementById("shot");
const statusEl = document.getElementById("status");
const info = document.getElementById("info");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");
const shareBtn = document.getElementById("share");
let meta = {};
const UI = window.ScreshotUI;

let imageUrl = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setScreenshotUrl") {
    sendResponse({ status: "success" });
    meta = request.meta || {};
    showImage(request.screenshotUrl);
  }
});

function showImage(url) {
  imageUrl = url;
  shot.onload = () => {
    statusEl.remove();
    shot.style.display = "block";
    // Hiển thị theo kích thước CSS gốc của trang (ảnh chụp theo devicePixelRatio).
    shot.style.width = `${shot.naturalWidth / window.devicePixelRatio}px`;
    info.textContent = `${shot.naturalWidth} × ${shot.naturalHeight} px`;
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    shareBtn.disabled = false;
  };
  shot.onerror = () => {
    statusEl.textContent = "Could not load the screenshot. Please try again.";
    UI.toast({ intent: "error", title: "Could not load the screenshot", body: "Capture the page again." });
  };
  shot.src = url;
}

downloadBtn.addEventListener("click", () => {
  const ext = imageUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
  const a = document.createElement("a");
  a.href = imageUrl;
  a.download = `screshot-fullpage-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.${ext}`;
  a.click();
  UI.toast({ intent: "success", title: "Download started", body: a.download });
});

copyBtn.addEventListener("click", async () => {
  // Long pages take a moment to convert: one toast goes from "Copying…" to the result.
  const t = UI.toast({ intent: "progress", title: "Copying…" });
  copyBtn.disabled = true;
  try {
    // Clipboard chỉ nhận PNG, nên chuyển ảnh JPEG (trang quá dài) sang PNG trước.
    const canvas = document.createElement("canvas");
    canvas.width = shot.naturalWidth;
    canvas.height = shot.naturalHeight;
    canvas.getContext("2d").drawImage(shot, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    t.update({ intent: "success", title: "Copied to clipboard", body: "Paste it into Slack, Jira or an email." });
  } catch (e) {
    console.error(e);
    t.update({ intent: "error", title: "Couldn't copy this image", body: "It may be too large for the clipboard. Use Download instead." });
  } finally {
    copyBtn.disabled = false;
  }
});

// Share by link (Upload & Share): the stitched image goes to the Share panel.
shareBtn.addEventListener("click", () => {
  window.ScreshotShare.open({
    getBlob: () => fetch(imageUrl).then((r) => r.blob()),
    title: meta.title ? meta.title + " (full page)" : "Full page",
    sourceUrl: meta.sourceUrl,
    anchor: shareBtn,
  });
});
