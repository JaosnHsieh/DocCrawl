// src/content.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'processPage') {
    // Delay processing by 500ms to allow AJAX-loaded content to finish loading
    setTimeout(() => {
      // First, extract all link URLs from the original document
      const links = Array.from(document.querySelectorAll('a'))
        .map(link => link.href)
        .filter(href => href && href.trim().length > 0);

      // Now, run Readability to extract the article content.
      // (We do this after collecting the links so that any DOM changes made by Readability won’t affect the links.)
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
    }, 500);
    // Return true to indicate that we will send a response asynchronously.
    return true;
  }
});
