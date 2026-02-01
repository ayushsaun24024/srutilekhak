document.getElementById('start').addEventListener('click', async () => {
  const language = document.getElementById('language').value;
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.runtime.sendMessage({
    action: 'startTranscription',
    tabId: tab.id,
    language: language
  });
  
  document.getElementById('status').textContent = 'Starting...';
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopTranscription' });
});
