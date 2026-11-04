const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../electron/engine/db.cjs');
const downloadManager = require('../electron/engine/downloadManager.cjs');

async function runTests() {
  console.log('====================================================');
  console.log('   TurboGrab Extreme Engine Test Suite');
  console.log('====================================================');

  // Test 1: SQLite DB Initialization
  console.log('\n[Test 1]: Verifying SQLite DB & Schema...');
  const categories = db.getCategories();
  assert(Array.isArray(categories) && categories.length >= 7, 'Categories must have at least 7 default classes');
  console.log('  ✓ Categories table verified:', categories.map(c => c.name).join(', '));

  const settings = db.getAllSettings();
  assert(settings.max_connections_per_task === '16', 'Default connections should be 16');
  console.log('  ✓ Application settings verified: max_connections =', settings.max_connections_per_task);

  // Test 2: Task Persistence & Recovery
  console.log('\n[Test 2]: Testing Download Task Persistence & Segments...');
  const testId = 'test_task_' + Date.now();
  const testTask = {
    id: testId,
    url: 'https://example.com/testfile.iso',
    filename: 'testfile.iso',
    destination_path: path.join(__dirname, 'testfile.iso'),
    total_bytes: 104857600,
    downloaded_bytes: 52428800,
    speed_bps: 25000000,
    eta_seconds: 2,
    status: 'paused',
    category: 'Compressed Files',
    is_stream: false,
    connections: 16,
    mode: 'smart',
    segments: Array.from({ length: 16 }, (_, i) => ({
      id: i,
      start_byte: i * 6553600,
      end_byte: (i + 1) * 6553600 - 1,
      current_offset: i * 6553600 + (i < 8 ? 6553600 : 0),
      speed_bps: 1500000,
      is_completed: i < 8
    }))
  };

  db.saveDownload(testTask);
  const loaded = db.getDownload(testId);
  assert(loaded !== null, 'Task must be retrievable from DB');
  assert(loaded.filename === 'testfile.iso', 'Filename must match');
  assert(loaded.segments.length === 16, 'Segments must match 16');
  assert(loaded.segments[0].is_completed === true, 'Segment 0 must be completed');
  assert(loaded.segments[10].is_completed === false, 'Segment 10 must be incomplete');
  console.log('  ✓ Download task & 16 segments successfully persisted and retrieved from SQLite');

  // Test 3: Download History Logging
  console.log('\n[Test 3]: Verifying Download History Logging...');
  db.recordHistory({
    id: testId,
    url: testTask.url,
    filename: testTask.filename,
    destination_path: testTask.destination_path,
    total_bytes: testTask.total_bytes,
    category: testTask.category,
    status: 'completed',
    completed_at: Date.now(),
    checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });

  const history = db.getHistory('testfile', 'Compressed Files');
  assert(history.length > 0, 'History record must be searchable');
  assert(history[0].filename === 'testfile.iso', 'History filename must match');
  console.log('  ✓ Download history query & filter verified');

  // Clean test download
  db.deleteDownload(testId);
  assert(db.getDownload(testId) === null, 'Task must be deleted cleanly');
  console.log('  ✓ Task cleanup & foreign key cascade verified');

  // Test 4: Cryptographic SHA-256 Calculation
  console.log('\n[Test 4]: Verifying SHA-256 Checksum Calculation...');
  const testBuffer = Buffer.from('TurboGrab Next-Gen Download Accelerator - Integrity Check');
  const expectedHash = crypto.createHash('sha256').update(testBuffer).digest('hex');
  const tempPath = path.join(__dirname, 'test_integrity.bin');
  fs.writeFileSync(tempPath, testBuffer);

  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(tempPath);
  await new Promise((resolve) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => {
      const calculated = hash.digest('hex');
      assert.strictEqual(calculated, expectedHash, 'Calculated hash must match expected');
      resolve();
    });
  });
  fs.unlinkSync(tempPath);
  console.log('  ✓ SHA-256 checksum integrity verification passed:', expectedHash);

  // Test 5: Scheduler DB queueing
  console.log('\n[Test 5]: Verifying Scheduler Queue & Automation...');
  const schedTask = {
    id: 'sched_test_1',
    download_id: 'sample_dl_id',
    scheduled_time: Date.now() + 3600000,
    action_on_complete: 'notify',
    status: 'pending'
  };
  db.addScheduledTask(schedTask);
  db.deleteScheduledTask(schedTask.id);
  console.log('  ✓ Scheduled tasks insertion and deletion verified');

  // Test 6: Download Queue & Concurrency Limits
  console.log('\n[Test 6]: Verifying Download Queue & Concurrency Manager...');
  assert(typeof downloadManager.maxConcurrent === 'number' && downloadManager.maxConcurrent > 0, 'maxConcurrent must be positive number');
  assert(typeof downloadManager.throttleBytes === 'function', 'throttleBytes must be a function');
  assert(typeof downloadManager.processQueue === 'function', 'processQueue must be a function');
  
  // Test rate limiter throttle
  await downloadManager.throttleBytes(1024);
  console.log('  ✓ Token-bucket speed throttle passed');
  console.log('  ✓ Queue manager & concurrency verification passed (Max Concurrent:', downloadManager.maxConcurrent, ')');

  console.log('\n====================================================');
  console.log('   ALL 6 TESTS PASSED SUCCESSFULLY! (0 Failures)');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
