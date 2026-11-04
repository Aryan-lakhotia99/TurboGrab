const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { URL } = require('url');
const { spawn } = require('child_process');
const { Agent, setGlobalDispatcher } = require('undici');
const { Ytdl } = require('@distube/ytdl-core');
const streamDemuxer = require('./streamDemuxer.cjs');
const db = require('./db.cjs');

// High-Performance TCP Connection Pool & Keep-Alive Dispatcher (IDM Performance Engine)
try {
  const downloadDispatcher = new Agent({
    connections: 128,
    pipelining: 0,
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 120000,
    connect: {
      timeout: 15000,
      keepAlive: true,
      keepAliveInitialDelay: 1000
    }
  });
  setGlobalDispatcher(downloadDispatcher);
} catch (_) {}

const ytdl = new Ytdl();
const DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/shorts');
}

// RFC 5987 / RFC 6266 Content-Disposition header parser
function parseContentDispositionFilename(header) {
  if (!header || typeof header !== 'string') return null;
  // RFC 5987 / RFC 6266 filename*=UTF-8''...
  const utf8Match = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch (_) {
      return utf8Match[1].trim();
    }
  }
  // Quoted filename="..."
  const quotedMatch = header.match(/filename\s*=\s*"([^"]+)"/i);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }
  // Unquoted filename=... (stop before semicolon)
  const unquotedMatch = header.match(/filename\s*=\s*([^;]+)/i);
  if (unquotedMatch && unquotedMatch[1]) {
    return unquotedMatch[1].trim().replace(/["']/g, '');
  }
  return null;
}

// Map standard MIME types to file extensions
function getExtensionFromMime(mime) {
  if (!mime || typeof mime !== 'string') return '';
  const lower = mime.toLowerCase().split(';')[0].trim();
  const mimeMap = {
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-rar': '.rar',
    'application/x-7z-compressed': '.7z',
    'application/x-tar': '.tar',
    'application/gzip': '.gz',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/rtf': '.rtf',
    'application/epub+zip': '.epub',
    'application/x-msdownload': '.exe',
    'application/x-msi': '.msi',
    'application/vnd.android.package-archive': '.apk',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/x-matroska': '.mkv',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/flac': '.flac'
  };
  return mimeMap[lower] || '';
}

// Map extensions to categories and appropriate subdirectories
function determineCategory(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  try {
    const categories = db.getCategories();
    for (const cat of categories) {
      if (cat.extensions.includes(ext)) {
        return { category: cat.name, folder: cat.destination_folder };
      }
    }
  } catch (_) {}
  return { category: 'Other Files', folder: path.join(DOWNLOAD_DIR, 'Other') };
}

class DownloadManager {
  constructor() {
    this.downloads = new Map();
    this.activeAborts = new Map();
    this.speedLimitBps = 0;
    this.tokenBucket = { tokens: 0, lastCheck: Date.now() };
    this.maxConcurrent = 4;
    this.onNotification = null;

    this.initSettings();
    this.loadTasks();
    this.initSchedulerLoop();
    this.initAutoSaveLoop();
  }

  initSettings() {
    try {
      const maxConn = db.getSetting('max_concurrent_downloads');
      if (maxConn) this.maxConcurrent = parseInt(maxConn, 10) || 4;
      const speedLim = db.getSetting('speed_limit_bps');
      if (speedLim) this.speedLimitBps = parseInt(speedLim, 10) || 0;
      this.tokenBucket.tokens = this.speedLimitBps;
      this.tokenBucket.lastCheck = Date.now();
    } catch (_) {}
  }

  updateSetting(key, value) {
    if (key === 'max_concurrent_downloads') {
      this.maxConcurrent = parseInt(value, 10) || 4;
      this.processQueue();
    } else if (key === 'speed_limit_bps') {
      this.speedLimitBps = parseInt(value, 10) || 0;
      this.tokenBucket.tokens = this.speedLimitBps;
      this.tokenBucket.lastCheck = Date.now();
    }
  }

  // Token-bucket rate limiter coordinated across all download threads
  async throttleBytes(byteCount) {
    if (this.speedLimitBps <= 0) return;
    const now = Date.now();
    const elapsedSec = (now - this.tokenBucket.lastCheck) / 1000;
    this.tokenBucket.lastCheck = now;
    this.tokenBucket.tokens = Math.min(
      this.speedLimitBps,
      this.tokenBucket.tokens + elapsedSec * this.speedLimitBps
    );

    this.tokenBucket.tokens -= byteCount;
    if (this.tokenBucket.tokens < 0) {
      const deficit = -this.tokenBucket.tokens;
      const waitMs = (deficit / this.speedLimitBps) * 1000;
      if (waitMs > 1) {
        await new Promise(r => setTimeout(r, Math.min(waitMs, 500)));
      }
      this.tokenBucket.tokens = 0;
      this.tokenBucket.lastCheck = Date.now();
    }
  }

  getActiveCount() {
    let count = 0;
    for (const d of this.downloads.values()) {
      if (d.status === 'downloading' || d.status === 'demuxing') {
        count++;
      }
    }
    return count;
  }

  processQueue() {
    const active = this.getActiveCount();
    if (active >= this.maxConcurrent) return;

    const availableSlots = this.maxConcurrent - active;
    const queuedItems = Array.from(this.downloads.values())
      .filter(d => d.status === 'queued')
      .sort((a, b) => a.created_at - b.created_at);

    for (let i = 0; i < Math.min(availableSlots, queuedItems.length); i++) {
      const item = queuedItems[i];
      item.status = 'downloading';
      item.error_message = null;
      this.saveTask(item);

      const abortCtrl = new AbortController();
      this.activeAborts.set(item.id, abortCtrl);
      this.executeDownload(item.id, abortCtrl).catch((err) => {
        console.error(`[Download Error ${item.id}]:`, err.message);
        const cur = this.downloads.get(item.id);
        if (cur && cur.status !== 'cancelled') {
          cur.status = 'error';
          cur.error_message = err.message;
          cur.speed_bps = 0;
          this.saveTask(cur);
          if (this.onNotification) this.onNotification('error', cur);
        }
        this.processQueue();
      });
    }
  }

  loadTasks() {
    try {
      const items = db.getAllDownloads();
      for (const item of items) {
        if (item.status === 'downloading' || item.status === 'demuxing') {
          item.status = 'paused';
        }
        item.speed_bps = 0;
        this.downloads.set(item.id, item);
      }
    } catch (e) {
      console.warn('[TurboGrab DB Load Error]:', e.message);
    }
  }

  saveTask(item) {
    try {
      db.saveDownload(item);
    } catch (e) {
      console.warn('[TurboGrab DB Save Error]:', e.message);
    }
  }

  getAll() {
    return Array.from(this.downloads.values()).sort((a, b) => b.created_at - a.created_at);
  }

  getStats() {
    const active = Array.from(this.downloads.values()).filter(d => d.status === 'downloading' || d.status === 'demuxing');
    const totalSpeed = active.reduce((sum, d) => sum + (d.speed_bps || 0), 0);
    return {
      global_speed_bps: totalSpeed,
      active_downloads: active.length,
      total_downloads: this.downloads.size,
      speed_limit_bps: this.speedLimitBps
    };
  }

  findDuplicate(url, filename) {
    for (const item of this.downloads.values()) {
      if (item.url === url && item.status !== 'error') {
        return { isDuplicate: true, existingId: item.id, status: item.status };
      }
    }
    return { isDuplicate: false };
  }

  async startDownload(params) {
    let { url, filename, cookies, referrer, user_agent, is_stream, connections, mode, checksum_sha256, quality } = params;

    // Deduplication check: return existing task if already active or queued
    if (url) {
      const duplicate = this.findDuplicate(url, filename);
      if (duplicate.isDuplicate && (duplicate.status === 'downloading' || duplicate.status === 'queued')) {
        console.log(`[Deduplication]: Reusing active task ${duplicate.existingId} for ${url}`);
        return duplicate.existingId;
      }
    }

    const id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    if (url && url.startsWith('blob:') && referrer) {
      url = referrer;
    }

    if (!filename) {
      try {
        const u = new URL(url);
        const base = path.basename(u.pathname);
        if (base && base !== '/') {
          filename = decodeURIComponent(base);
        }
      } catch (_) {}
    }

    if (!filename) {
      filename = (is_stream || isYouTubeUrl(url)) ? `video_${Date.now()}.mp4` : `download_${Date.now()}`;
    }

    // Sanitize filename to prevent directory traversal
    filename = filename.replace(/[<>:"/\\|?*]/g, '_').trim() || `file_${Date.now()}`;
    const ext = path.extname(filename);
    if (!ext && (is_stream || isYouTubeUrl(url))) {
      filename += '.mp4';
    }

    const catInfo = determineCategory(filename);
    const targetFolder = params.destination_folder || catInfo.folder;
    if (!fs.existsSync(targetFolder)) {
      try { fs.mkdirSync(targetFolder, { recursive: true }); } catch (_) {}
    }

    let destPath = params.destination_path || path.join(targetFolder, filename);
    // Collision protection
    let counter = 1;
    const baseName = path.basename(filename, ext);
    while (fs.existsSync(destPath)) {
      const existingTask = Array.from(this.downloads.values()).find(d => d.destination_path === destPath);
      if (existingTask && existingTask.status === 'paused') {
        // Resuming existing file
        break;
      }
      destPath = path.join(targetFolder, `${baseName} (${counter})${ext}`);
      counter++;
    }

    const isYT = isYouTubeUrl(url);
    const isStream = is_stream || isYT || url.includes('.m3u8') || url.includes('.mpd');

    const numConns = connections && [1, 2, 4, 8, 16].includes(Number(connections)) ? Number(connections) : 16;
    const segments = Array.from({ length: numConns }, (_, i) => ({
      id: i,
      start_byte: 0,
      end_byte: 0,
      current_offset: 0,
      speed_bps: 0,
      active_worker_id: i,
      is_completed: false
    }));

    const isActiveSlotAvailable = this.getActiveCount() < this.maxConcurrent;
    const initialStatus = isActiveSlotAvailable ? 'downloading' : 'queued';

    const item = {
      id,
      url,
      filename: path.basename(destPath),
      destination_path: destPath,
      total_bytes: 0,
      downloaded_bytes: 0,
      speed_bps: 0,
      eta_seconds: 0,
      status: initialStatus,
      category: catInfo.category,
      is_stream: isStream,
      connections: numConns,
      mode: mode || 'smart',
      quality: quality || '1080p',
      etag: null,
      last_modified: null,
      checksum_sha256: checksum_sha256 || null,
      verified_hash: null,
      error_message: null,
      retry_count: 0,
      segments,
      cookies,
      referrer,
      user_agent: user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      created_at: Date.now(),
      updated_at: Date.now(),
      completed_at: null
    };

    this.downloads.set(id, item);
    this.saveTask(item);

    if (isActiveSlotAvailable) {
      const abortController = new AbortController();
      this.activeAborts.set(id, abortController);

      this.executeDownload(id, abortController).catch((err) => {
        console.error(`[Download Error ${id}]:`, err.message);
        const cur = this.downloads.get(id);
        if (cur && cur.status !== 'cancelled') {
          cur.status = 'error';
          cur.error_message = err.message;
          cur.speed_bps = 0;
          this.saveTask(cur);
          if (this.onNotification) this.onNotification('error', cur);
        }
        this.processQueue();
      });
    }

    return id;
  }

  async startBatch(items) {
    const createdIds = [];
    for (const item of items) {
      if (item && item.url) {
        const id = await this.startDownload(item);
        createdIds.push(id);
      }
    }
    return createdIds;
  }

  async executeDownload(id, abortCtrl) {
    const item = this.downloads.get(id);
    if (!item) return;

    const { url, cookies, referrer } = item;

    // 1. YouTube video downloader using Ytdl + FFmpeg multiplexer
    if (isYouTubeUrl(url)) {
      await this.downloadYouTubeVideo(item, abortCtrl);
      return;
    }

    // 2. HLS (.m3u8) or DASH (.mpd) playlist stream
    if (url.includes('.m3u8') || url.includes('.mpd')) {
      item.status = 'demuxing';
      await streamDemuxer.downloadAndMuxHls(
        url,
        item.destination_path,
        { cookies, referrer },
        (p) => {
          item.downloaded_bytes = p.downloadedBytes;
          item.total_bytes = p.totalBytes;
          item.speed_bps = p.speedBps;
          item.eta_seconds = p.etaSeconds;
          const pct = p.progressPct / 100;
          const completedCount = Math.floor(pct * 16);
          item.segments.forEach((seg, idx) => {
            seg.is_completed = idx < completedCount;
          });
        },
        () => abortCtrl.signal.aborted
      );

      item.status = 'completed';
      item.speed_bps = 0;
      item.eta_seconds = 0;
      item.completed_at = Date.now();
      item.segments.forEach(s => s.is_completed = true);
      this.saveTask(item);
      db.recordHistory(item);
      this.calculateChecksumAsync(item.id, item.destination_path);
      console.log(`[TurboGrab] Stream Download Completed: ${item.destination_path}`);
      if (this.onNotification) this.onNotification('completed', item);
      this.processQueue();
      return;
    }

    // 3. Direct multi-part HTTP range accelerator
    await this.downloadDirectMultiPart(item, abortCtrl);
  }

  async downloadYouTubeVideo(item, abortCtrl) {
    const { url } = item;
    item.status = 'downloading';

    let info = null;
    try {
      info = await ytdl.getInfo(url);
      if (info && info.videoDetails && info.videoDetails.title) {
        const safeTitle = info.videoDetails.title.replace(/[<>:"/\\|?*]/g, '_').trim();
        item.filename = `${safeTitle}.mp4`;
        const catInfo = determineCategory(item.filename);
        item.destination_path = path.join(catInfo.folder, item.filename);
      }
    } catch (e) {
      console.warn('[Ytdl getInfo notice]:', e.message);
    }

    const dest = item.destination_path;
    const ffmpegPath = streamDemuxer.getFFmpegPath();

    try {
      if (!info) info = await ytdl.getInfo(url);

      const reqQuality = (item.quality || '').toLowerCase();
      const isAudioOnly = reqQuality === 'audio' || reqQuality === 'mp3' || reqQuality === 'm4a';

      if (isAudioOnly) {
        const safeBase = path.basename(item.filename, path.extname(item.filename));
        item.filename = `${safeBase}.mp3`;
        const musicCat = determineCategory(item.filename);
        item.destination_path = path.join(musicCat.folder, item.filename);

        const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo && (f.audioBitrate || 0) >= 128) ||
                            info.formats.find(f => f.hasAudio && !f.hasVideo) ||
                            info.formats.find(f => f.hasAudio);
        if (!audioFormat) throw new Error('No audio track found on video source');

        const audioSize = parseInt(audioFormat.contentLength || '0', 10);
        if (audioSize > 0) item.total_bytes = audioSize;

        const ffmpeg = spawn(ffmpegPath, [
          '-loglevel', 'error',
          '-y',
          '-i', 'pipe:3',
          '-c:a', 'libmp3lame',
          '-q:a', '2',
          item.destination_path
        ], {
          stdio: ['inherit', 'inherit', 'inherit', 'pipe']
        });

        const audioStream = ytdl.download(url, { format: audioFormat });
        let downloadedBytes = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        audioStream.on('data', chunk => {
          if (abortCtrl.signal.aborted) {
            audioStream.destroy();
            ffmpeg.kill();
            return;
          }
          downloadedBytes += chunk.length;
          item.downloaded_bytes = downloadedBytes;

          const now = Date.now();
          if (now - lastTime >= 350) {
            const dt = (now - lastTime) / 1000;
            item.speed_bps = Math.round((downloadedBytes - lastBytes) / dt);
            if (item.total_bytes > downloadedBytes && item.speed_bps > 0) {
              item.eta_seconds = Math.round((item.total_bytes - downloadedBytes) / item.speed_bps);
            }
            lastTime = now;
            lastBytes = downloadedBytes;
            if (item.total_bytes > 0) {
              const pct = downloadedBytes / item.total_bytes;
              const completedChunks = Math.floor(pct * 16);
              item.segments.forEach((seg, idx) => {
                seg.is_completed = idx < completedChunks;
              });
            }
          }
        });

        audioStream.pipe(ffmpeg.stdio[3]);

        await new Promise((resolve, reject) => {
          ffmpeg.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg audio extract closed with code ${code}`));
          });
          ffmpeg.on('error', reject);
        });
      } else {
        // Video download with specific quality match (4K, 2K, 1080p, 720p, 480p, 360p, etc.)
        let targetNumber = reqQuality.replace(/[^0-9]/g, '');
        if (reqQuality.includes('4k') || reqQuality.includes('2160')) targetNumber = '2160';
        else if (reqQuality.includes('2k') || reqQuality.includes('1440')) targetNumber = '1440';

        let videoFormat = null;
        if (targetNumber) {
          videoFormat = info.formats.find(f => f.hasVideo && !f.hasAudio && f.qualityLabel && f.qualityLabel.includes(targetNumber)) ||
                        info.formats.find(f => f.hasVideo && f.qualityLabel && f.qualityLabel.includes(targetNumber));
        }

        // Fallbacks if target resolution not directly present: pick highest resolution stream available
        if (!videoFormat) {
          const sorted = info.formats
            .filter(f => f.hasVideo)
            .sort((a, b) => (b.height || 0) - (a.height || 0));

          videoFormat = sorted.find(f => !f.hasAudio) || sorted[0];
        }

        const audioFormat = info.formats.find(f => f.hasAudio && !f.hasVideo) || info.formats.find(f => f.hasAudio);

        if (videoFormat && audioFormat) {
          const videoSize = parseInt(videoFormat.contentLength || '0', 10);
          const audioSize = parseInt(audioFormat.contentLength || '0', 10);
          const totalEstimated = videoSize + audioSize;
          if (totalEstimated > 0) item.total_bytes = totalEstimated;

          const ffmpeg = spawn(ffmpegPath, [
            '-loglevel', 'error',
            '-y',
            '-i', 'pipe:3',
            '-i', 'pipe:4',
            '-c:v', 'copy',
            '-c:a', 'aac',
            dest
          ], {
            stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe']
          });

          const videoStream = ytdl.download(url, { format: videoFormat });
          const audioStream = ytdl.download(url, { format: audioFormat });

          let videoBytes = 0;
          let audioBytes = 0;
          let lastTime = Date.now();
          let lastBytes = 0;

          videoStream.on('data', chunk => {
            if (abortCtrl.signal.aborted) {
              videoStream.destroy();
              audioStream.destroy();
              ffmpeg.kill();
              return;
            }
            videoBytes += chunk.length;
            item.downloaded_bytes = videoBytes + audioBytes;

            const now = Date.now();
            if (now - lastTime >= 350) {
              const dt = (now - lastTime) / 1000;
              const speed = Math.round((item.downloaded_bytes - lastBytes) / dt);
              item.speed_bps = speed;
              if (item.total_bytes > item.downloaded_bytes && speed > 0) {
                item.eta_seconds = Math.round((item.total_bytes - item.downloaded_bytes) / speed);
              }
              lastTime = now;
              lastBytes = item.downloaded_bytes;

              if (item.total_bytes > 0) {
                const pct = item.downloaded_bytes / item.total_bytes;
                const completedChunks = Math.floor(pct * 16);
                item.segments.forEach((seg, idx) => {
                  seg.is_completed = idx < completedChunks;
                });
              }
            }
          });

          audioStream.on('data', chunk => {
            audioBytes += chunk.length;
            item.downloaded_bytes = videoBytes + audioBytes;
          });

          videoStream.pipe(ffmpeg.stdio[3]);
          audioStream.pipe(ffmpeg.stdio[4]);

          await new Promise((resolve, reject) => {
            ffmpeg.on('close', code => {
              if (code === 0) resolve();
              else reject(new Error(`FFmpeg closed with code ${code}`));
            });
            ffmpeg.on('error', reject);
          });
        } else {
          const writeStream = fs.createWriteStream(dest);
          const stream = ytdl.download(url);
          let downloaded = 0;
          let lastTime = Date.now();
          let lastBytes = 0;

          stream.on('data', chunk => {
            if (abortCtrl.signal.aborted) {
              stream.destroy();
              writeStream.destroy();
              return;
            }
            downloaded += chunk.length;
            item.downloaded_bytes = downloaded;
            const now = Date.now();
            if (now - lastTime >= 350) {
              const dt = (now - lastTime) / 1000;
              item.speed_bps = Math.round((downloaded - lastBytes) / dt);
              if (item.total_bytes > downloaded && item.speed_bps > 0) {
                item.eta_seconds = Math.round((item.total_bytes - downloaded) / item.speed_bps);
              }
              lastTime = now;
              lastBytes = downloaded;
              if (item.total_bytes > 0) {
                const pct = downloaded / item.total_bytes;
                const completedChunks = Math.floor(pct * 16);
                item.segments.forEach((seg, idx) => {
                  seg.is_completed = idx < completedChunks;
                });
              }
            }
          });

          stream.pipe(writeStream);
          await new Promise((res, rej) => {
            writeStream.on('finish', res);
            writeStream.on('error', rej);
          });
        }
      }

      item.status = 'completed';
      const stat = fs.existsSync(dest) ? fs.statSync(dest) : null;
      if (stat) {
        item.downloaded_bytes = stat.size;
        item.total_bytes = stat.size;
      }
      item.speed_bps = 0;
      item.eta_seconds = 0;
      item.completed_at = Date.now();
      item.segments.forEach(s => s.is_completed = true);
      this.saveTask(item);
      db.recordHistory(item);
      this.calculateChecksumAsync(item.id, dest);
      console.log(`[TurboGrab] YouTube Video Download Completed: ${dest}`);
      if (this.onNotification) this.onNotification('completed', item);
      this.processQueue();
    } catch (err) {
      console.error('[YouTube Download Error]:', err);
      item.status = 'error';
      item.error_message = err.message;
      this.saveTask(item);
      if (this.onNotification) this.onNotification('error', item);
      this.processQueue();
    }
  }

  async downloadDirectMultiPart(item, abortCtrl) {
    const { url, cookies, referrer } = item;

    const headers = {
      'User-Agent': item.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    };
    if (cookies) headers['Cookie'] = cookies;
    if (referrer) headers['Referer'] = referrer;

    // Probe server capabilities
    let headResp = await fetch(url, { method: 'HEAD', headers, signal: abortCtrl.signal }).catch(() => null);
    if (!headResp || !headResp.ok) {
      // Fallback: Some servers reject HEAD, try GET with range 0-0
      headResp = await fetch(url, { method: 'GET', headers: { ...headers, Range: 'bytes=0-0' }, signal: abortCtrl.signal }).catch(() => null);
    }

    let totalSize = 0;
    let acceptsRanges = false;

    if (headResp && headResp.ok) {
      const cr = headResp.headers.get('content-range');
      if (cr && cr.includes('/')) {
        totalSize = parseInt(cr.split('/')[1] || '0', 10);
        acceptsRanges = true;
      } else {
        totalSize = parseInt(headResp.headers.get('content-length') || '0', 10);
        acceptsRanges = headResp.headers.get('accept-ranges') === 'bytes';
      }
      item.etag = headResp.headers.get('etag');
      item.last_modified = headResp.headers.get('last-modified');

      const cd = headResp.headers.get('content-disposition');
      const parsedName = parseContentDispositionFilename(cd);
      if (parsedName) {
        item.filename = parsedName.replace(/[<>:"/\\|?*]/g, '_');
        const cat = determineCategory(item.filename);
        item.category = cat.category;
        item.destination_path = path.join(cat.folder, item.filename);
      } else if (!path.extname(item.filename)) {
        const extFromMime = getExtensionFromMime(headResp.headers.get('content-type'));
        if (extFromMime) {
          item.filename += extFromMime;
          const cat = determineCategory(item.filename);
          item.category = cat.category;
          item.destination_path = path.join(cat.folder, item.filename);
        }
      }
    }

    item.total_bytes = totalSize;
    const dest = item.destination_path;

    // Free disk space pre-flight check
    if (totalSize > 0) {
      try {
        if (fs.statfsSync) {
          const destDir = path.dirname(dest);
          const fsStat = fs.statfsSync(destDir);
          const freeBytes = fsStat.bavail * fsStat.bsize;
          if (freeBytes < totalSize) {
            throw new Error(`Insufficient disk space: ${(freeBytes / (1024 * 1024)).toFixed(1)} MB available, ${(totalSize / (1024 * 1024)).toFixed(1)} MB required.`);
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Insufficient disk space')) {
          throw err;
        }
      }
    }

    // ETag & Last-Modified validation on resume to prevent corrupted data
    let isResuming = fs.existsSync(dest) && item.downloaded_bytes > 0;
    if (isResuming && item.etag && headResp && headResp.ok) {
      const newEtag = headResp.headers.get('etag');
      if (newEtag && newEtag !== item.etag) {
        console.warn(`[TurboGrab Resume] Remote ETag changed (${item.etag} vs ${newEtag}). Restarting clean download.`);
        item.downloaded_bytes = 0;
        item.etag = newEtag;
        isResuming = false;
        try { fs.unlinkSync(dest); } catch (_) {}
      }
    }

    // Use r+ on resume so existing bytes are preserved
    const fd = isResuming ? fs.openSync(dest, 'r+') : fs.openSync(dest, 'w+');
    if (totalSize > 0 && !isResuming) {
      try {
        fs.ftruncateSync(fd, totalSize);
      } catch (_) {}
    }

    // Determine optimal concurrency based on mode and file size
    let numWorkers = item.connections || 16;
    if (!acceptsRanges || totalSize <= 1024 * 512) {
      numWorkers = 1;
    } else if (item.mode === 'smart') {
      if (totalSize > 50 * 1024 * 1024) numWorkers = 16;
      else if (totalSize > 10 * 1024 * 1024) numWorkers = 8;
      else numWorkers = 4;
    }

    const chunkSize = totalSize > 0 ? Math.ceil(totalSize / numWorkers) : 0;
    let activeDownloaded = isResuming ? item.downloaded_bytes : 0;
    const startTime = Date.now();
    let lastTime = startTime;
    let lastBytes = activeDownloaded;

    if (numWorkers > 1 && totalSize > 0) {
      const workerRanges = [];
      for (let i = 0; i < numWorkers; i++) {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize - 1, totalSize - 1);
        const savedCurrent = (item.segments[i] && item.segments[i].current_offset) ? item.segments[i].current_offset : start;
        const current = isResuming ? Math.min(Math.max(savedCurrent, start), end + 1) : start;
        const isDone = isResuming && (current > end || (item.segments[i] && item.segments[i].is_completed));

        workerRanges.push({ id: i, start, current, end, done: isDone, retries: 0 });
        item.segments[i] = {
          id: i,
          start_byte: start,
          end_byte: end,
          current_offset: current,
          speed_bps: 0,
          active_worker_id: i,
          is_completed: isDone
        };
      }

      const WRITE_BUFFER_SIZE = 256 * 1024; // 256KB coalesced memory buffer per worker

      const runWorker = async (w) => {
        const writeBuf = Buffer.allocUnsafe(WRITE_BUFFER_SIZE);
        let bufOffset = 0;
        let bufStartPos = w.current;

        const flushWorkerBuffer = () => {
          if (bufOffset > 0) {
            fs.writeSync(fd, writeBuf, 0, bufOffset, bufStartPos);
            bufStartPos += bufOffset;
            bufOffset = 0;
          }
        };

        while (!w.done && !abortCtrl.signal.aborted) {
          if (w.current > w.end) {
            flushWorkerBuffer();
            w.done = true;

            // Synchronized Dynamic Work-Stealing: Find slowest worker with largest remaining workload
            let maxRem = 0;
            let victim = null;
            for (const other of workerRanges) {
              if (!other.done && other.id !== w.id) {
                const rem = other.end - other.current;
                if (rem > maxRem && rem > 1024 * 512) {
                  maxRem = rem;
                  victim = other;
                }
              }
            }

            if (victim) {
              const midpoint = victim.current + Math.floor((victim.end - victim.current) / 2);
              w.start = midpoint + 1;
              w.current = midpoint + 1;
              w.end = victim.end;
              // Atomically reassign victim boundary to prevent overlapping duplicate writes
              victim.end = midpoint;
              w.done = false;
              bufStartPos = w.current;
              bufOffset = 0;
            } else {
              break;
            }
          }

          bufStartPos = w.current;
          bufOffset = 0;

          const rangeHeader = `bytes=${w.current}-${w.end}`;
          const chunkHeaders = { ...headers, Range: rangeHeader };

          try {
            const res = await fetch(url, { headers: chunkHeaders, signal: abortCtrl.signal });
            if (!res.ok && res.status !== 206) {
              if (res.status === 429) {
                // Rate limited by remote server — back off and jitter
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
                continue;
              }
              throw new Error(`HTTP ${res.status} streaming range`);
            }

            const reader = res.body.getReader();
            try {
              while (w.current <= w.end) {
                if (abortCtrl.signal.aborted) break;
                const { done, value } = await reader.read();
                if (done) break;

                let len = value.length;
                // Boundary check in case work was stolen mid-flight
                if (w.current + len - 1 > w.end) {
                  len = (w.end - w.current) + 1;
                }
                if (len <= 0) break;

                // Contiguous buffer coalescing (eliminates thousands of synchronous disk syscalls)
                let srcOffset = 0;
                while (len > 0) {
                  const space = WRITE_BUFFER_SIZE - bufOffset;
                  const toCopy = Math.min(len, space);
                  writeBuf.set(value.subarray(srcOffset, srcOffset + toCopy), bufOffset);
                  bufOffset += toCopy;
                  srcOffset += toCopy;
                  len -= toCopy;
                  w.current += toCopy;
                  activeDownloaded += toCopy;

                  if (bufOffset >= WRITE_BUFFER_SIZE) {
                    flushWorkerBuffer();
                  }
                }

                item.downloaded_bytes = activeDownloaded;

                // Bandwidth Limiter token-bucket throttling
                if (this.speedLimitBps > 0) {
                  await this.throttleBytes(value.length);
                }

                const now = Date.now();
                if (now - lastTime >= 250) {
                  const dt = (now - lastTime) / 1000;
                  const speed = Math.round((activeDownloaded - lastBytes) / dt);
                  item.speed_bps = speed;
                  if (totalSize > activeDownloaded && speed > 0) {
                    item.eta_seconds = Math.round((totalSize - activeDownloaded) / speed);
                  }
                  lastTime = now;
                  lastBytes = activeDownloaded;

                  if (item.segments[w.id]) {
                    item.segments[w.id].current_offset = w.current;
                    item.segments[w.id].is_completed = w.current >= w.end;
                  }
                }
              }
            } finally {
              flushWorkerBuffer();
              try { reader.cancel(); } catch (_) {}
            }

            if (w.current >= w.end) {
              w.done = true;
              if (item.segments[w.id]) item.segments[w.id].is_completed = true;
            }
          } catch (err) {
            flushWorkerBuffer();
            if (abortCtrl.signal.aborted) break;
            w.retries++;
            if (w.retries <= 3) {
              const backoff = Math.pow(2, w.retries) * 300 + Math.random() * 200;
              await new Promise(r => setTimeout(r, backoff));
            } else {
              throw err;
            }
          }
        }
        flushWorkerBuffer();
      };

      await Promise.all(workerRanges.map(w => runWorker(w)));

    } else {
      // Single-stream fallback with write coalescing
      const res = await fetch(url, { headers, signal: abortCtrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const WRITE_BUFFER_SIZE = 256 * 1024;
      const writeBuf = Buffer.allocUnsafe(WRITE_BUFFER_SIZE);
      let bufOffset = 0;
      let writePos = 0;

      const flushSingleBuffer = () => {
        if (bufOffset > 0) {
          fs.writeSync(fd, writeBuf, 0, bufOffset, writePos);
          writePos += bufOffset;
          bufOffset = 0;
        }
      };

      try {
        while (true) {
          if (abortCtrl.signal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;

          let len = value.length;
          let srcOffset = 0;
          while (len > 0) {
            const space = WRITE_BUFFER_SIZE - bufOffset;
            const toCopy = Math.min(len, space);
            writeBuf.set(value.subarray(srcOffset, srcOffset + toCopy), bufOffset);
            bufOffset += toCopy;
            srcOffset += toCopy;
            len -= toCopy;
            activeDownloaded += toCopy;

            if (bufOffset >= WRITE_BUFFER_SIZE) {
              flushSingleBuffer();
            }
          }

          item.downloaded_bytes = activeDownloaded;

          if (this.speedLimitBps > 0) {
            await this.throttleBytes(value.length);
          }

          const now = Date.now();
          if (now - lastTime >= 250) {
            const dt = (now - lastTime) / 1000;
            const speed = Math.round((activeDownloaded - lastBytes) / dt);
            item.speed_bps = speed;
            if (totalSize > activeDownloaded && speed > 0) {
              item.eta_seconds = Math.round((totalSize - activeDownloaded) / speed);
            }
            lastTime = now;
            lastBytes = activeDownloaded;

            if (totalSize > 0) {
              const pct = activeDownloaded / totalSize;
              const completedChunks = Math.floor(pct * 16);
              item.segments.forEach((seg, idx) => {
                seg.is_completed = idx < completedChunks;
              });
            }
          }
        }
      } finally {
        flushSingleBuffer();
        try { reader.cancel(); } catch (_) {}
      }
    }

    fs.closeSync(fd);

    if (!abortCtrl.signal.aborted) {
      item.status = 'completed';
      item.downloaded_bytes = item.total_bytes || activeDownloaded;
      item.total_bytes = item.total_bytes || activeDownloaded;
      item.speed_bps = 0;
      item.eta_seconds = 0;
      item.completed_at = Date.now();
      item.segments.forEach(s => s.is_completed = true);
      this.saveTask(item);
      db.recordHistory(item);
      this.calculateChecksumAsync(item.id, dest);
      console.log(`[TurboGrab] File Download Completed: ${dest} (${activeDownloaded} bytes)`);
      if (this.onNotification) this.onNotification('completed', item);
      this.processQueue();
    }
  }

  async calculateChecksumAsync(id, filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => {
        const digest = hash.digest('hex');
        const item = this.downloads.get(id);
        if (item) {
          item.verified_hash = digest;
          this.saveTask(item);
          console.log(`[TurboGrab Integrity] SHA-256 for ${item.filename}: ${digest}`);
        }
      });
    } catch (_) {}
  }

  pauseDownload(id) {
    const item = this.downloads.get(id);
    if (item && (item.status === 'downloading' || item.status === 'demuxing' || item.status === 'queued')) {
      const abort = this.activeAborts.get(id);
      if (abort) abort.abort();
      item.status = 'paused';
      item.speed_bps = 0;
      this.saveTask(item);
      this.processQueue();
    }
  }

  resumeDownload(id) {
    const item = this.downloads.get(id);
    if (item && (item.status === 'paused' || item.status === 'error' || item.status === 'queued')) {
      if (this.getActiveCount() >= this.maxConcurrent) {
        item.status = 'queued';
        item.error_message = null;
        item.speed_bps = 0;
        this.saveTask(item);
        return;
      }
      item.status = 'downloading';
      item.error_message = null;
      const abortCtrl = new AbortController();
      this.activeAborts.set(id, abortCtrl);
      this.executeDownload(id, abortCtrl).catch((err) => {
        item.status = 'error';
        item.error_message = err.message;
        item.speed_bps = 0;
        this.saveTask(item);
        if (this.onNotification) this.onNotification('error', item);
        this.processQueue();
      });
    }
  }

  cancelDownload(id, deleteFile = false) {
    const abort = this.activeAborts.get(id);
    if (abort) abort.abort();
    const item = this.downloads.get(id);
    if (deleteFile && item && fs.existsSync(item.destination_path)) {
      try { fs.unlinkSync(item.destination_path); } catch (_) {}
    }
    this.downloads.delete(id);
    db.deleteDownload(id);
    this.processQueue();
  }

  bulkPause() {
    for (const item of this.downloads.values()) {
      if (item.status === 'downloading' || item.status === 'demuxing') {
        this.pauseDownload(item.id);
      }
    }
  }

  bulkResume() {
    for (const item of this.downloads.values()) {
      if (item.status === 'paused') {
        this.resumeDownload(item.id);
      }
    }
  }

  bulkDelete(completedOnly = false) {
    for (const item of Array.from(this.downloads.values())) {
      if (completedOnly) {
        if (item.status === 'completed') {
          this.cancelDownload(item.id, false);
        }
      } else {
        this.cancelDownload(item.id, false);
      }
    }
  }

  initSchedulerLoop() {
    setInterval(() => {
      try {
        const tasks = db.getScheduledTasks();
        const now = Date.now();
        for (const t of tasks) {
          if (t.status === 'pending' && t.scheduled_time <= now) {
            console.log(`[TurboGrab Scheduler] Triggering task for download ID: ${t.download_id}`);
            const item = this.downloads.get(t.download_id);
            if (item && item.status === 'paused') {
              this.resumeDownload(t.download_id);
            }
            db.deleteScheduledTask(t.id);
          }
        }
      } catch (_) {}
    }, 5000);
  }

  initAutoSaveLoop() {
    this.autoSaveInterval = setInterval(() => {
      try {
        for (const item of this.downloads.values()) {
          if (item.status === 'downloading' || item.status === 'demuxing') {
            this.saveTask(item);
          }
        }
      } catch (_) {}
    }, 3000);
  }
}

module.exports = new DownloadManager();
