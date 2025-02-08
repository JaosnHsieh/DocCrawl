chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'processPage') {
    // Add a header with the current URL (for visual feedback, if desired)
    const header = document.createElement('div');
    header.textContent = window.location.href;
    header.style.fontSize = '12px';
    header.style.textAlign = 'center';
    header.style.margin = '20px 0';
    header.style.padding = '10px';
    header.style.borderBottom = '1px solid #ccc';
    document.body.insertBefore(header, document.body.firstChild);

    // Gather all links on the page
    const links = [];
    document.querySelectorAll('a').forEach(a => {
      const href = a.href;
      links.push(href);
    });
    sendResponse({ links: links });
    return true;
  } else if (msg.action === 'generatePdf') {
    // Generate a PDF of the crawled URLs.
    // (Ensure that jsPDF is available on this page.)
    const doc = new window.jsPDF();
    msg.urls.forEach((url, index) => {
      doc.text(url, 10, 10 + (index * 10));
    });
    doc.save('crawled-urls.pdf');
  }
});