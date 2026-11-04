const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const downloadManager = require('../electron/engine/downloadManager.cjs');

async function benchmark(label, fileSizeMb = 64) {
  console.log(`\n======================================================`);
  console.log(`   BENCHMARK RUN: ${label} (${fileSizeMb} MB)`);
  console.log(`======================================================`);

  const totalBytes = fileSizeMb * 1024 * 1024;
  // Generate repeatable pseudo-random buffer blocks for fast high-speed transfer
  const block = crypto.randomBytes(1024 * 1024); // 1MB seed block
  const fullHash = crypto.createHash('sha256');
  for (let i = 0; i < fileSizeMb; i++) {
    fullHash.update(block);
  }
  const expectedHash = fullHash.digest('hex');

  const port = 49210;
  const server = http.createServer((req, res) => {
    if (req.url === '/benchmark.bin') {
      const range = req.headers.range;

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Length': totalBytes,
          'Accept-Ranges': 'bytes',
          'Content-Type': 'application/octet-stream',
          'ETag': '"bench-etag-1"'
        });
        res.end();
        return;
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;
        const chunkLen = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalBytes}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkLen,
          'Content-Type': 'application/octet-stream',
          'ETag': '"bench-etag-1"'
        });

        // Send data in slices matching the 1MB seed block
        let offset = start;
        let remaining = chunkLen;
        while (remaining > 0) {
          const sliceOffset = offset % (1024 * 1024);
          const toSend = Math.min(remaining, (1024 * 1024) - sliceOffset);
          res.write(block.subarray(sliceOffset, sliceOffset + toSend));
          offset += toSend;
          remaining -= toSend;
        }
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Length': totalBytes,
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream'
      });
      for (let i = 0; i < fileSizeMb; i++) {
        res.write(block);
      }
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));

  const t0 = performance.now();
  let peakSpeed = 0;

  const taskId = await downloadManager.startDownload({
    url: `http://127.0.0.1:${port}/benchmark.bin`,
    filename: `bench_${Date.now()}.bin`,
    connections: 16
  });

  const item = downloadManager.downloads.get(taskId);

  await new Promise(resolve => {
    const timer = setInterval(() => {
      if (item.speed_bps > peakSpeed) peakSpeed = item.speed_bps;
      if (item.status === 'completed' || item.status === 'error') {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });

  const t1 = performance.now();
  const elapsedSec = (t1 - t0) / 1000;
  const avgSpeedMBps = (fileSizeMb / elapsedSec).toFixed(2);
  const peakSpeedMBps = (peakSpeed / (1024 * 1024)).toFixed(2);

  // Verify SHA-256 integrity
  let actualHash = 'none';
  if (fs.existsSync(item.destination_path)) {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(item.destination_path));
    actualHash = h.digest('hex');
    fs.unlinkSync(item.destination_path);
  }

  server.close();

  console.log(`Results:`);
  console.log(`  - File Size:             ${fileSizeMb} MB`);
  console.log(`  - Completion Time:       ${elapsedSec.toFixed(3)}s`);
  console.log(`  - Average Throughput:    ${avgSpeedMBps} MB/s`);
  console.log(`  - Peak Throughput:       ${peakSpeedMBps} MB/s`);
  console.log(`  - Integrity Validated:   ${actualHash === expectedHash ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`  - Status:                ${item.status}`);

  return {
    label,
    elapsedSec,
    avgSpeedMBps: parseFloat(avgSpeedMBps),
    peakSpeedMBps: parseFloat(peakSpeedMBps),
    intact: actualHash === expectedHash
  };
}

module.exports = { benchmark };

if (require.main === module) {
  benchmark('Baseline Pre-Optimization', 64)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
