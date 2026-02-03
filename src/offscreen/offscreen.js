import MoonshineProcessor from '../utils/moonshineProcessor.js';

const moonshine = new MoonshineProcessor();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen received:', message.action);
  
  if (message.action === 'loadModel') {
    loadModel(message.language, sendResponse);
    return true;
  }
  
  if (message.action === 'startAudioCapture') {
    startAudioCapture(message.streamId, sendResponse);
    return true;
  }
  
  if (message.action === 'stopAudioCapture') {
    stopAudioCapture(sendResponse);
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

async function startAudioCapture(streamId, sendResponse) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    console.log('Audio stream obtained');
    
    // Create audio context to process without muting
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create destination to keep audio playing
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    
    // Also connect to speakers so audio isn't muted
    source.connect(audioContext.destination);
    
    // Create MediaRecorder from destination stream
    mediaRecorder = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    audioChunks = [];
    isRecording = true;
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && isRecording) {
        console.log(`Audio chunk: ${event.data.size} bytes`);
        const audioBlob = new Blob([event.data], { type: 'audio/webm' });
        
        // Send immediately for transcription
        chrome.runtime.sendMessage({
          action: 'processAudioBlob',
          audioData: await blobToBase64(audioBlob)
        });
      }
    };
    
    // Capture continuously, request data every 3 seconds
    mediaRecorder.start();
    
    const chunkInterval = setInterval(() => {
      if (isRecording && mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      } else {
        clearInterval(chunkInterval);
      }
    }, 3000);
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Audio capture error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function stopAudioCapture(sendResponse) {
  isRecording = false;
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  mediaRecorder = null;
  audioChunks = [];
  
  console.log('Audio capture stopped');
  sendResponse({ success: true });
}

async function transcribeAudio(audioData, sendResponse) {
  try {
    console.log('Transcribing audio data...');
    const text = await moonshine.transcribe(audioData);
    console.log('Transcription result:', text);
    sendResponse({ success: true, text: text });
  } catch (error) {
    console.error('Transcription error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
