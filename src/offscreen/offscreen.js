import MoonshineProcessor from '../utils/moonshineProcessor.js';

const moonshine = new MoonshineProcessor();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null; // ADD THIS
let audioStream = null; // ADD THIS

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
    // Prevent duplicate starts
    if (isRecording || mediaRecorder) {
      console.log('Stopping existing capture before starting new one');
      await stopAudioCapture(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    audioStream = stream;
    console.log('Audio stream obtained');
    
    // Create audio element to play captured audio
    const audioElement = document.createElement('audio');
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.volume = 1.0;
    document.body.appendChild(audioElement);
    
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    
    isRecording = true;
    let isTranscribing = false;
    let recordingCycle = 0;
    
    // Function to start a fresh recording cycle
    const startRecordingCycle = () => {
      if (!isRecording) return;
      
      recordingCycle++;
      console.log(`Starting recording cycle ${recordingCycle}`);
      
      mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunks = [];
      let chunkCount = 0;
      const maxChunksPerCycle = 4; // 20 seconds per cycle
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && isRecording) {
          audioChunks.push(event.data);
          chunkCount++;
          
          console.log(`Audio chunk: ${event.data.size} bytes, total chunks: ${audioChunks.length}`);
          
          // Transcribe when we have 2+ chunks
          if (!isTranscribing && audioChunks.length >= 2) {
            isTranscribing = true;
            
            const fullBlob = new Blob([...audioChunks], { type: 'audio/webm' });
            const audioData = await blobToBase64(fullBlob);
            
            transcribeAudio(audioData, (response) => {
              if (response.success && response.text) {
                chrome.runtime.sendMessage({
                  action: 'processTranscription',
                  text: response.text
                }).catch(err => console.log('Failed to send transcription:', err));
              }
              isTranscribing = false;
            });
          }
          
          // After 4 chunks (20 seconds), stop and restart for fresh headers
          if (chunkCount >= maxChunksPerCycle) {
            console.log('Cycle complete, restarting recorder for fresh headers');
            mediaRecorder.stop();
          }
        }
      };
      
      mediaRecorder.onstop = () => {
        if (isRecording) {
          // Start a new recording cycle with fresh headers
          setTimeout(() => startRecordingCycle(), 100);
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        if (isRecording) {
          setTimeout(() => startRecordingCycle(), 500);
        }
      };
      
      mediaRecorder.start();
      
      // Request data every 5 seconds
      const chunkInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        } else {
          clearInterval(chunkInterval);
        }
      }, 5000);
    };
    
    // Start the first recording cycle
    startRecordingCycle();
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Audio capture error:', error);
    isRecording = false;
    sendResponse({ success: false, error: error.message });
  }
}

async function stopAudioCapture(sendResponse) {
  isRecording = false;
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (e) {
      console.log('Error stopping recorder:', e);
    }
  }
  
  // Stop all audio tracks
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
  // Close audio context
  if (audioContext && audioContext.state !== 'closed') {
    try {
      await audioContext.close();
    } catch (e) {
      console.log('Error closing audio context:', e);
    }
    audioContext = null;
  }
  
  mediaRecorder = null;
  audioChunks = [];
  
  console.log('Audio capture stopped');
  sendResponse({ success: true });
}

async function transcribeAudio(audioData, sendResponse) {
  try {
    if (!audioData || audioData.length < 1000) {
      console.log('Audio data too short, skipping');
      sendResponse({ success: false, error: 'Audio too short' });
      return;
    }
    
    console.log('Transcribing audio, data length:', audioData.length);
    const text = await moonshine.transcribe(audioData);
    
    if (text && text.trim().length > 0) {
      console.log('Transcription result:', text);
      sendResponse({ success: true, text: text });
    } else {
      console.log('Empty transcription result');
      sendResponse({ success: false, error: 'Empty result' });
    }
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
