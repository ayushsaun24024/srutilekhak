import ModelLoader from '../utils/modelLoader.js';

console.log('Śrutilekhak background service worker loaded');

const modelLoader = new ModelLoader();

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
  
  if (message.action === 'stopTranscription') {
    console.log('Stopping transcription');
    sendResponse({ success: true });
    return false;
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

  
  return false;
});

async function handleStartTranscription(message, sendResponse) {
  try {
    console.log(`Starting transcription for tab ${message.tabId} in ${message.language}`);
    
    const isDownloaded = await modelLoader.isModelDownloaded(message.language);
    
    if (!isDownloaded) {
      sendResponse({ 
        success: false, 
        error: 'Model not downloaded. Please download language pack first.' 
      });
      return;
    }
    
    // Create offscreen document
    await setupOffscreenDocument();
    
    // Load model in offscreen
    chrome.runtime.sendMessage({
      action: 'loadModel',
      language: message.language
    }, (response) => {
      if (!response || !response.success) {
        sendResponse({ success: false, error: 'Failed to load model' });
        return;
      }
      
      console.log('Model loaded in offscreen');
      chrome.storage.local.set({ activeTabId: message.tabId });
      
      let counter = 0;
      const intervalId = setInterval(() => {
        counter++;
        console.log(`Requesting transcription ${counter}...`);
        
        chrome.runtime.sendMessage({
          action: 'transcribeAudio',
          audioData: null
        }, (transcribeResponse) => {
          console.log('Transcription response:', transcribeResponse);
          
          if (transcribeResponse && transcribeResponse.success) {
            console.log(`Sending to tab ${message.tabId}:`, transcribeResponse.text);
            
            chrome.tabs.sendMessage(message.tabId, {
              action: 'displayTranscription',
              text: `[${counter}] ${transcribeResponse.text}`
            }).catch((err) => {
              console.error('Failed to send to tab:', err);
              clearInterval(intervalId);
            });
          }
        });
      }, 5000);
      
      chrome.storage.local.set({ transcriptionInterval: intervalId });
      sendResponse({ success: true });
    });
    
  } catch (error) {
    console.error('Start transcription error:', error);
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
    const result = await chrome.storage.local.get(['transcriptionInterval']);
    if (result.transcriptionInterval) {
      clearInterval(result.transcriptionInterval);
      chrome.storage.local.remove(['transcriptionInterval', 'activeTabId']);
    }
    
    console.log('Transcription stopped');
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

