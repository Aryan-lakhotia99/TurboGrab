const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const db = require('../electron/engine/db.cjs');
const downloadManager = require('../electron/engine/downloadManager.cjs');
const { handleMessage, setInterceptHandler } = require('../electron/engine/wsServer.cjs');

async function runTests() {
  console.log('🧪 [Test Suite] IDM-Style Download Location & Custom Destination Verification\n');

  // 1. Verify db setting
  const askLoc = db.getSetting('ask_download_location');
  console.log(`[Test 1] Checking ask_download_location default setting: ${askLoc}`);
  assert.strictEqual(askLoc, 'true', 'Default ask_download_location should be true');
  console.log('  ✓ ask_download_location is enabled by default\n');

  // 2. Mock test server for file download
  const server = http.createServer((req, res) => {
    const payload = Buffer.alloc(1024 * 1024, 0xAA); // 1MB payload
    res.writeHead(200, {
      'Content-Length': payload.length,
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes'
    });
    res.end(payload);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/test_sample.bin`;

  // 3. Test startDownload with a custom destination folder
  const customFolder = path.join(os.tmpdir(), 'turbograb_test_custom_location_' + Date.now());
  fs.mkdirSync(customFolder, { recursive: true });

  console.log(`[Test 2] Starting accelerated download with custom destination_folder: ${customFolder}`);
  const taskId = await downloadManager.startDownload({
    url: testUrl,
    filename: 'custom_saved_file.bin',
    destination_folder: customFolder,
    connections: 4
  });

  // Wait for download to finish
  console.log(`  Waiting for download task ${taskId} to finish...`);
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const item = downloadManager.downloads.get(taskId);
      if (item && item.status === 'completed') {
        clearInterval(interval);
        resolve();
      } else if (item && item.status === 'error') {
        clearInterval(interval);
        reject(new Error(item.error_message || 'Download error'));
      } else if (Date.now() - start > 10000) {
        clearInterval(interval);
        reject(new Error('Download timeout'));
      }
    }, 200);
  });

  const expectedFile = path.join(customFolder, 'custom_saved_file.bin');
  assert.ok(fs.existsSync(expectedFile), `File should exist at custom path: ${expectedFile}`);
  const stats = fs.statSync(expectedFile);
  assert.strictEqual(stats.size, 1024 * 1024, 'File size matches 1MB');
  console.log(`  ✓ File verified in custom location: ${expectedFile} (${stats.size} bytes)\n`);

  // 4. Test WebSocket interceptor with prompt handler
  console.log('[Test 3] Testing WebSocket extension intercept with UI prompt handler');
  let promptReceived = null;
  setInterceptHandler((payload) => {
    promptReceived = payload;
    return true; // Successfully prompted user in UI
  });

  const response = await handleMessage({
    version: 1,
    command: 'intercept_download',
    payload: {
      url: 'https://example.com/downloads/archive.zip',
      filename: 'archive.zip'
    },
    requestId: 'req_123'
  });

  assert.strictEqual(response.status, 'prompting', 'Interceptor response should be prompting');
  assert.strictEqual(response.success, true);
  assert.ok(promptReceived, 'Prompt handler should receive intercepted payload');
  assert.strictEqual(promptReceived.url, 'https://example.com/downloads/archive.zip');
  console.log('  ✓ Extension interception correctly dispatched UI prompt for download confirmation\n');

  // Clean up
  try {
    fs.unlinkSync(expectedFile);
    fs.rmdirSync(customFolder);
  } catch (_) {}
  server.close();

  console.log('🎉 All download location & IDM-style prompt tests passed successfully!');
}

runTests().then(() => {
  downloadManager.dispose();
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed:', err);
  downloadManager.dispose();
  process.exit(1);
});
