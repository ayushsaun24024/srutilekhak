import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

const WHISPER_MODEL = 'Xenova/whisper-small';

const LANGUAGE_NAMES = {
  en: 'english', es: 'spanish', fr: 'french', de: 'german',
  hi: 'hindi', zh: 'chinese', ar: 'arabic', ja: 'japanese',
  ko: 'korean', pt: 'portuguese', ru: 'russian', it: 'italian',
  nl: 'dutch', pl: 'polish', tr: 'turkish', sv: 'swedish',
  no: 'norwegian', da: 'danish', fi: 'finnish', id: 'indonesian',
  th: 'thai', ur: 'urdu', bn: 'bengali', vi: 'vietnamese'
};

const RTL_LANGUAGES = new Set(['ar', 'ur', 'he', 'fa']);

class Processor {
  constructor() {
    this.transcriber = null;
    this.translators = {};
    this.isLoadingWhisper = false;
    this.loadingTranslators = {};
  }

  async loadModel() {
    if (this.transcriber || this.isLoadingWhisper) return;
    this.isLoadingWhisper = true;
    try {
      this.transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL);
    } finally {
      this.isLoadingWhisper = false;
    }
  }

  async loadTranslationModel(pairKey, modelId, onProgress = null) {
    if (this.translators[pairKey] || this.loadingTranslators[pairKey]) return;
    this.loadingTranslators[pairKey] = true;
    try {
      this.translators[pairKey] = await pipeline('translation', modelId, {
        progress_callback: onProgress
      });
    } finally {
      delete this.loadingTranslators[pairKey];
    }
  }

  isTranslationModelLoaded(pairKey) {
    return !!this.translators[pairKey];
  }

  unloadTranslationModel(pairKey) {
    delete this.translators[pairKey];
  }

  getLanguageName(code) {
    return LANGUAGE_NAMES[code] || 'english';
  }

  isRTL(langCode) {
    return RTL_LANGUAGES.has(langCode);
  }

  async transcribe(audioData, options = {}) {
    if (!this.transcriber) throw new Error('Model not loaded');
    if (!audioData) return { text: '', detectedLanguage: null, translatedText: null };

    const { language = 'auto', translateTo = null } = options;

    let audioBuffer;
    try {
      audioBuffer = await this._decodeAudio(this._base64ToBlob(audioData));
    } catch {
      return { text: '', detectedLanguage: null, translatedText: null };
    }

    if (!audioBuffer || audioBuffer.length < 1600) {
      return { text: '', detectedLanguage: null, translatedText: null };
    }

    const whisperOptions = { return_timestamps: true };

    if (translateTo) {
      whisperOptions.task = 'translate';
    } else {
      whisperOptions.task = 'transcribe';
      if (language !== 'auto') {
        whisperOptions.language = this.getLanguageName(language);
      }
    }

    let result;
    try {
      result = await this.transcriber(audioBuffer, whisperOptions);
    } catch {
      return { text: '', detectedLanguage: null, translatedText: null };
    }

    const transcribedText = result.text?.trim() || '';
    if (!transcribedText) return { text: '', detectedLanguage: null, translatedText: null };

    const detectedLanguage = result.chunks?.[0]?.language || null;

    if (!translateTo || translateTo === 'en') {
      return { text: transcribedText, detectedLanguage, translatedText: null };
    }

    const pairKey = `en-${translateTo}`;
    const translatedText = await this._translate(transcribedText, pairKey);

    return { text: transcribedText, detectedLanguage, translatedText };
  }

  async _translate(text, pairKey) {
    const translator = this.translators[pairKey];
    if (!translator) return null;
    try {
      const result = await translator(text);
      return result[0]?.translation_text?.trim() || null;
    } catch {
      return null;
    }
  }

  async _decodeAudio(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.getChannelData(0);
  }

  _base64ToBlob(base64Data) {
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/webm;codecs=opus' });
  }
}

export default Processor;
