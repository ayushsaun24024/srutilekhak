let overlay = null;
let currentSettings = {
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  bgOpacity: 85,
  position: 'bottom-left'
};

chrome.storage.local.get(['captionSettings'], (result) => {
  if (result.captionSettings) {
    currentSettings = result.captionSettings;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  
  if (message.action === 'updateSettings') {
    currentSettings = message.settings;
    if (overlay) {
      applySettings();
    }
    sendResponse({ success: true });
    return true;
  }
});

function showLoadingState() {
  
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
  
  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 10);
}

function displayText(text) {
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
  applySettings();
  document.body.appendChild(overlay);
}

function applySettings() {
  if (!overlay) return;
  
  const positions = {
    'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' },
    'top-center': { top: '20px', left: '50%', bottom: 'auto', right: 'auto', transform: 'translateX(-50%)' },
    'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
    'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
    'bottom-center': { bottom: '20px', left: '50%', top: 'auto', right: 'auto', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
  };
  
  const pos = positions[currentSettings.position] || positions['bottom-left'];
  const bgOpacity = (currentSettings.bgOpacity / 100).toFixed(2);
  
  overlay.style.cssText = `
    position: fixed;
    ${pos.top ? `top: ${pos.top};` : ''}
    ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
    ${pos.left ? `left: ${pos.left};` : ''}
    ${pos.right ? `right: ${pos.right};` : ''}
    ${pos.transform ? `transform: ${pos.transform};` : ''}
    background: rgba(0, 0, 0, ${bgOpacity});
    color: white;
    padding: 12px 18px;
    border-radius: 8px;
    font-family: ${currentSettings.fontFamily};
    font-size: ${currentSettings.fontSize}px;
    z-index: 999999;
    max-width: 600px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: none;
    opacity: 0;
  `;
}

function hideOverlay() {
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
