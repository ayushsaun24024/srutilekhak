import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

class MoonshineProcessor {
  constructor() {
    this.transcriber = null;
    this.isLoading = false;
  }
  
  async loadModel() {
    if (this.transcriber) return;
    if (this.isLoading) return;
    
    this.isLoading = true;
    console.log('Loading Whisper...');
    
    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en'
      );
      
      console.log('Whisper loaded');
    } catch (error) {
      console.error('Failed to load:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }
  
  async transcribe(audioData) {
    if (!this.transcriber) {
      throw new Error('Model not loaded');
    }
    
    if (!audioData) {
      return 'Ready';
    }
    
    try {
      const audioBlob = this.base64ToBlob(audioData);
      const audioBuffer = await this.decodeAudio(audioBlob);
      
      if (!audioBuffer || audioBuffer.length < 1600) {
        return '';
      }
      
      const result = await this.transcriber(audioBuffer);
      
      const text = result.text.trim();
      console.log('Transcription:', text);
      return text || '';
    } catch (error) {
      console.log('Chunk decode failed, skipping');
      return '';
    }
  }
  
  async decodeAudio(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    
    return channelData;
  }
  
  base64ToBlob(base64Data) {
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: 'audio/webm;codecs=opus' });
  }
}

export default MoonshineProcessor;
