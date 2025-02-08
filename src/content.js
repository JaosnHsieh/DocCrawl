chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'processPage') {
    // Create a header with the current page URL.
    const headerHtml = `<h2 style="border-bottom: 1px solid #ccc; padding-bottom: 4px;">${window.location.href}</h2>`;
    
    // Use Readability to extract the article.
    let article;
    try {
      article = new Readability(document).parse();
    } catch (e) {
      console.error("Readability failed on", window.location.href, e);
    }
    
    // If Readability fails, fallback to using the body’s inner HTML.
    const contentHtml = article && article.content ? article.content : document.body.innerHTML;
    
    // Optionally, still gather all links for crawling.
    const links = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href) {
        links.push(a.href);
      }
    });
    
    // Respond with both the links (for crawling) and the extracted article HTML.
    sendResponse({ 
      links: links, 
      articleHtml: headerHtml + contentHtml 
    });
    return true;
    
  } else if (msg.action === 'generatePdf') {
    // (Legacy branch if needed)
    const doc = new window.jsPDF();
    msg.urls.forEach((url, index) => {
      doc.text(url, 10, 10 + (index * 10));
    });
    doc.save('crawled-urls.pdf');
  }
});
