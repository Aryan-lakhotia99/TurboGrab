// TurboGrab Popup Controller

document.addEventListener('DOMContentLoaded', () => {
  const connectionStatus = document.getElementById('connectionStatus');
  const statusText = document.getElementById('statusText');
  const autoInterceptToggle = document.getElementById('autoInterceptToggle');
  const manualUrl = document.getElementById('manualUrl');
  const manualQuality = document.getElementById('manualQuality');
  const sendManualBtn = document.getElementById('sendManualBtn');
  const streamCount = document.getElementById('streamCount');
  const streamsList = document.getElementById('streamsList');
  const reconnectBtn = document.getElementById('reconnectBtn');

  // Query background status
  function refreshStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setOffline();
        return;
      }
      if (res.isConnected) {
        setOnline();
      } else {
        setOffline();
      }
      autoInterceptToggle.checked = !!res.autoIntercept;
    });

    // Query active tab streams
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.runtime.sendMessage({ type: 'GET_TAB_MEDIA', tabId: tabs[0].id }, (res) => {
          if (res && res.media) {
            renderStreams(res.media);
          }
        });
      }
    });
  }

  function setOnline() {
    connectionStatus.className = 'status-pill online';
    statusText.innerText = 'Connected';
  }

  function setOffline() {
    connectionStatus.className = 'status-pill offline';
    statusText.innerText = 'Offline';
  }

  function renderStreams(streams) {
    streamCount.innerText = streams.length;
    if (streams.length === 0) {
      streamsList.innerHTML = '<div class="empty-state">No media streams detected on active tab.</div>';
      return;
    }

    streamsList.innerHTML = '';
    streams.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'stream-item';
      item.innerHTML = `
        <div class="stream-info">
          <span class="stream-name" title="${s.title || s.url}">${s.title || s.url}</span>
          <span class="stream-meta">
            <span>${s.format}</span>
            <span>•</span>
            <span>${s.resolution}</span>
          </span>
        </div>
        <div class="stream-qualities">
          <button class="q-pill q-4k" data-quality="2160p" title="Download 4K Ultra HD (2160p)">4K</button>
          <button class="q-pill q-2k" data-quality="1440p" title="Download 2K Quad HD (1440p)">2K</button>
          <button class="q-pill q-1080" data-quality="1080p" title="Download 1080p Full HD">1080p</button>
          <button class="q-pill q-720" data-quality="720p" title="Download 720p HD">720p</button>
          <button class="q-pill q-480" data-quality="480p" title="Download 480p SD">480p</button>
          <button class="q-pill q-360" data-quality="360p" title="Download 360p Fast">360p</button>
          <button class="q-pill q-audio-pill" data-quality="audio" title="Download MP3 Audio Track">MP3</button>
        </div>
      `;

      item.querySelectorAll('.q-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          const qual = pill.dataset.quality;
          const origText = pill.innerText;
          pill.innerText = '...';
          pill.style.opacity = '0.7';

          chrome.runtime.sendMessage({
            type: 'START_DOWNLOAD',
            payload: {
              url: s.url,
              title: s.title,
              format: `${s.format} (${qual.toUpperCase()})`,
              quality: qual,
              isStream: true
            }
          }, (resp) => {
            if (resp && resp.success) {
              pill.innerText = '✓';
              pill.style.backgroundColor = '#10B981';
              pill.style.color = '#FFFFFF';
              pill.style.opacity = '1';
              setTimeout(() => {
                pill.innerText = origText;
                pill.style.backgroundColor = '';
                pill.style.color = '';
              }, 2500);
            } else {
              pill.innerText = '✕';
              pill.style.backgroundColor = '#EF4444';
              pill.style.color = '#FFFFFF';
              pill.style.opacity = '1';
              setTimeout(() => {
                pill.innerText = origText;
                pill.style.backgroundColor = '';
                pill.style.color = '';
              }, 2500);
            }
          });
        });
      });

      streamsList.appendChild(item);
    });
  }

  // Toggle Auto Intercept
  autoInterceptToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'TOGGLE_AUTO_INTERCEPT',
      value: autoInterceptToggle.checked
    });
  });

  // Manual URL dispatch
  sendManualBtn.addEventListener('click', () => {
    const url = manualUrl.value.trim();
    if (!url) return;
    const selectedQual = manualQuality ? manualQuality.value : '1080p';
    sendManualBtn.innerText = 'Sending...';
    chrome.runtime.sendMessage({
      type: 'START_DOWNLOAD',
      payload: {
        url: url,
        title: url.split('/').pop() || 'Manual Download',
        format: `Direct Download (${selectedQual.toUpperCase()})`,
        quality: selectedQual,
        isStream: url.includes('.m3u8') || url.includes('.mpd') || url.includes('youtube.com') || url.includes('youtu.be')
      }
    }, (resp) => {
      manualUrl.value = '';
      sendManualBtn.innerText = 'Grab';
      if (resp && resp.success) {
        alert(`Dispatched to TurboGrab Desktop at ${selectedQual}!`);
      } else {
        alert('Desktop Host is offline! Ensure TurboGrab app is running on 127.0.0.1:48123');
      }
    });
  });

  // Reconnect button
  reconnectBtn.addEventListener('click', () => {
    statusText.innerText = 'Connecting...';
    chrome.runtime.sendMessage({ type: 'RECONNECT' }, () => {
      setTimeout(refreshStatus, 1500);
    });
  });

  refreshStatus();
});
