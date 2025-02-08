let visited = new Set();
let queue = [];

let allUrls = [];

function crawlNext() {
  if (queue.length === 0) {
    console.log("Crawling finished.");
    // Generate PDF after crawl completes
    const doc = new jsPDF();
    allUrls.forEach((url, index) => {
      doc.text(url, 10, 10 + (index * 10));
    });
    doc.save('crawled-urls.pdf');
    allUrls = []; // Reset for next crawl
    return;
  }
  const url = queue.shift();
  if (visited.has(url)) {
    crawlNext();
    return;
  }
  visited.add(url);

  chrome.tabs.create({ url: url, active: false }, (tab) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tab.id, { action: 'processPage' }, (response) => {
          if (response && response.links) {
            response.links.forEach(link => {
              if (!visited.has(link)) {
                queue.push(link);
                allUrls.push(link);
              }
            });
            allUrls.push(url); // Add current URL
          }
          chrome.tabs.remove(tab.id);
          crawlNext();
        });
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  });
}

chrome.action.onClicked.addListener(() => {
  visited = new Set();
  queue = [];
  crawlNext();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startCrawl') {
    visited = new Set();
    queue = [msg.startUrl];
    crawlNext();
  }
});