chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'processPage') {
    const header = document.createElement('div');
    header.textContent = window.location.href;
    header.style.fontSize = '12px';
    header.style.textAlign = 'center';
    header.style.margin = '20px 0';
    header.style.padding = '10px';
    header.style.borderBottom = '1px solid #ccc';
    document.body.insertBefore(header, document.body.firstChild);

    setTimeout(() => {
      const opt = {
        margin:       0.5,
        filename:     `${document.title || "document"}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(document.body).save().then(() => {
        const links = [];
        document.querySelectorAll('a').forEach(a => {
          const href = a.href;
          links.push(href);
        });
        sendResponse({ links: links });
      });
    }, 1000);

    return true;
  }
});