let overlay = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let customPosition = null;
let currentDisplayMode = 'translation';
let lastResult = null;

let currentSettings = {
  fontSize: 16,
  fontFamily: 'Arial, sans-serif',
  bgOpacity: 85,
  fontColor: '#FFFFFF',
  bgColor: '#000000',
  position: 'bottom-left'
};

const RTL_LANGUAGES = new Set(['ar', 'ur', 'he', 'fa']);

chrome.storage.local.get(['captionSettings'], (result) => {
  if (result.captionSettings) currentSettings = result.captionSettings;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    ping:               () => sendResponse({ success: true }),
    showWarning:        () => { showWarning(message.text, message.duration || 3000); sendResponse({ success: true }); },
    showLoading:        () => { showLoadingState(); sendResponse({ success: true }); },
    hideOverlay:        () => { hideOverlay(); sendResponse({ success: true }); },
    updateSettings:     () => { currentSettings = message.settings; if (overlay) applySettings(); sendResponse({ success: true }); },
    clearCaptions:      () => { if (overlay) { overlay.innerHTML = ''; overlay.style.display = 'none'; } sendResponse({ success: true }); },
    resetCaptionPosition: () => {
      customPosition = null;
      chrome.storage.local.remove(['customCaptionPosition'], () => { if (overlay) applySettings(); });
      sendResponse({ success: true });
    },
    displayTranscription: () => {
      lastResult = {
        text: message.text,
        detectedLanguage: message.detectedLanguage || null,
        translatedText: message.translatedText || null,
        options: message.options || {}
      };
      renderResult(lastResult);
      sendResponse({ success: true });
    },
    setDisplayMode: () => {
      currentDisplayMode = message.mode || 'translation';
      if (lastResult) renderResult(lastResult);
      sendResponse({ success: true });
    }
  };

  if (handlers[message.action]) {
    handlers[message.action]();
    return true;
  }
});

function renderResult(result) {
  const { text, detectedLanguage, translatedText, options } = result;
  const showTranslation = currentDisplayMode === 'translation' && !!translatedText;
  const displayText = showTranslation ? translatedText : text;
  const activeLang = showTranslation
    ? (options.translateTo || 'en')
    : (detectedLanguage || options.language || 'en');

  if (!displayText) return;

  if (!overlay) createOverlay();

  injectStyles();

  const isRTL = RTL_LANGUAGES.has(activeLang);
  overlay.style.direction = isRTL ? 'rtl' : 'ltr';
  overlay.style.textAlign = isRTL ? 'right' : 'left';

  const chipHTML = detectedLanguage
    ? `<div class="sl-lang-chip">${detectedLanguage.toUpperCase()}</div>`
    : '';

  overlay.innerHTML = `
    ${chipHTML}
    <div class="sl-caption-text">${escapeHTML(displayText)}</div>
  `;

  overlay.style.opacity = '1';
  overlay.style.display = 'block';
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showLoadingState() {
  if (!overlay) createOverlay();
  injectStyles();

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="sl-spinner"></div>
      <span>Starting transcription…</span>
    </div>
  `;

  overlay.style.opacity = '0';
  overlay.style.display = 'block';
  setTimeout(() => { overlay.style.opacity = '1'; }, 10);
}

function showWarning(message, duration = 3000) {
  if (!overlay) createOverlay();
  injectStyles();

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">⚠️</span>
      <span>${escapeHTML(message)}</span>
    </div>
  `;

  overlay.style.opacity = '1';
  overlay.style.display = 'block';
  setTimeout(() => hideOverlay(), duration);
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

function injectStyles() {
  if (document.getElementById('srutilekhak-style')) return;
  const style = document.createElement('style');
  style.id = 'srutilekhak-style';
  style.textContent = `
    @keyframes sl-spin { to { transform: rotate(360deg); } }
    #srutilekhak-overlay { transition: opacity 0.3s ease-in-out; }
    .sl-spinner {
      width: 16px; height: 16px; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: sl-spin 1s linear infinite;
    }
    .sl-lang-chip {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 2px 7px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      margin-bottom: 5px;
      opacity: 0.75;
    }
    .sl-caption-text {
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

function applySettings() {
  if (!overlay) return;

  const positions = {
    'top-left':      { top: '20px',  left: '20px',  bottom: 'auto', right: 'auto' },
    'top-center':    { top: '20px',  left: '50%',   bottom: 'auto', right: 'auto', transform: 'translateX(-50%)' },
    'top-right':     { top: '20px',  right: '20px', bottom: 'auto', left: 'auto' },
    'bottom-left':   { bottom: '20px', left: '20px',  top: 'auto', right: 'auto' },
    'bottom-center': { bottom: '20px', left: '50%',   top: 'auto', right: 'auto', transform: 'translateX(-50%)' },
    'bottom-right':  { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
  };

  const bgOpacity = (currentSettings.bgOpacity / 100).toFixed(2);
  const bgColor = currentSettings.bgColor || '#000000';
  const r = parseInt(bgColor.slice(1, 3), 16);
  const g = parseInt(bgColor.slice(3, 5), 16);
  const b = parseInt(bgColor.slice(5, 7), 16);

  let positionCSS = '';
  if (customPosition) {
    positionCSS = `top:${customPosition.top}px;left:${customPosition.left}px;bottom:auto;right:auto;transform:none;`;
  } else {
    const pos = positions[currentSettings.position] || positions['bottom-left'];
    positionCSS = [
      pos.top    ? `top:${pos.top};`       : '',
      pos.bottom ? `bottom:${pos.bottom};` : '',
      pos.left   ? `left:${pos.left};`     : '',
      pos.right  ? `right:${pos.right};`   : '',
      pos.transform ? `transform:${pos.transform};` : ''
    ].join('');
  }

  overlay.style.cssText = `
    position:fixed;
    ${positionCSS}
    background:rgba(${r},${g},${b},${bgOpacity});
    color:${currentSettings.fontColor || '#FFFFFF'};
    padding:12px 18px;
    border-radius:8px;
    font-family:${currentSettings.fontFamily};
    font-size:${currentSettings.fontSize}px;
    z-index:999999;
    max-width:600px;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);
    display:none;
    opacity:0;
    cursor:move;
    user-select:none;
  `;
}

function hideOverlay() {
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => {
    if (!overlay?.parentNode) return;
    overlay.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    overlay.removeEventListener('touchstart', startDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
    overlay.parentNode.removeChild(overlay);
    overlay = null;
    lastResult = null;
  }, 300);
}

function startDrag(e) {
  if (e.target !== overlay && !overlay.contains(e.target)) return;
  isDragging = true;
  overlay.style.cursor = 'grabbing';
  const rect = overlay.getBoundingClientRect();
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  dragOffset.x = clientX - rect.left;
  dragOffset.y = clientY - rect.top;
  if (e.type.includes('touch')) e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
  const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
  let newLeft = Math.max(0, Math.min(clientX - dragOffset.x, window.innerWidth - overlay.offsetWidth));
  let newTop = Math.max(0, Math.min(clientY - dragOffset.y, window.innerHeight - overlay.offsetHeight));
  overlay.style.left = newLeft + 'px';
  overlay.style.top = newTop + 'px';
  overlay.style.bottom = 'auto';
  overlay.style.right = 'auto';
  overlay.style.transform = 'none';
  if (e.type.includes('touch')) e.preventDefault();
}

function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
  overlay.style.cursor = 'move';
  customPosition = { top: parseInt(overlay.style.top), left: parseInt(overlay.style.left) };
  chrome.storage.local.set({ customCaptionPosition: customPosition });
}
