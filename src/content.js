// src/content.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'processPage') {
    // Use the provided ajaxDelay (defaulting to 200 ms if not supplied) before processing.
    const delay = (msg.ajaxDelay !== undefined) ? msg.ajaxDelay : 200;
    setTimeout(() => {
      // First, extract all link URLs from the original document.
      const links = Array.from(document.querySelectorAll('a'))
        .map(link => link.href)
        .filter(href => href && href.trim().length > 0);

      // Now, run Readability to extract the article content.
      // (This is done after collecting the links so that any DOM changes by Readability don’t affect the links.)
      let article;
      try {
        article = new Readability(document).parse();
      } catch (e) {
        console.error('Readability failed:', e);
      }

      // Fallback to the whole body if Readability did not work.
      const articleHtml = article && article.content ? article.content : document.body.innerHTML;

      sendResponse({
        links: links,
        articleHtml: articleHtml
      });
    }, delay);
    // Return true to indicate that we will send a response asynchronously.
    return true;
  }
});
