document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const languageSelect = document.getElementById('language');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');
  const fontSizeSlider = document.getElementById('fontSize');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const fontFamilySelect = document.getElementById('fontFamily');
  const bgOpacitySlider = document.getElementById('bgOpacity');
  const bgOpacityValue = document.getElementById('bgOpacityValue');
  const positionBtns = document.querySelectorAll('.position-btn');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const fontColorPicker = document.getElementById('fontColor');
  const fontColorValue = document.getElementById('fontColorValue');
  const bgColorPicker = document.getElementById('bgColor');
  const bgColorValue = document.getElementById('bgColorValue');
  const clearBtn = document.getElementById('clearCaptions');

  loadSettings();
  checkCurrentState();

  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isOpen ? 'none' : 'block';
    settingsToggle.classList.toggle('active');
  });

  fontSizeSlider.addEventListener('input', (e) => {
    fontSizeValue.textContent = e.target.value + 'px';
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.get(['activeTabId'], (result) => {
      if (result.activeTabId) {
        chrome.tabs.sendMessage(result.activeTabId, {
          action: 'clearCaptions'
        }).catch(() => {});
      }
    });
  });

  bgOpacitySlider.addEventListener('input', (e) => {
    bgOpacityValue.textContent = e.target.value + '%';
  });

  fontColorPicker.addEventListener('input', (e) => {
    fontColorValue.textContent = e.target.value.toUpperCase();
  });

  bgColorPicker.addEventListener('input', (e) => {
    bgColorValue.textContent = e.target.value.toUpperCase();
  });

  positionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      positionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  saveSettingsBtn.addEventListener('click', () => {
    const activePosition = document.querySelector('.position-btn.active');
    const settings = {
      fontSize: fontSizeSlider.value,
      fontFamily: fontFamilySelect.value,
      bgOpacity: bgOpacitySlider.value,
      fontColor: document.getElementById('fontColor').value,
      bgColor: document.getElementById('bgColor').value,
      position: activePosition ? activePosition.dataset.position : 'bottom-right'
    };

    chrome.storage.local.set({ captionSettings: settings }, () => {
      saveSettingsBtn.textContent = '✓ Saved!';
      saveSettingsBtn.style.background = 'rgba(16, 185, 129, 0.4)';
      
      setTimeout(() => {
        saveSettingsBtn.textContent = 'Save Settings';
        saveSettingsBtn.style.background = 'rgba(16, 185, 129, 0.2)';
      }, 1500);
      
      chrome.storage.local.get(['activeTabId'], (result) => {
        if (result.activeTabId) {
          chrome.tabs.sendMessage(result.activeTabId, {
            action: 'updateSettings',
            settings: settings
          }).catch(() => {});
        }
      });
    });
  });

  function loadSettings() {
    chrome.storage.local.get(['captionSettings'], (result) => {
      if (result.captionSettings) {
        const settings = result.captionSettings;
        fontSizeSlider.value = settings.fontSize || 16;
        fontSizeValue.textContent = (settings.fontSize || 16) + 'px';
        fontFamilySelect.value = settings.fontFamily || 'Arial, sans-serif';
        bgOpacitySlider.value = settings.bgOpacity || 85;
        bgOpacityValue.textContent = (settings.bgOpacity || 85) + '%';
        
        const fontColor = settings.fontColor || '#FFFFFF';
        const bgColor = settings.bgColor || '#000000';
        document.getElementById('fontColor').value = fontColor;
        document.getElementById('fontColorValue').textContent = fontColor;
        document.getElementById('bgColor').value = bgColor;
        document.getElementById('bgColorValue').textContent = bgColor;
        
        positionBtns.forEach(btn => {
          btn.classList.remove('active');
          if (btn.dataset.position === (settings.position || 'bottom-right')) {
            btn.classList.add('active');
          }
        });
      }
    });
  }

  startBtn.addEventListener('click', async () => {
    const language = languageSelect.value;
    
    updateStatus('loading', 'Initializing...');
    startBtn.disabled = true;
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs[0]) {
      updateStatus('ready', 'Ready to transcribe');
      startBtn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage({
      action: 'startTranscription',
      tabId: tabs[0].id,
      language: language
    }, (response) => {
      if (response && response.success) {
        updateStatus('transcribing', 'Transcribing live audio');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        clearBtn.style.display = 'flex';
      } else {
        updateStatus('ready', 'Ready to transcribe');
        startBtn.disabled = false;
        
        if (response && response.error === 'NO_AUDIO_DETECTED') {
          console.log('No audio playing in tab');
        }
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    updateStatus('loading', 'Stopping...');
    stopBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      action: 'stopTranscription'
    }, (response) => {
      if (response && response.success) {
        updateStatus('ready', 'Ready to transcribe');
        stopBtn.style.display = 'none';
        clearBtn.style.display = 'none';
        startBtn.style.display = 'flex';
        startBtn.disabled = false;
        stopBtn.disabled = false;
      } else {
        updateStatus('ready', 'Ready to transcribe');
        stopBtn.disabled = false;
      }
    });
  });

  async function checkCurrentState() {
    updateStatus('loading', 'Checking status...');
    
    chrome.storage.local.get(['isTranscribing', 'activeTabId'], (result) => {
      if (result.isTranscribing && result.activeTabId) {
        updateStatus('transcribing', 'Transcribing live audio');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        clearBtn.style.display = 'flex';
        stopBtn.disabled = false;
      } else {
        updateStatus('ready', 'Ready to transcribe');
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        clearBtn.style.display = 'none';
        startBtn.disabled = false;
      }
    });
  }

  function updateStatus(state, message) {
    statusText.textContent = message;
    statusPill.className = 'status-pill';
    
    if (state === 'loading') {
      statusPill.classList.add('loading');
    } else if (state === 'transcribing') {
      statusPill.classList.add('transcribing');
    }
  }
});
