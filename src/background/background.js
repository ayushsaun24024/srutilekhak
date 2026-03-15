import ModelLoader from '../utils/modelLoader.js';

const modelLoader = new ModelLoader();
let isCurrentlyTranscribing = false;

modelLoader.loadManifest().catch(() => {});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-transcription') chrome.action.openPopup();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    startTranscription:       () => handleStartTranscription(message, sendResponse),
    stopTranscription:        () => handleStopTranscription(message, sendResponse),
    processTranscription:     () => handleProcessTranscription(message, sendResponse),
    checkModel:               () => handleCheckModel(sendResponse),
    downloadModel:            () => handleDownloadModel(sendResponse),
    checkTranslationModel:    () => handleCheckTranslationModel(message, sendResponse),
    loadTranslationModel:     () => handleLoadTranslationModel(message, sendResponse),
    unloadTranslationModel:   () => handleUnloadTranslationModel(message, sendResponse),
    getTranslationModels:     () => handleGetTranslationModels(sendResponse),
    translationModelProgress: () => handleTranslationModelProgress(message, sendResponse),
    translationModelReady: () => handleTranslationModelReady(message, sendResponse),
    translationModelError: () => handleTranslationModelError(message, sendResponse),
  };

  if (handlers[message.action]) {
    handlers[message.action]();
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['activeTabId', 'isTranscribing'], (result) => {
    if (result.activeTabId === tabId && result.isTranscribing) {
      isCurrentlyTranscribing = false;
      chrome.runtime.sendMessage({ action: 'stopAudioCapture' }, () => {});
      chrome.storage.local.remove(['activeTabId', 'isTranscribing', 'transcriptionOptions']);
      setBadge(false);
    }
  });
});

function setBadge(isRecording) {
  if (isRecording) {
    chrome.action.setBadgeText({ text: '●' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function setupOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({});
  const exists = contexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT');
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Load and run transcription/translation models'
    });
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return true;
    } catch {
      return false;
    }
  }
}

async function handleStartTranscription(message, sendResponse) {
  try {
    if (isCurrentlyTranscribing) {
      sendResponse({ success: false, error: 'Already transcribing' });
      return;
    }

    isCurrentlyTranscribing = true;

    const options = {
      autoDetect: message.options?.autoDetect ?? false,
      language: message.options?.language || 'en',
      translateTo: message.options?.translateTo || null
    };

    const ready = await ensureContentScript(message.tabId);
    if (ready) {
      chrome.tabs.sendMessage(message.tabId, { action: 'showLoading' }).catch(() => {});
    }

    await setupOffscreenDocument();

    chrome.runtime.sendMessage({ action: 'loadModel' }, async (modelResponse) => {
      if (!modelResponse?.success) {
        isCurrentlyTranscribing = false;
        chrome.tabs.sendMessage(message.tabId, {
          action: 'showWarning',
          text: 'Failed to load transcription model'
        }).catch(() => {});
        sendResponse({ success: false, error: 'Failed to load model' });
        return;
      }

      chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          isCurrentlyTranscribing = false;
          chrome.tabs.sendMessage(message.tabId, {
            action: 'showWarning',
            text: 'Could not capture tab audio'
          }).catch(() => {});
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        chrome.runtime.sendMessage({ action: 'startAudioCapture', streamId, options }, (captureResponse) => {
          if (captureResponse?.success) {
            chrome.storage.local.set({
              activeTabId: message.tabId,
              isTranscribing: true,
              transcriptionOptions: options
            });
            setBadge(true);
            sendResponse({ success: true });
          } else {
            isCurrentlyTranscribing = false;
            chrome.storage.local.remove(['activeTabId', 'isTranscribing', 'transcriptionOptions']);
            setBadge(false);

            const errorText = captureResponse?.error === 'NO_AUDIO_DETECTED'
              ? 'No audio detected in this tab'
              : 'Failed to start audio capture';

            chrome.tabs.sendMessage(message.tabId, { action: 'showWarning', text: errorText }).catch(() => {});
            sendResponse({ success: false, error: captureResponse?.error || 'Failed to start audio capture' });
          }
        });
      });
    });

  } catch (error) {
    isCurrentlyTranscribing = false;
    chrome.storage.local.remove(['activeTabId', 'isTranscribing', 'transcriptionOptions']);
    setBadge(false);
    chrome.tabs.sendMessage(message.tabId, {
      action: 'showWarning',
      text: 'Error starting transcription'
    }).catch(() => {});
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopTranscription(message, sendResponse) {
  try {
    isCurrentlyTranscribing = false;
    const { activeTabId } = await chrome.storage.local.get(['activeTabId']);

    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'hideOverlay' }).catch(() => {});
    }

    chrome.runtime.sendMessage({ action: 'stopAudioCapture' }, () => {
      chrome.storage.local.remove(['activeTabId', 'isTranscribing', 'transcriptionOptions']);
      setBadge(false);
      sendResponse({ success: true });
    });
  } catch (error) {
    isCurrentlyTranscribing = false;
    chrome.storage.local.remove(['activeTabId', 'isTranscribing', 'transcriptionOptions']);
    setBadge(false);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleProcessTranscription(message, sendResponse) {
  try {
    const { activeTabId } = await chrome.storage.local.get(['activeTabId']);
    if (!activeTabId || !message.text) {
      sendResponse({ success: false });
      return;
    }

    const ready = await ensureContentScript(activeTabId);
    if (!ready) {
      sendResponse({ success: false });
      return;
    }

    const { transcriptionOptions } = await chrome.storage.local.get(['transcriptionOptions']);

    chrome.tabs.sendMessage(activeTabId, {
      action: 'displayTranscription',
      text: message.text,
      detectedLanguage: message.detectedLanguage || null,
      translatedText: message.translatedText || null,
      options: transcriptionOptions || {}
    }).catch(() => {});

    if (message.detectedLanguage) {
      notifyPopup({ action: 'detectedLanguage', language: message.detectedLanguage });
    }

    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false });
  }
}

