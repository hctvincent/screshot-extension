chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setScreenshotUrl") {
    // Do something with request.screenshotUrl
    sendResponse({ status: "success" });
    var url = request.screenshotUrl;
    setScreenshotUrl(url);
  }
});

function setScreenshotUrl(url) {
  
  var elem = document.getElementById("drawingTool");
  new DrawingTool(elem, {
    screenshotPath: url,
    onInit: () => {},
    onCloseClick: () => {
      window.close();
    },

    onCopyClipboardClick: () => {
      showSnackbar();
    },
  });
}

function showSnackbar() {
  var x = document.getElementById("snackbar");
  x.className = "show";
  setTimeout(function () {
    x.className = x.className.replace("show", "");
  }, 2000);
}
