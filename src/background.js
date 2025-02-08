// src/background.js

var visited = new Set();
// The queue now holds objects: { url, depth }
var queue = [];
var maxDepth = 3;  // default depth limit is 3
var allUrls = [];
var aggregatedContent = "";
var maxPages = 200; // default maximum pages to crawl
var ajaxDelay = 200; // default AJAX delay in ms

function finishCrawl() {
  console.log("Crawling finished. Total pages crawled:", visited.size);
  // Save the aggregated content into storage so that the generate page can load it.
  chrome.storage.local.set({ aggregatedContent: aggregatedContent }, function() {
    // Open the generate page (it will load the aggregated content and trigger PDF printing).
    chrome.tabs.create({ url: chrome.runtime.getURL('src/generate.html'), active: false });
  });
}

function crawlNext() {
  // If we reached our maximum page limit, finish crawling.
  if (visited.size >= maxPages) {
    console.log("Reached maximum page limit:", maxPages);
    finishCrawl();
    return;
  }
  if (queue.length === 0) {
    finishCrawl();
    return;
  }
  var item = queue.shift();
  var url = item.url;
  var depth = item.depth;
  if (visited.has(url)) {
    crawlNext();
    return;
  }
  // Add this URL to the visited set and update persistent storage.
  visited.add(url);
  chrome.storage.local.set({ visitedUrls: Array.from(visited) });
  
  // Open the URL in a new, non‑active tab.
  chrome.tabs.create({ url: url, active: false }, function(tab) {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        // Ask the content script to process the page (extract article and links),
        // and pass the ajaxDelay value along.
        chrome.tabs.sendMessage(tab.id, { action: 'processPage', ajaxDelay: ajaxDelay }, function(response) {
          if (response) {
            // Append this page’s article HTML (with its URL header) to the accumulator.
            if (response.articleHtml) {
              aggregatedContent += response.articleHtml + "<hr/>";
            }
            // Process links for further crawling (if within depth and maxPages not exceeded).
            if (response.links && depth < maxDepth) {
              response.links.forEach(function(link) {
                if (!visited.has(link) && visited.size < maxPages) {
                  queue.push({ url: link, depth: depth + 1 });
                  allUrls.push(link);
                }
              });
            }
          }
          // Close the tab and proceed.
          chrome.tabs.remove(tab.id, function() {
            crawlNext();
          });
        });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  });
}

// Listen for messages from popup and other parts.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCrawl') {
    // Reset state for a new crawl.
    visited = new Set();
    queue = [];
    aggregatedContent = "";
    allUrls = [];
    maxDepth = msg.depth || 3;
    maxPages = msg.maxPages || 200;
    ajaxDelay = msg.ajaxDelay !== undefined ? msg.ajaxDelay : 200;

    // Load any previously persisted visited URLs from storage.
    chrome.storage.local.get(['visitedUrls'], function(result) {
      if (result.visitedUrls && Array.isArray(result.visitedUrls)) {
        result.visitedUrls.forEach(function(url) {
          visited.add(url);
        });
      }
      // Start crawling with the provided starting URL.
      let startUrl = msg.startUrl;
      queue.push({ url: startUrl, depth: 0 });
      crawlNext();
    });
  } else if (msg.action === 'clearHistory') {
    // Clear persistent storage for visited URLs.
    chrome.storage.local.remove(['visitedUrls'], function() {
      visited = new Set();
      console.log("Cleared persistent crawl history.");
      if (sendResponse) sendResponse({ status: "cleared" });
    });
  } else if (msg.action === 'printAggregatedPdf') {
    // Use the generate.html tab to print the aggregated content.
    printPageToPDF(sender.tab.id, 'aggregated.pdf', function() {
      chrome.tabs.remove(sender.tab.id);
    });
  }
});

/**
 * Helper: Print a given tab to PDF using Chrome’s debugger API.
 */
function printPageToPDF(tabId, filename, callback) {
  chrome.debugger.attach({ tabId: tabId }, "1.3", function() {
    const options = {
      printBackground: true,
      landscape: false,
      displayHeaderFooter: false,
      paperWidth: 8.27,   // A4 width in inches
      paperHeight: 11.69, // A4 height in inches
    };
    chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", options, function(result) {
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
      }, function(downloadId) {
        console.log("Download started with ID:", downloadId);
        chrome.debugger.detach({ tabId: tabId }, function() {
          if (callback) callback();
        });
      });
    });
  });
}
