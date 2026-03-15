import Processor from '../utils/processor.js';

const processorInstance = new Processor();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let audioStream = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'loadModel') {
    handleLoadModel(sendResponse);
    return true;
  }
  if (message.action === 'loadTranslationModel') {
    handleLoadTranslationModel(message.pairKey, message.modelId, sendResponse);
    return true;
  }
  if (message.action === 'unloadTranslationModel') {
    processorInstance.unloadTranslationModel(message.pairKey);
    sendResponse({ success: true });
    return true;
  }
  if (message.action === 'startAudioCapture') {
    handleStartAudioCapture(message.streamId, message.options || {}, sendResponse);
    return true;
  }
  if (message.action === 'stopAudioCapture') {
    handleStopAudioCapture(sendResponse);
    return true;
  }
  if (message.action === 'transcribeAudio') {
    handleTranscribeAudio(message.audioData, message.options || {}, sendResponse);
    return true;
  }
});

async function handleLoadModel(sendResponse) {
  try {
    await processorInstance.loadModel();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLoadTranslationModel(pairKey, modelId, sendResponse) {
  sendResponse({ success: true, status: 'started' });

  try {
    await processorInstance.loadTranslationModel(pairKey, modelId, (progress) => {
      chrome.runtime.sendMessage({
        action: 'translationModelProgress',
        pairKey,
        progress
      }).catch(() => {});
    });

    chrome.runtime.sendMessage({ action: 'translationModelReady', pairKey }).catch(() => {});
  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'translationModelError',
      pairKey,
      error: error.message
    }).catch(() => {});
  }
}

async function handleStartAudioCapture(streamId, options, sendResponse) {
  try {
    if (isRecording || mediaRecorder) {
      await handleStopAudioCapture(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

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
      stream.getTracks().forEach((track) => track.stop());
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

    startRecordingCycle(destination.stream, options);
    sendResponse({ success: true });
  } catch (error) {
    isRecording = false;
    sendResponse({ success: false, error: error.message });
  }
}

function getChunkSize(options) {
  if (options.autoDetect) return 5000;
  const lang = options.language || 'en';
  if (['ja', 'ko', 'zh', 'hi'].includes(lang)) return 6000;
  if (lang === 'en') return 3000;
  return 5000;
}

function startRecordingCycle(stream, options) {
  if (!isRecording) return;

  const chunkSize = getChunkSize(options);
  let isTranscribing = false;

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  audioChunks = [];
  let chunkCount = 0;
  const maxChunksPerCycle = 5;

  mediaRecorder.ondataavailable = async (event) => {
    if (!event.data.size || !isRecording) return;

    audioChunks.push(event.data);
    chunkCount++;

    if (!isTranscribing && audioChunks.length >= 1) {
      isTranscribing = true;
      const fullBlob = new Blob([...audioChunks], { type: 'audio/webm' });
      const audioData = await blobToBase64(fullBlob);

      handleTranscribeAudio(audioData, options, (response) => {
        if (response.success && response.text) {
          chrome.runtime.sendMessage({
            action: 'processTranscription',
            text: response.text,
            detectedLanguage: response.detectedLanguage || null,
            translatedText: response.translatedText || null
          }).catch(() => {});
        }
        isTranscribing = false;
      });
    }

    if (chunkCount >= maxChunksPerCycle) {
      mediaRecorder.stop();
    }
  };

  mediaRecorder.onstop = () => {
    if (isRecording) setTimeout(() => startRecordingCycle(stream, options), 100);
  };

  mediaRecorder.onerror = () => {
    if (isRecording) setTimeout(() => startRecordingCycle(stream, options), 500);
  };

  mediaRecorder.start();

  const chunkInterval = setInterval(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
    } else {
      clearInterval(chunkInterval);
    }
  }, chunkSize);
}

async function handleStopAudioCapture(sendResponse) {
  isRecording = false;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (_) {}
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    try { await audioContext.close(); } catch (_) {}
    audioContext = null;
  }

  mediaRecorder = null;
  audioChunks = [];
  sendResponse({ success: true });
}

async function handleTranscribeAudio(audioData, options, sendResponse) {
  try {
    if (!audioData || audioData.length < 1000) {
      sendResponse({ success: false, error: 'Audio too short' });
      return;
    }

    const result = await processorInstance.transcribe(audioData, options);

    if (result.text && result.text.length > 0) {
      sendResponse({
        success: true,
        text: result.text,
        detectedLanguage: result.detectedLanguage,
        translatedText: result.translatedText
      });
    } else {
      sendResponse({ success: false, error: 'Empty result' });
    }
  } catch (error) {
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
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let checks = 0;
    let hasAudio = false;

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      if (avg > 0.5) hasAudio = true;
      checks++;
      if (checks >= 10) {
        clearInterval(interval);
        ctx.close();
        resolve(hasAudio);
      }
    }, 100);
  });
}
