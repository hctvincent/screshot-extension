chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setScreenshotUrl") {
    sendResponse({ status: "success" });
    setScreenshotUrl(request.screenshotUrl);
  }
});

function setScreenshotUrl(url) {
  var elem = document.getElementById("drawingTool");
  // Option names must match DrawingCore (drawing-tool/src/lib/core/drawingCore.js)
  new DrawingTool(elem, {
    bgImage: url,
    onClose: () => {
      window.close();
    },
  });
}
