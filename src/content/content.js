console.log('Śrutilekhak content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'displayTranscription') {
    displayText(message.text);
    sendResponse({ success: true });
    return true;
  }
});

function displayText(text) {
  console.log('Displaying text:', text);
  
  let overlay = document.getElementById('srutilekhak-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'srutilekhak-overlay';
    overlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 999999;
      max-width: 500px;
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.textContent = text;
}
