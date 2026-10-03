let id = 1;

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.captureVisibleTab(null, {}, (screenshotUrl) => {
    const viewTabUrl = chrome.runtime.getURL("screenshot.html?id=" + id++);
    let targetId = null;

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === targetId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        // Check if the tab is fully loaded before sending the message
        if (info.status === "complete") {
          chrome.tabs.sendMessage(
            targetId,
            {
              action: "setScreenshotUrl",
              screenshotUrl: screenshotUrl,
            },
            function (response) {
              if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError.message);
              } else {
                console.log(response);
              }
            }
          );
        }
      }
    });

    chrome.tabs.create({ url: viewTabUrl }, (tab) => {
      targetId = tab.id;
    });
  });
});
