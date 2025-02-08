// src/pdfHelper.js

function printPageToPDF(tabId, filename = 'page.pdf', printOptions = {}) {
    // Attach to the tab using the Chrome Debugger API.
    chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
      // Set up default print options if not provided
      const options = Object.assign({
        printBackground: true,
        landscape: false,
        displayHeaderFooter: false,
        paperWidth: 8.27,  // A4 size in inches
        paperHeight: 11.69,
      }, printOptions);
  
      chrome.debugger.sendCommand({ tabId: tabId }, "Page.printToPDF", options, (result) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to print to PDF:", chrome.runtime.lastError.message);
          chrome.debugger.detach({ tabId: tabId });
          return;
        }
        // The result.data is a base64‑encoded PDF.
        const pdfData = result.data;
        const pdfUrl = 'data:application/pdf;base64,' + pdfData;
  
        // Download the PDF file.
        chrome.downloads.download({
          url: pdfUrl,
          filename: filename
        }, (downloadId) => {
          console.log("Download started with ID:", downloadId);
          // Detach the debugger after downloading.
          chrome.debugger.detach({ tabId: tabId });
        });
      });
    });
  }
  