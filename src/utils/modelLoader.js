class ModelLoader {
  constructor() {
    this.manifest = null;
  }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    const response = await fetch(chrome.runtime.getURL('models/manifest.json'));
    this.manifest = await response.json();
    return this.manifest;
  }

  async getWhisperInfo() {
    if (!this.manifest) await this.loadManifest();
    return this.manifest.whisper.multilingual;
  }

  async getTranslationModelInfo(pairKey) {
    if (!this.manifest) await this.loadManifest();
    return this.manifest.translation[pairKey] || null;
  }

  async getAllTranslationModels() {
    if (!this.manifest) await this.loadManifest();
    return this.manifest.translation;
  }

  _whisperKey() {
    return 'whisper_model';
  }

  _translationKey(pairKey) {
    return `translation_${pairKey}`;
  }

  async isWhisperDownloaded() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this._whisperKey()], (result) => {
        resolve(!!result[this._whisperKey()]);
      });
    });
  }

  async isTranslationModelDownloaded(pairKey) {
    const key = this._translationKey(pairKey);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(!!result[key]);
      });
    });
  }

  async downloadWhisperModel() {
    if (!this.manifest) await this.loadManifest();
    const info = this.manifest.whisper.multilingual;
    await chrome.storage.local.set({
      [this._whisperKey()]: {
        urls: info.files,
        version: info.version,
        size: info.size,
        downloadedAt: Date.now()
      }
    });
    return true;
  }

  async markTranslationModelReady(pairKey) {
    const info = await this.getTranslationModelInfo(pairKey);
    if (!info) throw new Error(`Translation model not found in manifest: ${pairKey}`);
    await chrome.storage.local.set({
      [this._translationKey(pairKey)]: {
        modelId: info.modelId,
        source: info.source,
        target: info.target,
        version: info.version,
        downloadedAt: Date.now()
      }
    });
    return true;
  }

  async getWhisperModel() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this._whisperKey()], (result) => {
        resolve(result[this._whisperKey()] || null);
      });
    });
  }

  async getTranslationModel(pairKey) {
    const key = this._translationKey(pairKey);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  }

  async removeTranslationModel(pairKey) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([this._translationKey(pairKey)], () => resolve());
    });
  }

  async getAllDownloadedTranslationModels() {
    if (!this.manifest) await this.loadManifest();
    const pairKeys = Object.keys(this.manifest.translation);
    const storageKeys = pairKeys.map((p) => this._translationKey(p));
    return new Promise((resolve) => {
      chrome.storage.local.get(storageKeys, (result) => {
        const downloaded = {};
        pairKeys.forEach((pairKey) => {
          const val = result[this._translationKey(pairKey)];
          if (val) downloaded[pairKey] = val;
        });
        resolve(downloaded);
      });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelLoader;
}
