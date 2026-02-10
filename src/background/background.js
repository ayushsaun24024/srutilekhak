import ModelLoader from '../utils/modelLoader.js';

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-transcription') {
    handleToggleCommand();
  }
});

async function handleToggleCommand() {
  chrome.action.openPopup();
}

const modelLoader = new ModelLoader();
let isCurrentlyTranscribing = false;

// Load manifest on extension startup
modelLoader.loadManifest().then(() => {
  console.log('Model manifest ready');
}).catch(error => {
  console.error('Failed to load manifest:', error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTranscription') {
    handleStartTranscription(message, sendResponse);
    return true;
  }
  
  if (message.action === 'checkModel') {
    handleCheckModel(message, sendResponse);
    return true;
  }

  if (message.action === 'downloadModel') {
    handleDownloadModel(message, sendResponse);
    return true;
  }
  
  if (message.action === 'transcribeAudio') {
    handleTranscribeAudio(message, sendResponse);
    return true;
  }

  if (message.action === 'stopTranscription') {
    handleStopTranscription(message, sendResponse);
    return true;
  }

  if (message.action === 'processAudioBlob') {
    handleProcessAudioBlob(message, sendResponse);
    return true;
  }

  if (message.action === 'processTranscription') {
    handleProcessTranscription(message, sendResponse);
    return true;
  }

  return false;
});

async function handleStartTranscription(message, sendResponse) {
  try {
    if (isCurrentlyTranscribing) {
      sendResponse({ success: false, error: 'Already transcribing' });
      return;
    }
    
    isCurrentlyTranscribing = true;
    
    const ready = await ensureContentScript(message.tabId);
    if (ready) {
      chrome.tabs.sendMessage(message.tabId, {
        action: 'showLoading'
      }).catch(err => console.log('Could not show loading:', err));
    }
    
    await setupOffscreenDocument();
    
    chrome.runtime.sendMessage({
      action: 'loadModel',
      language: message.language
    }, async (response) => {
      if (!response || !response.success) {
        isCurrentlyTranscribing = false;
        sendResponse({ success: false, error: 'Failed to load model' });
        return;
      }
      
      chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          isCurrentlyTranscribing = false;
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        chrome.runtime.sendMessage({
          action: 'startAudioCapture',
          streamId: streamId
        }, (captureResponse) => {
          if (captureResponse && captureResponse.success) {
            chrome.storage.local.set({ 
              activeTabId: message.tabId,
              isTranscribing: true 
            });
            sendResponse({ success: true });
          } else {
            isCurrentlyTranscribing = false;
            sendResponse({ success: false, error: 'Failed to start audio capture' });
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Start transcription error:', error);
    isCurrentlyTranscribing = false;
    sendResponse({ success: false, error: error.message });
  }
}

async function setupOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenDocument = existingContexts.find(
    (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
  );
  
  if (!offscreenDocument) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Load and run models'
    });
  }
}

async function handleCheckModel(message, sendResponse) {
  try {
    const isDownloaded = await modelLoader.isModelDownloaded(message.language);
    sendResponse({ downloaded: isDownloaded });
  } catch (error) {
    console.error('Check model failed:', error);
    sendResponse({ downloaded: false });
  }
}

async function handleDownloadModel(message, sendResponse) {
  try {
    await modelLoader.downloadModel(message.language);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Download failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleTranscribeAudio(message, sendResponse) {
  sendResponse({ success: true });
}

async function handleStopTranscription(message, sendResponse) {
  try {
    isCurrentlyTranscribing = false;
    
    const { activeTabId } = await chrome.storage.local.get(['activeTabId']);
    
    // Hide overlay on tab
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, {
        action: 'hideOverlay'
      }).catch(err => console.log('Could not hide overlay:', err));
    }
    
    // Stop audio capture in offscreen
    chrome.runtime.sendMessage({
      action: 'stopAudioCapture'
    }, (response) => {
      chrome.storage.local.remove(['activeTabId', 'isTranscribing']);
      sendResponse({ success: true });
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleProcessAudioBlob(message, sendResponse) {
  try {
    const { activeTabId } = await chrome.storage.local.get(['activeTabId']);
    
    if (!activeTabId) {
      sendResponse({ success: false });
      return;
    }
    
    // Send to offscreen for transcription
    chrome.runtime.sendMessage({
      action: 'transcribeAudio',
      audioData: message.audioData
    }, (transcribeResponse) => {
      if (transcribeResponse && transcribeResponse.success) {
        // Send transcription to content script
        chrome.tabs.sendMessage(activeTabId, {
          action: 'displayTranscription',
          text: transcribeResponse.text
        }).then(() => {
          console.log('Transcription sent to tab');
        }).catch((err) => {
          console.log('Tab not ready, content script not loaded');
        });
      }
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Process audio error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content/content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 200));
      return true;
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      return false;
    }
  }
}

async function handleProcessTranscription(message, sendResponse) {
  try {
    const { activeTabId } = await chrome.storage.local.get(['activeTabId']);
    
    if (!activeTabId || !message.text) {
      sendResponse({ success: false });
      return;
    }
    
    // Ensure content script is ready
    const ready = await ensureContentScript(activeTabId);
    if (!ready) {
      sendResponse({ success: false });
      return;
    }
    
    chrome.tabs.sendMessage(activeTabId, {
      action: 'displayTranscription',
      text: message.text
    }).catch((err) => {
      console.log('Failed to send to tab:', err);
    });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Process transcription error:', error);
    sendResponse({ success: false });
  }
}

