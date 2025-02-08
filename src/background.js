// src/background.js

var visited = new Set();
// The queue now holds objects: { url, depth }
var queue = [];
var maxDepth = 3;  // default depth limit is 3

var allUrls = [];
var baseDomain = ""; // The domain of the starting URL

// New global accumulator for extracted HTML from each page.
var aggregatedContent = "";

// Helper function to remove the fragment (anchor) from URLs.
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

  // Dequeue next URL object.
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

  // Open the URL in a new, non‑active tab.
  chrome.tabs.create({ url: normalizedUrl, active: false }, (tab) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Ask the content script to process the page (extract article and links).
        chrome.tabs.sendMessage(tab.id, { action: 'processPage' }, (response) => {
          if (response) {
            // Append this page’s article HTML (with its URL header) to the accumulator.
            if (response.articleHtml) {
              aggregatedContent += response.articleHtml + "<hr/>";
            }
            // Process links for further crawling.
            if (response.links && depth < maxDepth) {
              response.links.forEach(link => {
                let normalizedLink = normalizeUrl(link);
                if (!normalizedLink) return; // Skip if invalid.
                // Only process URLs with http/https protocols.
                if (!normalizedLink.startsWith("http://") && !normalizedLink.startsWith("https://")) {
                  return;
                }
                try {
                  // Only follow links on the same domain as the starting URL.
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
          }
          // Close the tab and proceed.
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
  // Save the aggregated content into storage so that the generate page can load it.
  chrome.storage.local.set({ aggregatedContent: aggregatedContent }, () => {
    // Open the generate page (it will load the aggregated content and trigger PDF printing).
    chrome.tabs.create({ url: chrome.runtime.getURL('src/generate.html'), active: false });
  });
}

// Listen for the start message from the popup.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCrawl') {
    visited = new Set();
    queue = [];
    aggregatedContent = ""; // Reset aggregated content.
    // Use the provided starting URL (or fall back to the sender’s tab URL).
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
    // Enqueue the starting URL with depth 1.
    queue.push({ url: startUrl, depth: 1 });
    maxDepth = msg.depth || 3;
    allUrls = [];
    crawlNext();
  }
});

// --- New: Listen for a message from generate.html to print the aggregated content ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'printAggregatedPdf') {
    // Use the generate.html tab to print the aggregated content.
    // Here we reuse our PDF printing helper (defined below).
    printPageToPDF(sender.tab.id, 'aggregated.pdf', () => {
      chrome.tabs.remove(sender.tab.id);
    });
  }
});

/**
 * Helper: Print a given tab to PDF using Chrome’s debugger API.
 * (This is the same as before.)
 */
function printPageToPDF(tabId, filename, callback) {
  chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
    const options = {
      printBackground: true,
      landscape: false,
      displayHeaderFooter: false,
      paperWidth: 8.27,   // A4 width (in inches)
      paperHeight: 11.69, // A4 height (in inches)
    };

    chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", options, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to print to PDF:", chrome.runtime.lastError.message);
        chrome.debugger.detach({ tabId: tabId });
        if (callback) callback();
        return;
      }
      const pdfData = result.data;
      const pdfUrl = 'data:application/pdf;base64,' + pdfData;
      chrome.downloads.download({
        url: pdfUrl,
        filename: filename
      }, (downloadId) => {
        console.log("Download started with ID:", downloadId);
        chrome.debugger.detach({ tabId: tabId }, () => {
          if (callback) callback();
        });
      });
    });
  });
}
