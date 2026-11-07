#!/usr/bin/env node
/**
 * TurboGrab Native Messaging Host
 * Length-prefixed JSON protocol bridge for Chrome, Edge, and Firefox
 */

const http = require('http');

function sendNativeMessage(msgObj) {
  const jsonStr = JSON.stringify(msgObj);
  const buffer = Buffer.from(jsonStr, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);

  process.stdout.write(header);
  process.stdout.write(buffer);
}

// Forward request to TurboGrab Desktop WebSocket/HTTP engine on port 48123
async function forwardToDesktop(msg) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(msg);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 48123,
      path: '/native-api',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Origin': 'turbograb-native-host'
      },
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          resolve({ success: true, status: 'acknowledged' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `Desktop app connection failed: ${err.message}. Is TurboGrab running?`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Connection timed out' });
    });

    req.write(postData);
    req.end();
  });
}

// Process length-prefixed incoming chunks from browser stdin
let inputChunks = [];
let expectedLen = null;

process.stdin.on('readable', async () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    inputChunks.push(chunk);

    const totalBuffer = Buffer.concat(inputChunks);

    if (expectedLen === null && totalBuffer.length >= 4) {
      expectedLen = totalBuffer.readUInt32LE(0);
    }

    if (expectedLen !== null && totalBuffer.length >= 4 + expectedLen) {
      const msgBuffer = totalBuffer.slice(4, 4 + expectedLen);
      const remaining = totalBuffer.slice(4 + expectedLen);

      inputChunks = remaining.length > 0 ? [remaining] : [];
      expectedLen = null;

      try {
        const rawJson = msgBuffer.toString('utf8');
        const parsed = JSON.parse(rawJson);

        // Security validation
        if (!parsed || typeof parsed !== 'object') {
          sendNativeMessage({ error: 'Invalid message structure' });
          continue;
        }

        // Handle Ping / Status
        if (parsed.type === 'PING' || parsed.command === 'ping') {
          sendNativeMessage({
            type: 'PONG',
            version: 1,
            status: 'connected',
            host: 'TurboGrab Native Host v1.0'
          });
          continue;
        }

        // Forward legitimate commands to TurboGrab Desktop
        const response = await forwardToDesktop(parsed);
        sendNativeMessage(response);
      } catch (err) {
        sendNativeMessage({ error: 'Failed to process message: ' + err.message });
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
