import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

class processor {
  constructor() {
    this.transcriber = null;
    this.isLoading = false;
  }
  
  async loadModel(language = 'en') {
    if (this.isLoading) return;
    this.transcriber = null;
    if (this.isLoading) return;
    
    this.isLoading = true;
    const model = language === 'en' ? 'Xenova/whisper-tiny.en' : 'Xenova/whisper-small';
    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        model
      );
      
    } catch (error) {
      console.error('Failed to load:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  getLanguageName(code) {
    const languages = {
      'en': 'english',
      'es': 'spanish',
      'fr': 'french',
      'de': 'german',
      'hi': 'hindi',
      'zh': 'chinese',
      'ar': 'arabic'
    };
    return languages[code] || 'english';
  }
  
  async transcribe(audioData, language = 'en') {
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
      
      const result = await this.transcriber(audioBuffer, {
        language: this.getLanguageName(language),
        task: 'transcribe'
      });
      
      const text = result.text.trim();
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

export default processor;
