// TurboGrab MV3 Background Service Worker
// Manages WebSocket/Native Messaging connection to 127.0.0.1:48123 and download interception

const WS_PORT = 48123;
const WS_URL = `ws://127.0.0.1:${WS_PORT}`;
let socket = null;
let nativePort = null;
let isConnected = false;
let autoInterceptEnabled = true;

// Tab media store: tabId -> Array of detected media items
const tabMediaStreams = new Map();

// Interceptable file extensions (Compressed, Documents/Office, Programs, Media, Graphics)
const INTERCEPT_EXTENSIONS = [
  // Compressed & Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'img', 'bin',
  'cab', 'z', 'tgz', 'tbz2', 'txz', 'lz', 'lzma', 'lzh', 'arj', 'ace', 'uue', 'dmg',
  
  // Documents & Office (Word, PDF, Excel, PowerPoint, Text, eBooks)
  'pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'rtf', 'txt',
  'xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'csv', 'tsv',
  'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'potx',
  'odt', 'ods', 'odp', 'odg', 'odf', 'epub', 'mobi', 'azw', 'azw3',
  'pages', 'key', 'numbers', 'tex',
  
  // Programs, Packages & Installers
  'exe', 'msi', 'pkg', 'deb', 'rpm', 'apk', 'appimage',
  'jar', 'war', 'ipa', 'run', 'bat', 'cmd', 'vbs', 'msix', 'appx',
  
  // Video & Streams
  'mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v',
  '3gp', 'ts', 'm2ts', 'vob', 'ogv',
  
  // Audio
  'mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus',
  'aiff', 'alac', 'mid', 'midi',
  
  // High-res Graphics & Data
  'torrent', 'dat', 'db', 'sqlite', 'sql', 'bak', 'psd', 'ai', 'eps'
];

// Content-Type / MIME patterns that should be intercepted
const INTERCEPT_MIME_PATTERNS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-iso9660-image',
  'application/x-msdownload',
  'application/x-executable',
  'application/x-msi',
  'application/vnd.android.package-archive',
  'application/java-archive',
  'application/x-apple-diskimage',
  'application/x-debian-package',
  'application/x-redhat-package-manager',
  'application/rtf',
  'text/rtf',
  'application/vnd.oasis.opendocument',
  'application/epub+zip',
  'video/',
  'audio/'
];

// Helper to extract clean file extension from filename or URL
function extractExtension(filename, url) {
  let ext = '';
  if (filename && filename.includes('.')) {
    const parts = filename.split('.');
    ext = parts[parts.length - 1].toLowerCase().trim();
  }
  if (!ext && url) {
    try {
      const u = new URL(url);
      const cleanPath = decodeURIComponent(u.pathname.split('?')[0]);
      if (cleanPath.includes('.')) {
        const parts = cleanPath.split('.');
        ext = parts[parts.length - 1].toLowerCase().trim();
      }
    } catch (_) {}
  }
  return ext;
}

// Initialize storage settings
chrome.storage.local.get(['autoIntercept'], (res) => {
  if (res.autoIntercept !== undefined) {
    autoInterceptEnabled = res.autoIntercept;
  }
});

// Setup Context Menus
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'turbograb_download_link',
        title: 'Download Link with TurboGrab',
        contexts: ['link']
      });
      chrome.contextMenus.create({
        id: 'turbograb_download_image',
        title: 'Download Image with TurboGrab',
        contexts: ['image']
      });
      chrome.contextMenus.create({
        id: 'turbograb_download_media',
        title: 'Download Media with TurboGrab',
        contexts: ['video', 'audio']
      });
    });
  } catch (_) {}
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const targetUrl = info.linkUrl || info.srcUrl;
  if (!targetUrl) return;

  const cookieUrl = targetUrl.startsWith('http') ? targetUrl : (tab && tab.url ? tab.url : 'https://www.google.com');
  chrome.cookies.getAll({ url: cookieUrl }, (cookies) => {
    const cookieHeader = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');
    sendToDesktop({
      version: 1,
      command: 'start_download',
      payload: {
        url: targetUrl,
        referrer: tab ? tab.url : '',
        cookies: cookieHeader,
        userAgent: navigator.userAgent
      }
    });
  });
});

