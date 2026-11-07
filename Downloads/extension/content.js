/* global chrome */
// TurboGrab Content Script: Media Player Sniffer & Genesis Grab-Chip

(function() {
  'use strict';

  const SNIFFED_URLS = new Set();
  const ACTIVE_CHIPS = new WeakMap();

  // Safe wrapper for chrome.runtime.sendMessage to handle extension reloads gracefully
  function safeSendMessage(message, callback) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      try {
        chrome.runtime.sendMessage(message, (res) => {
          if (chrome.runtime.lastError) {
            console.warn('[TurboGrab Extension notice]:', chrome.runtime.lastError.message);
            if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
          } else {
            if (callback) callback(res || { success: true });
          }
        });
      } catch (err) {
        console.warn('[TurboGrab] Extension context changed. Please refresh this page.', err);
        if (callback) callback({ success: false, needsRefresh: true });
      }
    } else {
      if (callback) callback({ success: false, needsRefresh: true });
    }
  }

  function isMediaUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.m3u8') ||
           cleanUrl.endsWith('.mpd') ||
           cleanUrl.endsWith('.mp4') ||
           cleanUrl.endsWith('.mkv') ||
           cleanUrl.endsWith('.webm') ||
           cleanUrl.endsWith('.m4s') ||
           cleanUrl.endsWith('.ts') ||
           cleanUrl.endsWith('.mp3') ||
           cleanUrl.endsWith('.flac') ||
           cleanUrl.endsWith('.aac') ||
           url.includes('googlevideo.com') ||
           url.startsWith('blob:') ||
           window.location.hostname.includes('youtube.com') ||
           window.location.hostname.includes('youtu.be');
  }

  function detectFormat(url) {
    const cleanUrl = (url || '').toLowerCase();
    if (window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be')) return 'YouTube Video';
    if (cleanUrl.includes('.m3u8')) return 'HLS (.m3u8)';
    if (cleanUrl.includes('.mpd')) return 'DASH (.mpd)';
    if (cleanUrl.includes('.mp4')) return 'MP4 Video';
    if (cleanUrl.includes('.webm')) return 'WebM Video';
    if (cleanUrl.includes('.mp3') || cleanUrl.includes('.flac') || cleanUrl.includes('.aac')) return 'Audio Stream';
    if (cleanUrl.startsWith('blob:')) return 'Dynamic Stream';
    return 'Media Stream';
  }

  function findSniffedStreamUrl() {
    // 1. Check window.performance resource timings
    if (window.performance && typeof window.performance.getEntriesByType === 'function') {
      const entries = window.performance.getEntriesByType('resource');
      for (let i = entries.length - 1; i >= 0; i--) {
        const name = entries[i].name || '';
        const lower = name.toLowerCase();
        if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('.mp4')) {
          return name;
        }
      }
    }
    // 2. Check SNIFFED_URLS
    for (const u of SNIFFED_URLS) {
      if (u && !u.startsWith('blob:') && u !== window.location.href && (u.includes('.m3u8') || u.includes('.mpd') || u.includes('.mp4') || u.includes('/stream') || u.includes('/hls'))) {
        return u;
      }
    }
    return null;
  }

  function getEffectiveUrl(url) {
    if (window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be')) {
      return window.location.href;
    }
    if (!url || url.startsWith('blob:')) {
      const realStream = findSniffedStreamUrl();
      if (realStream) return realStream;
      return url;
    }
    return url;
  }

  function isDrmProtected(mediaEl) {
    if (mediaEl && mediaEl.mediaKeys) return true;
    return false;
  }

  function detectAvailableQualities(mediaEl) {
    const qualities = {
      has4K: false,
      has2K: false,
      has1080p: true,
      has720p: true,
      has480p: true,
      has360p: true
    };

    // 1. YouTube Player API
    try {
      const ytPlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      if (ytPlayer && typeof ytPlayer.getAvailableQualityLevels === 'function') {
        const levels = ytPlayer.getAvailableQualityLevels();
        if (Array.isArray(levels)) {
          if (levels.includes('hd2160') || levels.includes('highres')) qualities.has4K = true;
          if (levels.includes('hd1440')) qualities.has2K = true;
        }
      }
    } catch (_) {}

    // 2. HTML5 Video Dimensions
    if (mediaEl) {
      const h = mediaEl.videoHeight || 0;
      const w = mediaEl.videoWidth || 0;
      if (h >= 2160 || w >= 3840) {
        qualities.has4K = true;
        qualities.has2K = true;
      } else if (h >= 1440 || w >= 2560) {
        qualities.has2K = true;
      }
    }

    // 3. Page Context / YouTube player response
    try {
      if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.streamingData) {
        const formats = window.ytInitialPlayerResponse.streamingData.adaptiveFormats || [];
        for (const f of formats) {
          if (f.qualityLabel && f.qualityLabel.includes('2160')) qualities.has4K = true;
          if (f.qualityLabel && f.qualityLabel.includes('1440')) qualities.has2K = true;
        }
      }
    } catch (_) {}

    // 4. Source URL inspection
    if (mediaEl && mediaEl.currentSrc) {
      const src = mediaEl.currentSrc.toLowerCase();
      if (src.includes('2160') || src.includes('4k')) { qualities.has4K = true; qualities.has2K = true; }
      if (src.includes('1440') || src.includes('2k')) qualities.has2K = true;
    }

    // 5. Default on YouTube watch pages where high-res is standard
    if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/watch')) {
      qualities.has4K = true;
      qualities.has2K = true;
    }

    return qualities;
  }

  function reportMedia(url, mediaEl, customFormat) {
    const effectiveUrl = getEffectiveUrl(url);
    if (!effectiveUrl || SNIFFED_URLS.has(effectiveUrl)) return;
    SNIFFED_URLS.add(effectiveUrl);

    const isProtected = isDrmProtected(mediaEl);
    const format = customFormat || detectFormat(url);
    const title = document.title || 'Extracted Media Stream';
    const resolution = mediaEl && mediaEl.videoWidth ? `${mediaEl.videoWidth}x${mediaEl.videoHeight}` : 'Dynamic Auto';

    safeSendMessage({
      type: 'MEDIA_SNIFFED',
      media: {
        url: effectiveUrl,
        rawUrl: url,
        title: title,
        format: format,
        resolution: resolution,
        isProtected: isProtected,
        timestamp: Date.now()
      }
    });

    if (mediaEl && !ACTIVE_CHIPS.has(mediaEl)) {
      attachGrabChip(mediaEl, effectiveUrl, format, resolution, isProtected);
    } else if (mediaEl && ACTIVE_CHIPS.has(mediaEl)) {
      const chip = ACTIVE_CHIPS.get(mediaEl);
      if (chip && chip.dataset.currentUrl !== effectiveUrl) {
        chip.dataset.currentUrl = effectiveUrl;
        const infoUrl = chip.querySelector('.turbograb-info-url');
        if (infoUrl) {
          infoUrl.innerText = effectiveUrl;
          infoUrl.title = effectiveUrl;
        }
      }
    }
  }

  function attachGrabChip(mediaEl, streamUrl, format, resolution, isProtected) {
    if (ACTIVE_CHIPS.has(mediaEl)) return;

    const detectedQualities = detectAvailableQualities(mediaEl);

    const chipWrapper = document.createElement('div');
    chipWrapper.className = 'turbograb-chip-container';
    chipWrapper.dataset.currentUrl = streamUrl;

    const chipBtn = document.createElement('button');
    chipBtn.className = `turbograb-grab-chip ${isProtected ? 'turbograb-chip-protected' : ''}`;
    chipBtn.innerHTML = `
      <svg class="turbograb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>TurboGrab</span>
      <span class="turbograb-badge ${isProtected ? 'badge-protected' : ''}">${isProtected ? 'PROTECTED' : (detectedQualities.has4K ? '4K' : (detectedQualities.has2K ? '2K' : format))}</span>
    `;

    const popover = document.createElement('div');
    popover.className = 'turbograb-popover hidden';
    popover.innerHTML = `
      <div class="turbograb-popover-header">
        <div class="turbograb-title-row">
          <svg class="turbograb-icon" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span class="turbograb-popover-title">${isProtected ? 'Protected Media Stream' : 'Accelerate Video Download'}</span>
        </div>
        <span class="turbograb-close">&times;</span>
      </div>
      <div class="turbograb-popover-body">
        <div class="turbograb-info-row">
          <span class="turbograb-info-label">Format:</span>
          <span class="turbograb-info-val">${format}</span>
        </div>
        <div class="turbograb-info-row">
          <span class="turbograb-info-label">Quality:</span>
          <span class="turbograb-info-val">${resolution} ${detectedQualities.has4K ? '(4K Available)' : (detectedQualities.has2K ? '(2K Available)' : '')}</span>
        </div>
        ${isProtected ? `
          <div class="turbograb-protected-notice">
            <span class="prot-title">🔒 Protected or Restricted Content</span>
            <p>Playback and authorized offline viewing are available through the supported platform. Direct file download is unavailable.</p>
          </div>
        ` : `
          <div class="turbograb-info-row">
            <span class="turbograb-info-label">Source URL:</span>
            <span class="turbograb-info-url" title="${streamUrl}">${streamUrl}</span>
          </div>
          <div class="turbograb-quality-header">
            <span>Select Quality to Download:</span>
          </div>
          <div class="turbograb-quality-select">
            ${detectedQualities.has4K ? `
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="2160p" />
              <span class="q-badge q-4k">4K</span> Ultra HD 2160p (4K)
            </label>
            ` : ''}
            ${detectedQualities.has2K ? `
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="1440p" />
              <span class="q-badge q-2k">2K</span> Quad HD 1440p (2K)
            </label>
            ` : ''}
            <label class="turbograb-quality-item selected">
              <input type="radio" name="turbograb-q" value="1080p" checked />
              <span class="q-badge q-hd">1080p</span> Full HD 1080p
            </label>
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="720p" />
              <span class="q-badge q-hd">720p</span> HD 720p
            </label>
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="480p" />
              <span class="q-badge">480p</span> Standard 480p
            </label>
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="360p" />
              <span class="q-badge">360p</span> Fast 360p
            </label>
            <label class="turbograb-quality-item">
              <input type="radio" name="turbograb-q" value="audio" />
              <span class="q-badge q-audio">MP3</span> Audio Track Only (.mp3)
            </label>
          </div>
        `}
      </div>
      <div class="turbograb-popover-footer">
        <button class="turbograb-btn-secondary turbograb-copy-btn">Copy Link</button>
        ${isProtected ? `
          <button class="turbograb-btn-disabled" disabled>Download Unavailable</button>
        ` : `
          <button class="turbograb-btn-primary turbograb-send-btn">Download to Desktop</button>
        `}
      </div>
    `;

    chipWrapper.appendChild(chipBtn);
    chipWrapper.appendChild(popover);

    function updatePosition() {
      const rect = mediaEl.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
        chipWrapper.style.display = 'none';
        return;
      }
      chipWrapper.style.display = 'block';
      chipWrapper.style.top = `${window.scrollY + rect.top + 14}px`;
      chipWrapper.style.left = `${window.scrollX + rect.right - 170}px`;
    }

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    updatePosition();

    chipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    });

    popover.querySelector('.turbograb-close').addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
    });

    popover.querySelectorAll('input[name="turbograb-q"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        popover.querySelectorAll('.turbograb-quality-item').forEach(item => item.classList.remove('selected'));
        if (radio.parentElement) radio.parentElement.classList.add('selected');
      });
    });

    popover.querySelector('.turbograb-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const targetUrl = chipWrapper.dataset.currentUrl || streamUrl;
      navigator.clipboard.writeText(targetUrl);
      const btn = popover.querySelector('.turbograb-copy-btn');
      btn.innerText = 'Copied!';
      setTimeout(() => { btn.innerText = 'Copy Link'; }, 2000);
    });

    popover.querySelector('.turbograb-send-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const sendBtn = popover.querySelector('.turbograb-send-btn');
      sendBtn.innerText = 'Downloading...';
      const targetUrl = chipWrapper.dataset.currentUrl || streamUrl;
      const checkedRadio = popover.querySelector('input[name="turbograb-q"]:checked');
      const selectedQuality = checkedRadio ? checkedRadio.value : '1080p';

      safeSendMessage({
        type: 'START_DOWNLOAD',
        payload: {
          url: targetUrl,
          pageUrl: window.location.href,
          title: document.title || 'Video Stream',
          format: `${format} (${selectedQuality.toUpperCase()})`,
          quality: selectedQuality,
          isStream: true
        }
      }, (res) => {
        if (res && res.success) {
          sendBtn.innerText = 'Dispatched to App!';
          sendBtn.style.backgroundColor = '#10B981';
          setTimeout(() => {
            popover.classList.add('hidden');
            sendBtn.innerText = 'Download to Desktop';
            sendBtn.style.backgroundColor = '';
          }, 1500);
        } else if (res && res.needsRefresh) {
          sendBtn.innerText = 'Please Refresh Tab';
          sendBtn.style.backgroundColor = '#F59E0B';
          setTimeout(() => {
            sendBtn.innerText = 'Download to Desktop';
            sendBtn.style.backgroundColor = '';
          }, 3000);
        } else {
          sendBtn.innerText = 'App Offline';
          sendBtn.style.backgroundColor = '#EF4444';
          setTimeout(() => {
            sendBtn.innerText = 'Download to Desktop';
            sendBtn.style.backgroundColor = '';
          }, 2000);
        }
      });
    });

    document.body.appendChild(chipWrapper);
    ACTIVE_CHIPS.set(mediaEl, chipWrapper);
  }

  function scanMediaPlayers() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((el) => {
      const src = el.currentSrc || el.src;
      if (src && isMediaUrl(src)) {
        reportMedia(src, el);
      }

      const sources = el.querySelectorAll('source');
      sources.forEach((s) => {
        const sSrc = s.src || s.getAttribute('src');
        if (sSrc && isMediaUrl(sSrc)) {
          reportMedia(sSrc, el);
        }
      });
    });

    if (window.location.hostname.includes('youtube.com') && (window.location.pathname.startsWith('/watch') || window.location.pathname.startsWith('/shorts/'))) {
      const vid = document.querySelector('video');
      if (vid) {
        reportMedia(window.location.href, vid, 'YouTube Video');
      }
    }

    if (window.performance && typeof window.performance.getEntriesByType === 'function') {
      const entries = window.performance.getEntriesByType('resource');
      for (let i = 0; i < entries.length; i++) {
        const entryName = entries[i].name;
        if (entryName.includes('.m3u8') || entryName.includes('.mpd')) {
          reportMedia(entryName, null, entryName.includes('.m3u8') ? 'HLS (.m3u8)' : 'DASH (.mpd)');
        }
      }
    }
  }

  const observer = new MutationObserver(() => {
    scanMediaPlayers();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'currentSrc']
  });

  window.addEventListener('yt-navigate-finish', () => {
    SNIFFED_URLS.clear();
    scanMediaPlayers();
  });

  window.addEventListener('popstate', () => {
    SNIFFED_URLS.clear();
    scanMediaPlayers();
  });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === 'NETWORK_MEDIA_DETECTED' && request.media) {
        const media = request.media;
        // Upgrade existing blob or page-URL chips with real stream URL
        document.querySelectorAll('.turbograb-chip-container').forEach(chip => {
          if (chip.dataset.currentUrl && (chip.dataset.currentUrl.startsWith('blob:') || chip.dataset.currentUrl === window.location.href)) {
            chip.dataset.currentUrl = media.url;
            const infoUrl = chip.querySelector('.turbograb-info-url');
            if (infoUrl) {
              infoUrl.innerText = media.url;
              infoUrl.title = media.url;
            }
          }
        });
        const videoEl = document.querySelector('video') || document.querySelector('iframe') || document.body;
        reportMedia(media.url, videoEl, media.format);
      }
    });
  }

  scanMediaPlayers();
  setInterval(scanMediaPlayers, 3000);

})();
