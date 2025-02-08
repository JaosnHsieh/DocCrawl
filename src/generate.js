// Debug: log the jsPDF namespace to ensure it loaded
console.log("generate.js loaded");
console.log("window.jspdf:", window.jspdf);

if (!window.jspdf) {
  console.error("jsPDF did not load. Please verify the script path in generate.html.");
}

const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
console.log("jsPDF constructor:", jsPDF);

// Establish a long‑lived connection with the background.
var port = chrome.runtime.connect({ name: "generate" });
port.onMessage.addListener((msg) => {
  if (msg.action === 'generatePdf') {
    console.log("Received generatePdf message with urls:", msg.urls);
    if (!jsPDF) {
      console.error("jsPDF is not available!");
      return;
    }
    const doc = new jsPDF();
    msg.urls.forEach((url, index) => {
      doc.text(url, 10, 10 + (index * 10));
    });
    console.log("Saving PDF with", msg.urls.length, "urls");
    doc.save('crawled-urls.pdf');
  }
});