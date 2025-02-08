// src/generate.js

document.addEventListener('DOMContentLoaded', function() {
    // Load the aggregated content from storage.
    chrome.storage.local.get(['aggregatedContent'], function(result) {
      var contentDiv = document.getElementById('content');
      if (result.aggregatedContent) {
        contentDiv.innerHTML = result.aggregatedContent;
      } else {
        contentDiv.innerHTML = "<p>No content found.</p>";
      }
      // After a short delay (to allow the content to render), tell the background to print the page.
      setTimeout(function() {
        chrome.runtime.sendMessage({ action: 'printAggregatedPdf' });
      }, 3000); // Increased delay to ensure the tab is ready.
    });
  });
  
