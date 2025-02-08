// src/background.js

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

/**
 * Prints the page in the given tab to PDF using Chrome's debugger API
 * and downloads the PDF.
 *
 * @param {number} tabId - The ID of the tab to print.
 * @param {string} filename - The filename for the downloaded PDF.
 * @param {function} callback - Called after PDF generation and download starts.
 */
function printPageToPDF(tabId, filename, callback) {
  // Attach the debugger to the tab.
  chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
    // Default print options (modify as needed)
    const options = {
      printBackground: true,
      landscape: false,
      displayHeaderFooter: false,
      paperWidth: 8.27,   // A4 width in inches
      paperHeight: 11.69, // A4 height in inches
    };

    // Send the command to print to PDF.
    chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", options, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to print to PDF:", chrome.runtime.lastError.message);
        chrome.debugger.detach({ tabId: tabId });
        if (callback) callback();
        return;
      }
      // The PDF data is returned as a base64‑encoded string.
      const pdfData = result.data;
      const pdfUrl = 'data:application/pdf;base64,' + pdfData;

      // Initiate the download.
      chrome.downloads.download({
        url: pdfUrl,
        filename: filename
      }, (downloadId) => {
        console.log("Download started with ID:", downloadId);
        // Detach the debugger and invoke the callback.
        chrome.debugger.detach({ tabId: tabId }, () => {
          if (callback) callback();
        });
      });
    });
  });
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
        // Ask the content script to process the page and collect links.
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
          
          // Create a safe filename for the PDF.
          // (Here we replace non-alphanumeric characters with underscores and truncate if needed.)
          let safeFilename = normalizedUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          let filename = safeFilename.substring(0, 50) + ".pdf";
          
          // Print the page to PDF and download it.
          printPageToPDF(tab.id, filename, () => {
            // Once PDF generation is done, close the tab and continue crawling.
            chrome.tabs.remove(tab.id);
            crawlNext();
          });
        });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  });
}

function finishCrawl() {
  console.log("Crawling finished.");
  // You can add any finalization steps here.
  // For example, you might open a summary page or notify the user.
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
