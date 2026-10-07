chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setScreenshotUrl") {
    sendResponse({ status: "success" });
    setScreenshotUrl(request.screenshotUrl, request.meta || {});
  }
});

function setScreenshotUrl(url, meta) {
  var elem = document.getElementById("drawingTool");
  // Option names must match DrawingCore (drawing-tool/src/lib/core/drawingCore.js)
  new DrawingTool(elem, {
    bgImage: url,
    onClose: () => {
      window.close();
    },
    // Share by link: the cropped, annotated image goes to the Share panel (share/share-panel.js).
    onShare: (canvas) => {
      window.ScreshotShare.open({
        getBlob: () => new Promise((resolve) => canvas.toBlob(resolve, "image/png")),
        title: meta.title,
        sourceUrl: meta.sourceUrl,
      });
    },
  });
}
