console.log('Śrutilekhak content script loaded');

let overlay = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'showLoading') {
    showLoadingState();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'displayTranscription') {
    displayText(message.text);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'hideOverlay') {
    hideOverlay();
    sendResponse({ success: true });
    return true;
  }
});

function showLoadingState() {
  console.log('Showing loading state');
  
  if (!overlay) {
    createOverlay();
  }
  
  overlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>Starting transcription...</span>
    </div>
  `;
  
  overlay.style.opacity = '0';
  overlay.style.display = 'block';
  
  if (!document.getElementById('srutilekhak-style')) {
    const style = document.createElement('style');
    style.id = 'srutilekhak-style';
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      #srutilekhak-overlay {
        transition: opacity 0.3s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Fade in
  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 10);
}

function displayText(text) {
  console.log('Displaying text:', text);
  
  if (!overlay) {
    createOverlay();
  }
  
  overlay.textContent = text;
  overlay.style.opacity = '1';
  overlay.style.display = 'block';
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'srutilekhak-overlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 18px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    z-index: 999999;
    max-width: 600px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: none;
    opacity: 0;
  `;
  document.body.appendChild(overlay);
}

function hideOverlay() {
  console.log('Hiding overlay');
  
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        overlay = null;
      }
    }, 300);
  }
}
