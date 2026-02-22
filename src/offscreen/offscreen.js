import processor from '../utils/processor.js';

const processorModel = new processor();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let audioStream = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'loadModel') {
    loadModel(message.language, sendResponse);
    return true;
  }
  
  if (message.action === 'startAudioCapture') {
    startAudioCapture(message.streamId, message.language, sendResponse);
    return true;
  }
  
  if (message.action === 'stopAudioCapture') {
    stopAudioCapture(sendResponse);
    return true;
  }
  
  if (message.action === 'transcribeAudio') {
    transcribeAudio(message.audioData, message.language || 'en', sendResponse);
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

async function startAudioCapture(streamId, language, sendResponse) {
  try {
    if (isRecording || mediaRecorder) {
      await stopAudioCapture(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const chunkSize = ['en'].includes(language) ? 3000 : 5000;
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    const hasAudio = await detectAudioLevel(stream);
    
    if (!hasAudio) {
      stream.getTracks().forEach(track => track.stop());
      sendResponse({ success: false, error: 'NO_AUDIO_DETECTED' });
      return;
    }
    
    audioStream = stream;
    
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
    
    const startRecordingCycle = () => {
      if (!isRecording) return;
      
      recordingCycle++;
      
      mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunks = [];
      let chunkCount = 0;
      const maxChunksPerCycle = 5;
      
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && isRecording) {
          audioChunks.push(event.data);
          chunkCount++;
          
          if (!isTranscribing && audioChunks.length >= 1) {
            isTranscribing = true;
            
            const fullBlob = new Blob([...audioChunks], { type: 'audio/webm' });
            const audioData = await blobToBase64(fullBlob);
            
            transcribeAudio(audioData, language, (response) => {
              if (response.success && response.text) {
                chrome.runtime.sendMessage({
                  action: 'processTranscription',
                  text: response.text
                }).catch(err => console.log('Failed to send transcription:', err));
              }
              isTranscribing = false;
            });
          }
          
          if (chunkCount >= maxChunksPerCycle) {
            mediaRecorder.stop();
          }
        }
      };
      
      mediaRecorder.onstop = () => {
        if (isRecording) {
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
      
      const chunkInterval = setInterval(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        } else {
          clearInterval(chunkInterval);
        }
      }, chunkSize);
    };
    
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
  
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  
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

async function transcribeAudio(audioData, language, sendResponse) {
  try {
    if (!audioData || audioData.length < 1000) {
      sendResponse({ success: false, error: 'Audio too short' });
      return;
    }
    
    const text = await processorModel.transcribe(audioData, language);
    
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

async function detectAudioLevel(stream) {
  return new Promise((resolve) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let checksCount = 0;
    let hasAudio = false;
    
    const checkInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      if (average > 0.5) {
        hasAudio = true;
      }
      
      checksCount++;
      if (checksCount >= 10) {
        clearInterval(checkInterval);
        audioContext.close();
        resolve(hasAudio);
      }
    }, 100);
  });
}
