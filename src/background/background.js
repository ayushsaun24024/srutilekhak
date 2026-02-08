import ModelLoader from '../utils/modelLoader.js';

console.log('Śrutilekhak background service worker loaded');

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
    // Prevent duplicate starts
    if (isCurrentlyTranscribing) {
      console.log('Already transcribing, ignoring duplicate start');
      sendResponse({ success: false, error: 'Already transcribing' });
      return;
    }
    
    console.log(`Starting transcription for tab ${message.tabId} in ${message.language}`);
    
    const isDownloaded = await modelLoader.isModelDownloaded(message.language);
    
    if (!isDownloaded) {
      sendResponse({ 
        success: false, 
        error: 'Model not downloaded. Please download language pack first.' 
      });
      return;
    }
    
    isCurrentlyTranscribing = true; // SET STATE
    
    // Create offscreen document
    await setupOffscreenDocument();
    
    // Load model in offscreen
    chrome.runtime.sendMessage({
      action: 'loadModel',
      language: message.language
    }, async (response) => {
      if (!response || !response.success) {
        isCurrentlyTranscribing = false; // RESET STATE
        sendResponse({ success: false, error: 'Failed to load model' });
        return;
      }
      
      console.log('Model loaded, capturing tab audio...');
      
      // Get stream ID for tab audio capture
      chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          isCurrentlyTranscribing = false; // RESET STATE
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        // Tell offscreen to start capturing audio
        chrome.runtime.sendMessage({
          action: 'startAudioCapture',
          streamId: streamId
        }, (captureResponse) => {
          if (captureResponse && captureResponse.success) {
            console.log('Audio capture started');
            chrome.storage.local.set({ 
              activeTabId: message.tabId,
              isTranscribing: true 
            });
            sendResponse({ success: true });
          } else {
            isCurrentlyTranscribing = false; // RESET STATE
            sendResponse({ success: false, error: 'Failed to start audio capture' });
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Start transcription error:', error);
    isCurrentlyTranscribing = false; // RESET STATE
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
      justification: 'Load and run Moonshine models'
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
  console.log('Received audio chunk for transcription');
  sendResponse({ success: true });
}

async function handleStopTranscription(message, sendResponse) {
  try {
    isCurrentlyTranscribing = false;
    
    chrome.runtime.sendMessage({
      action: 'stopAudioCapture'
    }, (response) => {
      chrome.storage.local.remove(['activeTabId', 'isTranscribing']);
      console.log('Transcription stopped');
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
    
    console.log('Processing audio blob...');
    
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
      console.log('Content script injected');
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
      console.log('Content script not ready');
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

