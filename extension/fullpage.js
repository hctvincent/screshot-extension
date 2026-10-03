// Trang xem ảnh chụp cả trang: chỉ hiển thị ảnh, không tải editor, để người dùng thấy ngay toàn bộ kết quả.
const shot = document.getElementById("shot");
const statusEl = document.getElementById("status");
const info = document.getElementById("info");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");
const toast = document.getElementById("toast");

let imageUrl = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setScreenshotUrl") {
    sendResponse({ status: "success" });
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
  };
  shot.onerror = () => {
    statusEl.textContent = "Could not load the screenshot. Please try again.";
  };
  shot.src = url;
}

function showToast(message) {
  toast.textContent = message;
  toast.style.opacity = 1;
  setTimeout(() => (toast.style.opacity = 0), 1800);
}

downloadBtn.addEventListener("click", () => {
  const ext = imageUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
  const a = document.createElement("a");
  a.href = imageUrl;
  a.download = `screshot-fullpage-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.${ext}`;
  a.click();
});

copyBtn.addEventListener("click", async () => {
  try {
    // Clipboard chỉ nhận PNG, nên chuyển ảnh JPEG (trang quá dài) sang PNG trước.
    const canvas = document.createElement("canvas");
    canvas.width = shot.naturalWidth;
    canvas.height = shot.naturalHeight;
    canvas.getContext("2d").drawImage(shot, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Copied to clipboard!");
  } catch (e) {
    console.error(e);
    showToast("Could not copy this image. Use Download instead.");
  }
});
