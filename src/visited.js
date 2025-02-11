document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(['visitedPages'], function(result) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';
    if (result.visitedPages && result.visitedPages.length > 0) {
      result.visitedPages.forEach(function(page) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        const header = document.createElement('h2');
        header.textContent = page.url;
        const content = document.createElement('div');
        content.innerHTML = page.content;
        pageDiv.appendChild(header);
        pageDiv.appendChild(content);
        contentDiv.appendChild(pageDiv);
      });
    } else {
      contentDiv.innerHTML = '<p>No visited content found.</p>';
    }
  });

  document.getElementById('print').addEventListener('click', function() {
    window.print();
  });
});
