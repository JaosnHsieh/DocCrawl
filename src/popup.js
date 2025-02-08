document.addEventListener('DOMContentLoaded', function() {
  // Set the start URL to the current active tab’s URL
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
      document.getElementById('startUrl').value = tabs[0].url;
    }
  });

  document.getElementById('start').addEventListener('click', () => {
    const startUrl = document.getElementById('startUrl').value;
    const depthInput = document.getElementById('depth');
    const depth = depthInput.value ? parseInt(depthInput.value) : 3;
    
    if (startUrl) {
      chrome.runtime.sendMessage({
        action: 'startCrawl',
        startUrl: startUrl,
        depth: depth
      });
    } else {
      alert('Please enter a starting URL');
    }
  });
});