document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const languageSelect = document.getElementById('language');
  const statusDiv = document.getElementById('status');

  // Check if English model is downloaded
  chrome.runtime.sendMessage(
    { action: 'checkModel', language: 'en' },
    (response) => {
      if (response && response.downloaded) {
        statusDiv.textContent = 'Ready - English model available';
        statusDiv.style.backgroundColor = '#d4edda';
      } else {
        statusDiv.textContent = 'Downloading English model...';
        statusDiv.style.backgroundColor = '#fff3cd';
        downloadEnglishModel();
      }
    }
  );
});

async function downloadEnglishModel() {
  const statusDiv = document.getElementById('status');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadModel',
      language: 'en'
    });
    
    if (response && response.success) {
      statusDiv.textContent = 'Ready - English model downloaded';
      statusDiv.style.backgroundColor = '#d4edda';
    } else {
      statusDiv.textContent = 'Error downloading model';
      statusDiv.style.backgroundColor = '#f8d7da';
    }
  } catch (error) {
    statusDiv.textContent = 'Error downloading model';
    statusDiv.style.backgroundColor = '#f8d7da';
  }
}

document.getElementById('start').addEventListener('click', async () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const language = document.getElementById('language').value;
  const statusDiv = document.getElementById('status');
  
  // Disable start button immediately
  startBtn.disabled = true;
  startBtn.style.opacity = '0.5';
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.runtime.sendMessage({
    action: 'startTranscription',
    tabId: tab.id,
    language: language
  }, (response) => {
    if (response && response.success) {
      statusDiv.textContent = 'Transcribing...';
      statusDiv.style.backgroundColor = '#cfe2ff';
      
      // Enable stop button
      stopBtn.disabled = false;
      stopBtn.style.opacity = '1';
    } else {
      // Re-enable start button on error
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      
      statusDiv.textContent = 'Error: ' + (response ? response.error : 'Unknown error');
      statusDiv.style.backgroundColor = '#f8d7da';
    }
  });
});

document.getElementById('stop').addEventListener('click', () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const statusDiv = document.getElementById('status');
  
  chrome.runtime.sendMessage({ action: 'stopTranscription' }, (response) => {
    if (response && response.success) {
      statusDiv.textContent = 'Stopped';
      statusDiv.style.backgroundColor = '#fff3cd';
      
      // Re-enable start button
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      
      // Disable stop button
      stopBtn.disabled = true;
      stopBtn.style.opacity = '0.5';
    }
  });
});
