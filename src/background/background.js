console.log('Śrutilekhak background service worker loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTranscription') {
    console.log(`Starting transcription for tab ${message.tabId} in ${message.language}`);
    // TODO: Implement audio capture and transcription
  }
  
  if (message.action === 'stopTranscription') {
    console.log('Stopping transcription');
    // TODO: Implement stop logic
  }
});
