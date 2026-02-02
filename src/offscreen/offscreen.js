import MoonshineProcessor from '../utils/moonshineProcessor.js';

const moonshine = new MoonshineProcessor();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen received:', message.action);
  
  if (message.action === 'loadModel') {
    loadModel(message.language, sendResponse);
    return true;
  }
  
  if (message.action === 'transcribeAudio') {
    transcribeAudio(message.audioData, sendResponse);
    return true;
  }
});

async function loadModel(language, sendResponse) {
  try {
    await moonshine.loadModel(language);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Model load error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function transcribeAudio(audioData, sendResponse) {
  try {
    console.log('Transcribing in offscreen...');
    const text = await moonshine.transcribe(audioData);
    console.log('Transcription result:', text);
    sendResponse({ success: true, text: text });
  } catch (error) {
    console.error('Transcription error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
