let overlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let customPosition = null;
let currentSettings = {
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  bgOpacity: 85,
  fontColor: '#FFFFFF',
  bgColor: '#000000',
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

  if (message.action === 'showWarning') {
    showWarning(message.text, message.duration || 3000);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'showLoading') {
    showLoadingState();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'displayTranscription') {
    displayText(message.text, message.language || 'en');
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'hideOverlay') {
    hideOverlay();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'clearCaptions') {
    if (overlay) {
      overlay.textContent = '';
      overlay.style.display = 'none';
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'resetCaptionPosition') {
    customPosition = null;
    chrome.storage.local.remove(['customCaptionPosition'], () => {
      if (overlay) {
        applySettings();
      }
    });
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

function displayText(text, language = 'en') {
  if (!overlay) {
    createOverlay();
  }
  
  const rtlLanguages = ['ar'];
  overlay.style.direction = rtlLanguages.includes(language) ? 'rtl' : 'ltr';
  overlay.style.textAlign = rtlLanguages.includes(language) ? 'right' : 'left';
  overlay.textContent = text;
  overlay.style.opacity = '1';
  overlay.style.display = 'block';
}

function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'srutilekhak-overlay';
  applySettings();
  
  overlay.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  
  overlay.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', stopDrag);
  
  document.body.appendChild(overlay);
  
  chrome.storage.local.get(['customCaptionPosition'], (result) => {
    if (result.customCaptionPosition) {
      customPosition = result.customCaptionPosition;
      applySettings();
    }
  });
}

function startDrag(e) {
  if (e.target !== overlay) return;
  
  isDragging = true;
  overlay.style.cursor = 'grabbing';
  
  const rect = overlay.getBoundingClientRect();
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  
  dragOffset.x = clientX - rect.left;
  dragOffset.y = clientY - rect.top;
  
  if (e.type.includes('touch')) {
    e.preventDefault();
  }
}

function drag(e) {
  if (!isDragging) return;
  
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  
  let newLeft = clientX - dragOffset.x;
  let newTop = clientY - dragOffset.y;
  
  const maxLeft = window.innerWidth - overlay.offsetWidth;
  const maxTop = window.innerHeight - overlay.offsetHeight;
  
  newLeft = Math.max(0, Math.min(newLeft, maxLeft));
  newTop = Math.max(0, Math.min(newTop, maxTop));
  
  overlay.style.left = newLeft + 'px';
  overlay.style.top = newTop + 'px';
  overlay.style.bottom = 'auto';
  overlay.style.right = 'auto';
  overlay.style.transform = 'none';
  
  if (e.type.includes('touch')) {
    e.preventDefault();
  }
}

function stopDrag(e) {
  if (!isDragging) return;
  
  isDragging = false;
  overlay.style.cursor = 'move';
  
  customPosition = {
    top: parseInt(overlay.style.top),
    left: parseInt(overlay.style.left)
  };
  
  chrome.storage.local.set({ customCaptionPosition: customPosition });
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
  
  const bgOpacity = (currentSettings.bgOpacity / 100).toFixed(2);
  
  const bgColor = currentSettings.bgColor || '#000000';
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);
  
  let positionStyles = '';
  
  if (customPosition) {
    positionStyles = `
      top: ${customPosition.top}px;
      left: ${customPosition.left}px;
      bottom: auto;
      right: auto;
      transform: none;
    `;
  } else {
    const pos = positions[currentSettings.position] || positions['bottom-left'];
    positionStyles = `
      ${pos.top ? `top: ${pos.top};` : ''}
      ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
      ${pos.left ? `left: ${pos.left};` : ''}
      ${pos.right ? `right: ${pos.right};` : ''}
      ${pos.transform ? `transform: ${pos.transform};` : ''}
    `;
  }
  
  overlay.style.cssText = `
    position: fixed;
    ${positionStyles}
    background: rgba(${r}, ${g}, ${b}, ${bgOpacity});
    color: ${currentSettings.fontColor || '#FFFFFF'};
    padding: 12px 18px;
    border-radius: 8px;
    font-family: ${currentSettings.fontFamily};
    font-size: ${currentSettings.fontSize}px;
    z-index: 999999;
    max-width: 600px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: none;
    opacity: 0;
    cursor: move;
    user-select: none;
  `;
}

function hideOverlay() {
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.removeEventListener('mousedown', startDrag);
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        overlay.removeEventListener('touchstart', startDrag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);
        
        overlay.parentNode.removeChild(overlay);
        overlay = null;
      }
    }, 300);
  }
}

function showWarning(message, duration = 3000) {
  if (!overlay) {
    createOverlay();
  }
  
  overlay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">⚠️</span>
      <span>${message}</span>
    </div>
  `;
  
  overlay.style.opacity = '1';
  overlay.style.display = 'block';
  
  setTimeout(() => {
    hideOverlay();
  }, duration);
}