// --- Universal Network-Layer Video & Media Sniffer ---
try {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (!details || details.tabId < 0) return;
      const url = details.url;
      if (!url || url.startsWith('chrome') || url.startsWith('blob:')) return;

      let contentType = '';
      let contentLength = 0;
      if (details.responseHeaders) {
        for (const h of details.responseHeaders) {
          const name = h.name.toLowerCase();
          if (name === 'content-type') contentType = h.value ? h.value.toLowerCase() : '';
          if (name === 'content-length') contentLength = parseInt(h.value || '0', 10);
        }
      }

      const cleanUrl = url.toLowerCase().split('?')[0];

      const isVideoMime = contentType.includes('video/') ||
                          contentType.includes('application/vnd.apple.mpegurl') ||
                          contentType.includes('application/x-mpegurl') ||
                          contentType.includes('application/dash+xml') ||
                          (contentType.includes('audio/') && (cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.aac') || cleanUrl.endsWith('.mp3')));

      const isMediaExt = url.toLowerCase().includes('.m3u8') ||
                         url.toLowerCase().includes('.mpd') ||
                         cleanUrl.endsWith('.mp4') ||
                         cleanUrl.endsWith('.webm') ||
                         cleanUrl.endsWith('.mkv') ||
                         cleanUrl.endsWith('.m4v') ||
                         cleanUrl.endsWith('.flv') ||
                         cleanUrl.endsWith('.mov') ||
                         cleanUrl.endsWith('.ts') ||
                         url.includes('googlevideo.com/videoplayback');

      if (isVideoMime || isMediaExt) {
        let format = 'Video Stream';
        if (url.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl')) format = 'HLS Stream (.m3u8)';
        else if (url.toLowerCase().includes('.mpd') || contentType.includes('dash+xml')) format = 'DASH Stream (.mpd)';
        else if (cleanUrl.endsWith('.mp4') || contentType.includes('mp4')) format = 'MP4 Video';
        else if (cleanUrl.endsWith('.webm') || contentType.includes('webm')) format = 'WebM Video';
        else if (contentType.includes('audio/')) format = 'Audio Stream';

        const tabId = details.tabId;
        if (!tabMediaStreams.has(tabId)) {
          tabMediaStreams.set(tabId, []);
        }
        const list = tabMediaStreams.get(tabId);

        const exists = list.some(item => item.url === url);
        if (!exists) {
          chrome.tabs.get(tabId, (tab) => {
            const pageTitle = tab ? tab.title : 'Media Stream';
            const mediaObj = {
              url: url,
              rawUrl: url,
              title: pageTitle,
              format: format,
              resolution: contentLength > 0 ? `${(contentLength / (1024 * 1024)).toFixed(1)} MB` : 'Stream',
              timestamp: Date.now(),
              tabId: tabId
            };
            list.push(mediaObj);
            updateBadge(isConnected, list.length);

            try {
              chrome.tabs.sendMessage(tabId, {
                type: 'NETWORK_MEDIA_DETECTED',
                media: mediaObj
              }).catch(() => {});
            } catch (_) {}
          });
        }
      }
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
  );
} catch (e) {
  console.warn('[TurboGrab] webRequest sniffer initialization notice:', e.message);
}

// Update extension icon badge
function updateBadge(connected, count = 0) {
  isConnected = connected;
  if (connected) {
    chrome.action.setBadgeBackgroundColor({ color: '#6366F1' });
    chrome.action.setBadgeText({ text: count > 0 ? `${count}` : 'ON' });
    chrome.action.setTitle({ title: 'TurboGrab Desktop: Connected & Accelerated' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#9CA3AF' });
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setTitle({ title: 'TurboGrab Desktop: Offline (Click to retry)' });
  }
}

// WebSocket Connection Manager with exponential backoff
function initWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('[TurboGrab Extension] Connected to Desktop Host on', WS_URL);
      updateBadge(true);
      // Send handshake
      socket.send(JSON.stringify({
        type: 'HANDSHAKE',
        client: 'TurboGrab WebExtension MV3',
        version: '1.0.0',
        userAgent: navigator.userAgent
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[TurboGrab Extension] Message from Desktop:', msg);
        if (msg.type === 'PONG') {
          // Heartbeat ok
        }
      } catch (err) {
        console.error('[TurboGrab Extension] Parse error:', err);
      }
    };

    socket.onclose = () => {
      updateBadge(false);
      // Try reconnecting after delay
      setTimeout(initWebSocket, 4000);
    };

    socket.onerror = (err) => {
      console.warn('[TurboGrab Extension] WebSocket error, checking native host fallback...');
      updateBadge(false);
    };
  } catch (e) {
    updateBadge(false);
    setTimeout(initWebSocket, 4000);
  }
}

// Check if TurboGrab Desktop is alive (HTTP or WS)
async function checkDesktopAlive() {
  if (socket && socket.readyState === WebSocket.OPEN) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`http://127.0.0.1:${WS_PORT}/`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      updateBadge(true);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        initWebSocket();
      }
      return true;
    }
  } catch (_) {}
  updateBadge(false);
  return false;
}

