var visited = new Set();
// The queue now holds objects: { url, depth }
var queue = [];
var maxDepth = 3;  // default depth limit is 3

var allUrls = [];
var baseDomain = ""; // The domain of the starting URL

// Helper function to remove the fragment (anchor) from URLs
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = ""; // remove fragment
    return parsed.toString();
  } catch (e) {
    console.error("Failed to normalize URL:", url, e);
    return null;
  }
}

function crawlNext() {
  if (queue.length === 0) {
    finishCrawl();
    return;
  }

  // Dequeue next URL object
  let { url, depth } = queue.shift();
  let normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    crawlNext();
    return;
  }
  if (visited.has(normalizedUrl)) {
    crawlNext();
    return;
  }
  visited.add(normalizedUrl);

  // Open the URL in a new, non‑active tab
  chrome.tabs.create({ url: normalizedUrl, active: false }, (tab) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tab.id, { action: 'processPage' }, (response) => {
          if (response && response.links) {
            // Only add new links if we have not reached the maximum depth
            if (depth < maxDepth) {
              response.links.forEach(link => {
                let normalizedLink = normalizeUrl(link);
                if (!normalizedLink) return; // Skip if the URL is invalid
                // Only process URLs with http/https protocols
                if (!normalizedLink.startsWith("http://") && !normalizedLink.startsWith("https://")) {
                  return;
                }
                try {
                  // Only follow links on the same domain as the starting URL
                  if (
                    new URL(normalizedLink).hostname === baseDomain &&
                    !visited.has(normalizedLink)
                  ) {
                    queue.push({ url: normalizedLink, depth: depth + 1 });
                    allUrls.push(normalizedLink);
                  }
                } catch (e) {
                  console.error("Skipping invalid URL:", link);
                }
              });
            }
            // Also add the current URL to the list
            allUrls.push(normalizedUrl);
          }
          chrome.tabs.remove(tab.id);
          crawlNext();
        });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  });
}

function finishCrawl() {
  console.log("Crawling finished.");
  // Open the generate page. It will connect to the background when loaded.
  chrome.tabs.create({ url: chrome.runtime.getURL('src/generate.html'), active: false });
}

// Listen for the start message from the popup.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCrawl') {
    visited = new Set();
    queue = [];
    // Use the provided starting URL (or fall back to the sender’s tab URL)
    let startUrl = msg.startUrl || (sender.tab && sender.tab.url);
    if (!startUrl) {
      console.warn("No starting URL provided");
      return;
    }
    // Normalize the starting URL and extract the domain.
    startUrl = normalizeUrl(startUrl);
    try {
      baseDomain = new URL(startUrl).hostname;
    } catch (e) {
      console.warn("Invalid starting URL:", startUrl);
      return;
    }
    // Enqueue the starting URL with depth 1
    queue.push({ url: startUrl, depth: 1 });
    maxDepth = msg.depth || 3;
    allUrls = [];
    crawlNext();
  }
});

// NEW: Listen for a connection from the generate page.
chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === "generate") {
    port.postMessage({
      action: "generatePdf",
      urls: allUrls
    });
    allUrls = []; // Reset after sending
  }
});