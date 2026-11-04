const http = require('http');
const WebSocket = require('ws');
const downloadManager = require('./downloadManager.cjs');
const db = require('./db.cjs');

const PORT = 48123;
let server = null;
let wss = null;
let onInterceptHandler = null;

function setInterceptHandler(fn) {
  onInterceptHandler = fn;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // Direct extension sockets or native messaging
  const lower = origin.toLowerCase();
  return lower.startsWith('chrome-extension://') ||
         lower.startsWith('moz-extension://') ||
         lower.includes('127.0.0.1') ||
         lower.includes('localhost') ||
         lower === 'turbograb-native-host';
}

async function handleMessage(data) {
  const { version, type, command, payload, requestId } = data;

  // Handshake & PING
  if (type === 'HANDSHAKE' || type === 'PING' || command === 'ping') {
    return {
      version: 1,
      type: 'PONG',
      status: 'connected',
      engine: 'TurboGrab Download Engine v1.0',
      requestId
    };
  }

  // START / INTERCEPT DOWNLOAD
  if (command === 'intercept_download' || command === 'start_download' || command === 'start_stream' || type === 'ADD_DOWNLOAD') {
    const downloadPayload = payload || data;
    if (!downloadPayload.url) {
      return { version: 1, error: 'Missing download URL', requestId };
    }

    console.log(`\n⚡ [DOWNLOAD DISPATCH] -> URL: ${downloadPayload.url} (Quality: ${downloadPayload.quality || '1080p'})`);

    // Check if user has enabled "Always prompt for download location before starting (IDM style)"
    const askLocation = db.getSetting('ask_download_location');
    if (askLocation !== 'false' && onInterceptHandler) {
      const handled = onInterceptHandler(downloadPayload);
      if (handled) {
        return {
          version: 1,
          status: 'prompting',
          success: true,
          action: command || type,
          requestId
        };
      }
    }

    const taskId = await downloadManager.startDownload({
      url: downloadPayload.url,
      filename: downloadPayload.filename || downloadPayload.title,
      cookies: downloadPayload.cookies,
      referrer: downloadPayload.referrer,
      user_agent: downloadPayload.userAgent,
      is_stream: command === 'start_stream' || downloadPayload.isStream,
      connections: downloadPayload.connections || 16,
      mode: downloadPayload.mode || 'smart',
      quality: downloadPayload.quality || '1080p'
    });

    return {
      version: 1,
      status: 'accepted',
      success: true,
      download_id: taskId,
      action: command || type,
      requestId
    };
  }

  // GET STATS
  if (type === 'GET_STATS' || command === 'get_stats') {
    const stats = downloadManager.getStats();
    return {
      version: 1,
      type: 'STATS_RESPONSE',
      payload: stats,
      requestId
    };
  }

  // GET ALL DOWNLOADS
  if (type === 'GET_DOWNLOADS' || command === 'get_downloads') {
    const list = downloadManager.getAll();
    return {
      version: 1,
      type: 'DOWNLOADS_RESPONSE',
      payload: list,
      requestId
    };
  }

  // CONTROLS (Pause, Resume, Cancel)
  if (command === 'pause_download' || type === 'PAUSE_DOWNLOAD') {
    if (payload && payload.id) downloadManager.pauseDownload(payload.id);
    return { version: 1, success: true, requestId };
  }

  if (command === 'resume_download' || type === 'RESUME_DOWNLOAD') {
    if (payload && payload.id) downloadManager.resumeDownload(payload.id);
    return { version: 1, success: true, requestId };
  }

  if (command === 'cancel_download' || type === 'CANCEL_DOWNLOAD') {
    if (payload && payload.id) downloadManager.cancelDownload(payload.id, !!payload.deleteFile);
    return { version: 1, success: true, requestId };
  }

  return { version: 1, status: 'unknown_command', requestId };
}

function initWsServer() {
  if (server) return;

  server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      console.warn(`[TurboGrab Security] Blocked unauthorized HTTP origin: ${origin}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized Origin' }));
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const response = await handleMessage(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Status / Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: '1.0.0',
      status: 'online',
      engine: 'TurboGrab Download Engine v1.0',
      platform: process.platform,
      arch: process.arch,
      port: PORT,
      active_downloads: downloadManager.getActiveCount(),
      total_downloads: downloadManager.downloads.size,
      timestamp: Date.now()
    }));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[TurboGrab Notice] Port ${PORT} is already in use by a running TurboGrab instance. Skipping duplicate listener.`);
    } else {
      console.error('[TurboGrab] WebSocket HTTP server error:', err.message);
    }
  });

  try {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[TurboGrab] WebSocket & Native Bridge listening on 127.0.0.1:${PORT}`);

      wss = new WebSocket.Server({
        server,
        verifyClient: (info, callback) => {
          const origin = info.origin || info.req.headers.origin;
          if (!isAllowedOrigin(origin)) {
            console.warn(`[TurboGrab Security] Blocked unauthorized origin connection: ${origin}`);
            callback(false, 403, 'Unauthorized Origin');
          } else {
            callback(true);
          }
        }
      });

      wss.on('error', (err) => {
        console.warn('[TurboGrab] WebSocket server warning:', err.message);
      });

      wss.on('connection', (ws, req) => {
        const clientOrigin = req.headers.origin || 'extension';
        console.log(`[TurboGrab Extension Connected] from ${clientOrigin} on ws://127.0.0.1:${PORT}`);

        const rateLimiter = { count: 0, resetTime: Date.now() + 5000 };

        ws.send(JSON.stringify({
          version: 1,
          type: 'WELCOME',
          engine: 'TurboGrab Download Engine v1.0',
          speed_mode: 'Intelligent Work-Stealing',
          status: 'online'
        }));

        ws.on('message', async (message) => {
          try {
            const now = Date.now();
            if (now > rateLimiter.resetTime) {
              rateLimiter.count = 0;
              rateLimiter.resetTime = now + 5000;
            }
            rateLimiter.count++;
            if (rateLimiter.count > 40) {
              ws.send(JSON.stringify({ version: 1, error: 'Rate limit exceeded' }));
              return;
            }

            const data = JSON.parse(message);
            const response = await handleMessage(data);
            ws.send(JSON.stringify(response));
          } catch (err) {
            console.error('[WS Message Error]:', err.message);
            ws.send(JSON.stringify({ version: 1, error: 'Malformed message JSON' }));
          }
        });
      });
    });
  } catch (err) {
    console.warn('[TurboGrab] Server initialization notice:', err.message);
  }
}

function closeWsServer() {
  if (wss) {
    try { wss.close(); } catch (_) {}
  }
  if (server) {
    try { server.close(); } catch (_) {}
  }
}

module.exports = { initWsServer, closeWsServer, handleMessage, setInterceptHandler };
