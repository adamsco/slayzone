// Background service worker — responds to ping messages from content script.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'ping') {
    sendResponse({ type: 'pong' })
  }
})
