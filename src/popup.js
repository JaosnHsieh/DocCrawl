document.getElementById('start').addEventListener('click', () => {
  const startUrl = document.getElementById('startUrl').value;
  if (startUrl) {
    chrome.runtime.sendMessage({
      action: 'startCrawl',
      startUrl: startUrl
    });
  } else {
    alert('Please enter a starting URL');
  }
});