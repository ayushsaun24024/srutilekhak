document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const languageSelect = document.getElementById('language');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');

  updateStatus('ready', 'Ready to transcribe');

  startBtn.addEventListener('click', async () => {
    const language = languageSelect.value;
    
    updateStatus('loading', 'Initializing...');
    startBtn.disabled = true;
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs[0]) {
      updateStatus('ready', 'Ready to transcribe');
      startBtn.disabled = false;
      return;
    }

    chrome.runtime.sendMessage({
      action: 'startTranscription',
      tabId: tabs[0].id,
      language: language
    }, (response) => {
      if (response && response.success) {
        updateStatus('transcribing', 'Transcribing live audio');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
      } else {
        updateStatus('ready', 'Ready to transcribe');
        startBtn.disabled = false;
      }
    });
  });

  stopBtn.addEventListener('click', () => {
    updateStatus('loading', 'Stopping...');
    stopBtn.disabled = true;
    
    chrome.runtime.sendMessage({
      action: 'stopTranscription'
    }, (response) => {
      if (response && response.success) {
        updateStatus('ready', 'Ready to transcribe');
        stopBtn.style.display = 'none';
        startBtn.style.display = 'flex';
        startBtn.disabled = false;
        stopBtn.disabled = false;
      } else {
        updateStatus('ready', 'Ready to transcribe');
        stopBtn.disabled = false;
      }
    });
  });

  function updateStatus(state, message) {
    statusText.textContent = message;
    statusPill.className = 'status-pill';
    
    if (state === 'loading') {
      statusPill.classList.add('loading');
    } else if (state === 'transcribing') {
      statusPill.classList.add('transcribing');
    }
  }
});