async function handleCheckModel(sendResponse) {
  try {
    const downloaded = await modelLoader.isWhisperDownloaded();
    sendResponse({ downloaded });
  } catch {
    sendResponse({ downloaded: false });
  }
}

async function handleDownloadModel(sendResponse) {
  try {
    await modelLoader.downloadWhisperModel();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckTranslationModel(message, sendResponse) {
  try {
    const downloaded = await modelLoader.isTranslationModelDownloaded(message.pairKey);
    sendResponse({ downloaded });
  } catch {
    sendResponse({ downloaded: false });
  }
}

async function handleLoadTranslationModel(message, sendResponse) {
  try {
    const info = await modelLoader.getTranslationModelInfo(message.pairKey);
    if (!info) {
      sendResponse({ success: false, error: 'Model not found in manifest' });
      return;
    }

    await setupOffscreenDocument();

    chrome.runtime.sendMessage({
      action: 'loadTranslationModel',
      pairKey: message.pairKey,
      modelId: info.modelId
    }, () => {});

    sendResponse({ success: true, status: 'downloading' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleUnloadTranslationModel(message, sendResponse) {
  try {
    chrome.runtime.sendMessage({ action: 'unloadTranslationModel', pairKey: message.pairKey }, () => {});
    await modelLoader.removeTranslationModel(message.pairKey);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetTranslationModels(sendResponse) {
  try {
    const all = await modelLoader.getAllTranslationModels();
    const downloaded = await modelLoader.getAllDownloadedTranslationModels();
    sendResponse({ success: true, models: all, downloaded });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

function handleTranslationModelProgress(message, sendResponse) {
  notifyPopup({
    action: 'translationModelProgress',
    pairKey: message.pairKey,
    progress: message.progress
  });
  sendResponse({ success: true });
}

function notifyPopup(message) {
  chrome.runtime.getContexts({ contextTypes: ['POPUP'] })
    .then((contexts) => {
      if (contexts.length > 0) {
        chrome.runtime.sendMessage(message).catch(() => {});
      }
    })
    .catch(() => {});
}

async function handleTranslationModelReady(message, sendResponse) {
  try {
    await modelLoader.markTranslationModelReady(message.pairKey);
    notifyPopup({ action: 'translationModelReady', pairKey: message.pairKey });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false });
  }
}

function handleTranslationModelError(message, sendResponse) {
  notifyPopup({
    action: 'translationModelError',
    pairKey: message.pairKey,
    error: message.error
  });
  sendResponse({ success: true });
}