// Optional Native Messaging Fallback
function tryNativeMessaging() {
  try {
    nativePort = chrome.runtime.connectNative('com.turbograb.host');
    nativePort.onMessage.addListener((msg) => {
      console.log('[TurboGrab NativeHost] Received:', msg);
    });
    nativePort.onDisconnect.addListener(() => {
      console.warn('[TurboGrab NativeHost] Disconnected:', chrome.runtime.lastError);
      nativePort = null;
    });
  } catch (err) {
    // Native host not installed, fallback to WebSocket/HTTP
  }
}

// Send payload to TurboGrab Host with HTTP POST and Native Host fallback
async function sendToDesktopAsync(payload) {
  // 1. Try active WebSocket if open
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch (_) {}
  }

  // 2. Direct HTTP POST fallback (resilient in MV3 background workers)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://127.0.0.1:${WS_PORT}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      updateBadge(true);
      return true;
    }
  } catch (_) {}

  // 3. Native Messaging Port fallback
  if (nativePort) {
    try {
      nativePort.postMessage(payload);
      return true;
    } catch (_) {}
  }

  return false;
}

function sendToDesktop(payload) {
  sendToDesktopAsync(payload).catch((e) => console.warn('[TurboGrab Send Notice]:', e));
  return true;
}

// Intercept browser downloads via chrome.downloads.onDeterminingFilename
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (!autoInterceptEnabled) {
    suggest();
    return true;
  }

  const filename = item.filename || '';
  const url = item.url || '';
  const mime = (item.mime || '').toLowerCase();
  const ext = extractExtension(filename, url);

  // Check against all supported extensions and MIME patterns
  const matchesExt = INTERCEPT_EXTENSIONS.includes(ext);
  const matchesMime = INTERCEPT_MIME_PATTERNS.some(p => mime.startsWith(p));
  const isStream = url.includes('.m3u8') || url.includes('.mpd');

  const shouldIntercept = matchesExt || matchesMime || isStream;

  if (!shouldIntercept) {
    suggest();
    return true;
  }

  // File matches! Verify TurboGrab Desktop is reachable
  checkDesktopAlive().then((isAlive) => {
    if (!isAlive) {
      suggest();
      return;
    }

    // Cancel default browser download & transfer to TurboGrab
    chrome.downloads.cancel(item.id, () => {
      const cookieUrl = url.startsWith('http') ? url : 'https://www.google.com';
      chrome.cookies.getAll({ url: cookieUrl }, async (cookies) => {
        const cookieHeader = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');

        let finalName = filename;
        if (!finalName || finalName === 'download') {
          try {
            const u = new URL(url);
            finalName = decodeURIComponent(u.pathname.split('/').pop() || '');
          } catch (_) {}
        }
        if (!finalName) {
          finalName = `download_${Date.now()}${ext ? '.' + ext : ''}`;
        }

        const downloadPayload = {
          command: 'intercept_download',
          payload: {
            url: item.url,
            filename: finalName,
            filesize: item.fileSize || item.totalBytes || 0,
            referrer: item.referrer || '',
            cookies: cookieHeader,
            user_agent: navigator.userAgent,
            timestamp: Date.now()
          }
        };

        const dispatched = await sendToDesktopAsync(downloadPayload);
        if (dispatched) {
          console.log('[TurboGrab Intercepted]', finalName, `(${ext || mime}) -> Sent to TurboGrab 16-Thread Downloader`);
        }
      });
    });
  }).catch(() => {
    suggest();
  });

  return true; // Keep async channel open for suggest() or cancel()
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'MEDIA_SNIFFED') {
    const tabId = sender.tab ? sender.tab.id : 0;
    if (!tabMediaStreams.has(tabId)) {
      tabMediaStreams.set(tabId, []);
    }
    const list = tabMediaStreams.get(tabId);
    // Deduplicate by URL
    if (!list.find(item => item.url === request.media.url)) {
      list.push({
        ...request.media,
        tabId: tabId,
        pageTitle: sender.tab?.title || 'Unknown Webpage',
        pageUrl: sender.tab?.url || ''
      });
      updateBadge(isConnected, list.length);
    }
    sendResponse({ success: true, count: list.length });
    return true;
  }

  if (request.type === 'GET_TAB_MEDIA') {
    const list = tabMediaStreams.get(request.tabId) || [];
    sendResponse({ media: list, isConnected, autoIntercept: autoInterceptEnabled });
    return true;
  }

  if (request.type === 'START_DOWNLOAD') {
    let targetUrl = request.payload.url;
    if (targetUrl && targetUrl.startsWith('blob:') && (request.payload.pageUrl || sender.tab?.url)) {
      targetUrl = request.payload.pageUrl || sender.tab?.url;
    }

    const cookieUrl = targetUrl.startsWith('http') ? targetUrl : 'https://www.google.com';
    chrome.cookies.getAll({ url: cookieUrl }, async (cookies) => {
      const cookieHeader = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');
      const payload = {
        command: request.payload.isStream ? 'start_stream' : 'start_download',
        payload: {
          ...request.payload,
          url: targetUrl,
          cookies: cookieHeader,
          user_agent: navigator.userAgent
        }
      };
      const sent = await sendToDesktopAsync(payload);
      sendResponse({ success: sent, isConnected: sent || isConnected });
    });
    return true;
  }

  if (request.type === 'TOGGLE_AUTO_INTERCEPT') {
    autoInterceptEnabled = request.value;
    chrome.storage.local.set({ autoIntercept: autoInterceptEnabled });
    sendResponse({ autoIntercept: autoInterceptEnabled });
    return true;
  }

  if (request.type === 'GET_STATUS') {
    checkDesktopAlive().then((alive) => {
      sendResponse({
        isConnected: alive,
        autoIntercept: autoInterceptEnabled,
        wsUrl: WS_URL
      });
    }).catch(() => {
      sendResponse({
        isConnected: false,
        autoIntercept: autoInterceptEnabled,
        wsUrl: WS_URL
      });
    });
    return true;
  }

  if (request.type === 'RECONNECT') {
    checkDesktopAlive().then(() => {
      sendResponse({ attempting: true, isConnected });
    });
    return true;
  }
});

// Clean up tab streams on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaStreams.delete(tabId);
});

// Start WebSocket connection
initWebSocket();
