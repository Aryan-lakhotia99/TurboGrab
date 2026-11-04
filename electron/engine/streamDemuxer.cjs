const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function getFFmpegPath() {
  const customPath = path.join(
    os.homedir(),
    'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages',
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'ffmpeg-9.0.2-full_build', 'bin', 'ffmpeg.exe'
  );
  if (fs.existsSync(customPath)) {
    return customPath;
  }
  return 'ffmpeg';
}

class StreamDemuxer {
  constructor() {
    this.ffmpegPath = getFFmpegPath();
  }

  async downloadStreamWithFFmpeg(manifestUrl, destPath, options, onProgress, cancelCheck) {
    const { cookies, referrer, userAgent } = options || {};
    let headersStr = `User-Agent: ${userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'}\r\n`;
    if (referrer) headersStr += `Referer: ${referrer}\r\n`;
    if (cookies) headersStr += `Cookie: ${cookies}\r\n`;

    const args = [
      '-y',
      '-headers', headersStr,
      '-i', manifestUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      destPath
    ];

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });

      proc.stderr.on('data', (data) => {
        if (cancelCheck && cancelCheck()) {
          proc.kill();
          return;
        }
        const text = data.toString();
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch && onProgress) {
          const secs = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3]);
          const currentSize = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
          onProgress({
            downloadedBytes: currentSize,
            totalBytes: Math.round(currentSize * 1.25),
            speedBps: Math.round(currentSize / (secs || 1)),
            etaSeconds: 5,
            progressPct: 75
          });
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve(destPath);
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  }

  async parseHls(playlistUrl, cookies, referrer) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };
    if (cookies) headers['Cookie'] = cookies;
    if (referrer) headers['Referer'] = referrer;

    const resp = await fetch(playlistUrl, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching playlist`);
    const text = await resp.text();

    const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
    const lines = text.split('\n').map(l => l.trim());

    const isMaster = lines.some(l => l.startsWith('#EXT-X-STREAM-INF'));
    const segments = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.startsWith('#')) {
        const fullUrl = line.startsWith('http') ? line : baseUrl + line;
        segments.push(fullUrl);
      }
    }

    if (isMaster && segments.length > 0) {
      return this.parseHls(segments[0], cookies, referrer);
    }

    return segments;
  }

  async downloadAndMuxHls(playlistUrl, destPath, options, onProgress, cancelCheck) {
    // For DASH (.mpd) or modern dynamic manifests, attempt native FFmpeg stream pipeline first
    if (playlistUrl.includes('.mpd')) {
      try {
        return await this.downloadStreamWithFFmpeg(playlistUrl, destPath, options, onProgress, cancelCheck);
      } catch (e) {
        console.warn('[TurboGrab] FFmpeg native DASH attempt failed, attempting fallback...', e.message);
      }
    }

    const { cookies, referrer } = options || {};
    const segments = await this.parseHls(playlistUrl, cookies, referrer);
    if (!segments.length) throw new Error('Playlist contains zero media segments');

    const tempDir = path.join(path.dirname(destPath), `.turbograb_tmp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };
    if (cookies) headers['Cookie'] = cookies;
    if (referrer) headers['Referer'] = referrer;

    const downloadedFiles = [];
    const concurrency = 8;
    let totalBytesDownloaded = 0;
    const startTime = Date.now();

    for (let i = 0; i < segments.length; i += concurrency) {
      if (cancelCheck && cancelCheck()) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw new Error('Cancelled');
      }

      const chunk = segments.slice(i, i + concurrency);
      const promises = chunk.map(async (segUrl, idx) => {
        const segIdx = i + idx;
        const segPath = path.join(tempDir, `seg_${String(segIdx).padStart(5, '0')}.ts`);
        const r = await fetch(segUrl, { headers });
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(segPath, buf);
        totalBytesDownloaded += buf.length;
        return segPath;
      });

      const chunkPaths = await Promise.all(promises);
      downloadedFiles.push(...chunkPaths);

      const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
      const speed = Math.round(totalBytesDownloaded / elapsedSec);
      const estTotalBytes = Math.round((totalBytesDownloaded / downloadedFiles.length) * segments.length);
      const eta = speed > 0 ? Math.round((estTotalBytes - totalBytesDownloaded) / speed) : 0;

      if (onProgress) {
        onProgress({
          downloadedBytes: totalBytesDownloaded,
          totalBytes: estTotalBytes,
          speedBps: speed,
          etaSeconds: eta,
          progressPct: (downloadedFiles.length / segments.length) * 100,
          segmentCount: downloadedFiles.length,
          totalSegments: segments.length
        });
      }
    }

    const concatList = downloadedFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
    const listFile = path.join(tempDir, 'list.txt');
    fs.writeFileSync(listFile, concatList);

    await new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c', 'copy',
        destPath
      ], { stdio: 'ignore' });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          try {
            const outStream = fs.createWriteStream(destPath);
            for (const file of downloadedFiles) {
              outStream.write(fs.readFileSync(file));
            }
            outStream.end();
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      });
      proc.on('error', () => {
        try {
          const outStream = fs.createWriteStream(destPath);
          for (const file of downloadedFiles) {
            outStream.write(fs.readFileSync(file));
          }
          outStream.end();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}

    return destPath;
  }
}

module.exports = new StreamDemuxer();
module.exports.getFFmpegPath = getFFmpegPath;
