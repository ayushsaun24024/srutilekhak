class MoonshineProcessor {
  constructor() {
    this.model = null;
  }
  
  async loadModel(language = 'en') {
    console.log('Model loading simulated for v1');
    this.model = { loaded: true };
    return true;
  }
  
  async transcribe(audioData) {
    // V1: Return dummy transcription
    const dummyTexts = [
      'This is a test transcription.',
      'Moonshine will process real audio in v2.',
      'Currently showing simulated output.',
      'Extension UI is fully functional.'
    ];
    
    return dummyTexts[Math.floor(Math.random() * dummyTexts.length)];
  }
}

export default MoonshineProcessor;
