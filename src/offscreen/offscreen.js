import processor from '../utils/processor.js';

const processorModel = new processor();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null; // ADD THIS
let audioStream = null; // ADD THIS

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    await processorModel.loadModel(language);
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
      
      mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunks = [];
      let chunkCount = 0;
      const maxChunksPerCycle = 5; // 15 seconds per cycle (CHANGED from 4)
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && isRecording) {
          audioChunks.push(event.data);
          chunkCount++;
          
          
          // Transcribe when we have 1+ chunk (CHANGED from 2+ for faster response)
          if (!isTranscribing && audioChunks.length >= 1) {
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
          
          // After 5 chunks (15 seconds), stop and restart for fresh headers
          if (chunkCount >= maxChunksPerCycle) {
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
      
      // Request data every 3 seconds (CHANGED from 5000 for faster updates)
      const chunkInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        } else {
          clearInterval(chunkInterval);
        }
      }, 3000);
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
  
  sendResponse({ success: true });
}

async function transcribeAudio(audioData, sendResponse) {
  try {
    if (!audioData || audioData.length < 1000) {
      sendResponse({ success: false, error: 'Audio too short' });
      return;
    }
    
    const text = await processorModel.transcribe(audioData);
    
    if (text && text.trim().length > 0) {
      sendResponse({ success: true, text: text });
    } else {
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
