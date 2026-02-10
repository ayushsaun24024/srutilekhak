// Model loader utility for Śrutilekhak
class ModelLoader {
  constructor() {
    this.models = {};
    this.manifest = null;
  }

  // Load model manifest from extension
  async loadManifest() {
    try {
      const response = await fetch(chrome.runtime.getURL('models/manifest.json'));
      this.manifest = await response.json();
      return this.manifest;
    } catch (error) {
      console.error('Failed to load manifest:', error);
      throw error;
    }
  }

  // Check if model is already downloaded
  async isModelDownloaded(language) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`model_${language}`], (result) => {
        resolve(!!result[`model_${language}`]);
      });
    });
  }

  // Download model from HuggingFace
  async downloadModel(language, onProgress) {
    if (!this.manifest) {
      await this.loadManifest();
    }

    const modelInfo = this.manifest.models[language];
    if (!modelInfo) {
      throw new Error(`Model for language ${language} not found`);
    }

    await chrome.storage.local.set({
      [`model_${language}`]: {
        urls: modelInfo.files,
        version: modelInfo.version,
        size: modelInfo.size,
        downloadedAt: Date.now()
      }
    });

    return true;
  }

  // Get model info from storage
  async getModel(language) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`model_${language}`], (result) => {
        resolve(result[`model_${language}`] || null);
      });
    });
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelLoader;
}
