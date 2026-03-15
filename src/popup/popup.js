document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const clearBtn = document.getElementById('clearCaptions');
  const languageSelect = document.getElementById('language');
  const autoDetectToggle = document.getElementById('autoDetect');
  const detectedBadge = document.getElementById('detectedLanguageBadge');
  const detectedText = document.getElementById('detectedLanguageText');
  const translateToSelect = document.getElementById('translateTo');
  const translationModelRow = document.getElementById('translationModelRow');
  const translationModelStatus = document.getElementById('translationModelStatus');
  const downloadBtn = document.getElementById('downloadTranslationModel');
  const downloadBtnLabel = document.getElementById('downloadBtnLabel');
  const progressBar = document.getElementById('translationModelProgress');
  const progressFill = document.getElementById('translationModelProgressFill');
  const displayModeRow = document.getElementById('displayModeRow');
  const modeTranslation = document.getElementById('modeTranslation');
  const modeOriginal = document.getElementById('modeOriginal');
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
  const resetPositionBtn = document.getElementById('resetPosition');

  const LANGUAGE_LABELS = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German',
    hi: 'Hindi', zh: 'Chinese', ar: 'Arabic', ja: 'Japanese',
    ko: 'Korean', pt: 'Portuguese', ru: 'Russian', it: 'Italian',
    nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish',
    no: 'Norwegian', da: 'Danish', fi: 'Finnish', id: 'Indonesian',
    th: 'Thai', ur: 'Urdu', bn: 'Bengali', vi: 'Vietnamese'
  };

  loadSettings();
  await checkCurrentState();
  syncTranslateOptions();
  bindEvents();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'detectedLanguage') showDetectedLanguage(message.language);
    if (message.action === 'translationModelProgress') handleTranslationProgress(message.progress);
    if (message.action === 'translationModelReady') handleTranslationModelReady(message.pairKey);
    if (message.action === 'translationModelError') handleTranslationModelError(message.pairKey);
  });

  function bindEvents() {
    autoDetectToggle.addEventListener('change', () => {
      onAutoDetectChange();
      syncTranslateOptions();
    });
    languageSelect.addEventListener('change', syncTranslateOptions);
    translateToSelect.addEventListener('change', onTranslateToChange);
    downloadBtn.addEventListener('click', onDownloadModel);
    modeTranslation.addEventListener('click', () => setDisplayMode('translation'));
    modeOriginal.addEventListener('click', () => setDisplayMode('original'));
    startBtn.addEventListener('click', onStart);
    stopBtn.addEventListener('click', onStop);
    clearBtn.addEventListener('click', onClearCaptions);
    resetPositionBtn.addEventListener('click', onResetPosition);
    settingsToggle.addEventListener('click', onSettingsToggle);
    fontSizeSlider.addEventListener('input', () => { fontSizeValue.textContent = fontSizeSlider.value + 'px'; });
    bgOpacitySlider.addEventListener('input', () => { bgOpacityValue.textContent = bgOpacitySlider.value + '%'; });
    fontColorPicker.addEventListener('input', () => { fontColorValue.textContent = fontColorPicker.value.toUpperCase(); });
    bgColorPicker.addEventListener('input', () => { bgColorValue.textContent = bgColorPicker.value.toUpperCase(); });
    positionBtns.forEach((btn) => btn.addEventListener('click', () => {
      positionBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }));
    saveSettingsBtn.addEventListener('click', onSaveSettings);
  }

  function onAutoDetectChange() {
    const isAuto = autoDetectToggle.checked;
    languageSelect.style.display = isAuto ? 'none' : 'block';
    if (!isAuto) detectedBadge.style.display = 'none';
  }

  async function onTranslateToChange() {
    await updateTranslationModelUI();
  }

  async function onDownloadModel() {
    const pairKey = getTranslatePairKey();
    if (!pairKey) return;

    downloadBtn.disabled = true;
    downloadBtnLabel.textContent = 'Downloading…';
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    setModelStatus('Downloading model…', '');

    chrome.runtime.sendMessage({ action: 'loadTranslationModel', pairKey }, (response) => {
      if (!response?.success) {
        downloadBtn.disabled = false;
        downloadBtnLabel.textContent = 'Retry Download';
        progressBar.style.display = 'none';
        setModelStatus('Failed to start download', 'error');
      }
    });
  }

  function handleTranslationModelReady(pairKey) {
    if (pairKey !== getTranslatePairKey()) return;
    downloadBtn.style.display = 'none';
    progressBar.style.display = 'none';
    setModelStatus('Model ready', 'ready');
    displayModeRow.style.display = 'flex';
  }

  function handleTranslationModelError(pairKey) {
    if (pairKey !== getTranslatePairKey()) return;
    downloadBtn.disabled = false;
    downloadBtnLabel.textContent = 'Retry Download';
    progressBar.style.display = 'none';
    setModelStatus('Download failed', 'error');
  }

  async function onStart() {
    const options = buildTranscriptionOptions();

    if (options.translateTo) {
      const pairKey = getTranslatePairKey();
      const downloaded = await checkTranslationModelDownloaded(pairKey);
      if (!downloaded) {
        translationModelRow.style.display = 'flex';
        setModelStatus('Download the model first', 'error');
        return;
      }
    }

    updateStatus('loading', 'Initializing…');
    startBtn.disabled = true;

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) {
      updateStatus('ready', 'Ready to transcribe');
      startBtn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage({ action: 'startTranscription', tabId: tabs[0].id, options }, (response) => {
      if (response?.success) {
        updateStatus('transcribing', 'Transcribing live audio');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        clearBtn.style.display = 'flex';
      } else {
        startBtn.disabled = false;
        const msg = response?.error === 'NO_AUDIO_DETECTED' ? 'No audio detected' : 'Ready to transcribe';
        updateStatus('ready', msg);
      }
    });
  }

  function onStop() {
    updateStatus('loading', 'Stopping…');
    stopBtn.disabled = true;

    chrome.runtime.sendMessage({ action: 'stopTranscription' }, () => {
      updateStatus('ready', 'Ready to transcribe');
      stopBtn.style.display = 'none';
      clearBtn.style.display = 'none';
      startBtn.style.display = 'flex';
      startBtn.disabled = false;
      stopBtn.disabled = false;
      detectedBadge.style.display = 'none';
    });
  }

  function onClearCaptions() {
    chrome.storage.local.get(['activeTabId'], (result) => {
      if (result.activeTabId) {
        chrome.tabs.sendMessage(result.activeTabId, { action: 'clearCaptions' }).catch(() => {});
      }
    });
  }

  function onResetPosition() {
    chrome.storage.local.get(['activeTabId'], (result) => {
      if (result.activeTabId) {
        chrome.tabs.sendMessage(result.activeTabId, { action: 'resetCaptionPosition' }, () => {
          resetPositionBtn.textContent = '✓ Position Reset!';
          resetPositionBtn.style.background = 'rgba(16, 185, 129, 0.25)';
          resetPositionBtn.style.color = '#10b981';
          setTimeout(() => {
            resetPositionBtn.textContent = 'Reset Dragged Position';
            resetPositionBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            resetPositionBtn.style.color = '#f87171';
          }, 1500);
        });
      }
    });
  }

  function onSettingsToggle() {
    const isOpen = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isOpen ? 'none' : 'block';
    settingsToggle.classList.toggle('active');
  }

  function onSaveSettings() {
    const activePosition = document.querySelector('.position-btn.active');
    const settings = {
      fontSize: fontSizeSlider.value,
      fontFamily: fontFamilySelect.value,
      bgOpacity: bgOpacitySlider.value,
      fontColor: fontColorPicker.value,
      bgColor: bgColorPicker.value,
      position: activePosition?.dataset.position || 'bottom-right'
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
          chrome.tabs.sendMessage(result.activeTabId, { action: 'updateSettings', settings }).catch(() => {});
        }
      });
    });
  }

  function buildTranscriptionOptions() {
    return {
      autoDetect: autoDetectToggle.checked,
      language: languageSelect.value,
      translateTo: translateToSelect.value || null
    };
  }

  function getTranslatePairKey() {
    const target = translateToSelect.value;
    return target ? `en-${target}` : null;
  }

  function checkTranslationModelDownloaded(pairKey) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'checkTranslationModel', pairKey }, (response) => {
        resolve(response?.downloaded || false);
      });
    });
  }

  async function updateTranslationModelUI() {
    const target = translateToSelect.value;
    if (!target) {
      translationModelRow.style.display = 'none';
      displayModeRow.style.display = 'none';
      return;
    }

    const pairKey = `en-${target}`;
    translationModelRow.style.display = 'flex';
    downloadBtn.style.display = 'none';
    progressBar.style.display = 'none';
    setModelStatus('Checking…', '');

    const downloaded = await checkTranslationModelDownloaded(pairKey);
    if (downloaded) {
      setModelStatus('Model ready', 'ready');
      displayModeRow.style.display = 'flex';
    } else {
      setModelStatus('Model not downloaded', '');
      downloadBtnLabel.textContent = 'Download Model';
      downloadBtn.disabled = false;
      downloadBtn.style.display = 'inline-flex';
      displayModeRow.style.display = 'none';
    }
  }

  function setModelStatus(text, type) {
    translationModelStatus.textContent = text;
    translationModelStatus.className = 'model-status-text';
    if (type) translationModelStatus.classList.add(type);
  }

  function setDisplayMode(mode) {
    modeTranslation.classList.toggle('active', mode === 'translation');
    modeOriginal.classList.toggle('active', mode === 'original');

    chrome.storage.local.get(['activeTabId'], (result) => {
      if (result.activeTabId) {
        chrome.tabs.sendMessage(result.activeTabId, { action: 'setDisplayMode', mode }).catch(() => {});
      }
    });
  }

  function showDetectedLanguage(langCode) {
    const label = LANGUAGE_LABELS[langCode] || langCode.toUpperCase();
    detectedText.textContent = `Detected: ${label}`;
    detectedBadge.style.display = 'inline-flex';
  }

  function handleTranslationProgress(progress) {
    if (!progress) return;
    progressBar.style.display = 'block';
    progressFill.style.width = `${progress.progress ?? 0}%`;
  }

  async function checkCurrentState() {
    updateStatus('loading', 'Checking status…');

    chrome.storage.local.get(['isTranscribing', 'activeTabId', 'transcriptionOptions'], async (result) => {
      if (result.isTranscribing && result.activeTabId) {
        updateStatus('transcribing', 'Transcribing live audio');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        clearBtn.style.display = 'flex';
        stopBtn.disabled = false;

        const opts = result.transcriptionOptions || {};
        if (opts.autoDetect) {
          autoDetectToggle.checked = true;
          languageSelect.style.display = 'none';
        } else if (opts.language) {
          languageSelect.value = opts.language;
        }
        if (opts.translateTo) {
          translateToSelect.value = opts.translateTo;
          await updateTranslationModelUI();
        }
        syncTranslateOptions();
      } else {
        updateStatus('ready', 'Ready to transcribe');
        startBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        clearBtn.style.display = 'none';
        startBtn.disabled = false;
      }
    });
  }

  function loadSettings() {
    chrome.storage.local.get(['captionSettings'], (result) => {
      if (!result.captionSettings) return;
      const s = result.captionSettings;
      fontSizeSlider.value = s.fontSize || 16;
      fontSizeValue.textContent = (s.fontSize || 16) + 'px';
      fontFamilySelect.value = s.fontFamily || 'Arial, sans-serif';
      bgOpacitySlider.value = s.bgOpacity || 85;
      bgOpacityValue.textContent = (s.bgOpacity || 85) + '%';
      fontColorPicker.value = s.fontColor || '#FFFFFF';
      fontColorValue.textContent = s.fontColor || '#FFFFFF';
      bgColorPicker.value = s.bgColor || '#000000';
      bgColorValue.textContent = s.bgColor || '#000000';
      positionBtns.forEach((btn) => {
        btn.classList.remove('active');
        if (btn.dataset.position === (s.position || 'bottom-right')) btn.classList.add('active');
      });
    });
  }

  function updateStatus(state, message) {
    statusText.textContent = message;
    statusPill.className = 'status-pill';
    if (state === 'loading') statusPill.classList.add('loading');
    else if (state === 'transcribing') statusPill.classList.add('transcribing');
  }

  function syncTranslateOptions() {
    const sourceLang = autoDetectToggle.checked ? null : languageSelect.value;
    const currentTarget = translateToSelect.value;

    Array.from(translateToSelect.options).forEach((opt) => {
      if (!opt.value) return;
      opt.disabled = sourceLang && opt.value === sourceLang;
      if (opt.disabled && opt.value === 'en') return;
    });

    if (sourceLang && translateToSelect.value === sourceLang) {
      translateToSelect.value = '';
      updateTranslationModelUI();
    }
  }
});
