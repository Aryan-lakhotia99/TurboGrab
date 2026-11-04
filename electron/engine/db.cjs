const path = require('path');
const os = require('os');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(os.homedir(), '.turbograb');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'turbograb.db');
let db = null;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema();
  }
  return db;
}

function initSchema() {
  // 1. Downloads Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      destination_path TEXT NOT NULL,
      total_bytes INTEGER DEFAULT 0,
      downloaded_bytes INTEGER DEFAULT 0,
      speed_bps INTEGER DEFAULT 0,
      eta_seconds INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      category TEXT DEFAULT 'Other',
      is_stream INTEGER DEFAULT 0,
      connections INTEGER DEFAULT 16,
      mode TEXT DEFAULT 'smart',
      etag TEXT,
      last_modified TEXT,
      checksum_sha256 TEXT,
      verified_hash TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      cookies TEXT,
      referrer TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);

  // Migrate columns if table already existed with older schema
  const existingCols = db.prepare('PRAGMA table_info(downloads)').all().map(c => c.name);
  const requiredCols = [
    { name: 'speed_bps', def: 'INTEGER DEFAULT 0' },
    { name: 'eta_seconds', def: 'INTEGER DEFAULT 0' },
    { name: 'category', def: "TEXT DEFAULT 'Other'" },
    { name: 'connections', def: 'INTEGER DEFAULT 16' },
    { name: 'mode', def: "TEXT DEFAULT 'smart'" },
    { name: 'etag', def: 'TEXT' },
    { name: 'last_modified', def: 'TEXT' },
    { name: 'checksum_sha256', def: 'TEXT' },
    { name: 'verified_hash', def: 'TEXT' },
    { name: 'error_message', def: 'TEXT' },
    { name: 'retry_count', def: 'INTEGER DEFAULT 0' },
    { name: 'cookies', def: 'TEXT' },
    { name: 'referrer', def: 'TEXT' },
    { name: 'user_agent', def: 'TEXT' },
    { name: 'updated_at', def: 'INTEGER DEFAULT 0' },
    { name: 'completed_at', def: 'INTEGER' },
  ];

  for (const col of requiredCols) {
    if (!existingCols.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE downloads ADD COLUMN ${col.name} ${col.def};`);
      } catch (_) {}
    }
  }

  // 2. Segments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_segments (
      download_id TEXT NOT NULL,
      segment_id INTEGER NOT NULL,
      start_byte INTEGER NOT NULL,
      end_byte INTEGER NOT NULL,
      current_offset INTEGER NOT NULL,
      speed_bps INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0,
      PRIMARY KEY (download_id, segment_id),
      FOREIGN KEY (download_id) REFERENCES downloads(id) ON DELETE CASCADE
    );
  `);

  // 3. Categories Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      extensions TEXT NOT NULL,
      destination_folder TEXT NOT NULL,
      is_custom INTEGER DEFAULT 0
    );
  `);

  // 4. Queues Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_queues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_concurrent INTEGER DEFAULT 3,
      speed_limit_bps INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 1
    );
  `);

  // 5. Scheduled Tasks Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      download_id TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      stop_time INTEGER,
      action_on_complete TEXT DEFAULT 'notify',
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);

  // 6. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS application_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 7. History Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_history (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      destination_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      category TEXT DEFAULT 'Other',
      status TEXT DEFAULT 'completed',
      completed_at INTEGER NOT NULL,
      checksum_sha256 TEXT
    );
  `);

  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const defaults = [
    { id: 'cat_video', name: 'Videos', ext: JSON.stringify(['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', '3gp', 'ts', 'm2ts', 'vob', 'ogv']), dir: path.join(downloadsDir, 'Videos') },
    { id: 'cat_music', name: 'Music', ext: JSON.stringify(['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac', 'mid', 'midi']), dir: path.join(downloadsDir, 'Music') },
    { id: 'cat_doc', name: 'Documents', ext: JSON.stringify(['pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'ppt', 'pptx', 'pptm', 'pps', 'ppsx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'epub', 'mobi']), dir: path.join(downloadsDir, 'Documents') },
    { id: 'cat_archive', name: 'Compressed Files', ext: JSON.stringify(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab', 'z', 'tgz', 'tbz2', 'txz', 'lzma', 'lzh', 'arj', 'ace', 'dmg', 'img', 'bin']), dir: path.join(downloadsDir, 'Compressed') },
    { id: 'cat_prog', name: 'Programs', ext: JSON.stringify(['exe', 'msi', 'pkg', 'deb', 'rpm', 'apk', 'appimage', 'jar', 'war', 'run', 'bat', 'cmd', 'vbs', 'msix', 'appx']), dir: path.join(downloadsDir, 'Programs') },
    { id: 'cat_img', name: 'Images', ext: JSON.stringify(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'psd', 'ai', 'eps', 'raw', 'cr2']), dir: path.join(downloadsDir, 'Images') },
    { id: 'cat_other', name: 'Other Files', ext: JSON.stringify([]), dir: path.join(downloadsDir, 'Other') },
  ];

  // Populate Default Categories if empty
  const catCount = db.prepare('SELECT COUNT(*) as count FROM download_categories').get().count;
  if (catCount === 0) {
    const insertCat = db.prepare(`
      INSERT INTO download_categories (id, name, extensions, destination_folder, is_custom)
      VALUES (?, ?, ?, ?, 0)
    `);

    for (const c of defaults) {
      if (!fs.existsSync(c.dir)) {
        try { fs.mkdirSync(c.dir, { recursive: true }); } catch (_) {}
      }
      insertCat.run(c.id, c.name, c.ext, c.dir);
    }
  } else {
    // Keep standard categories updated with latest comprehensive extensions
    try {
      const updateCat = db.prepare(`UPDATE download_categories SET extensions = ? WHERE id = ? AND is_custom = 0`);
      for (const c of defaults) {
        updateCat.run(c.ext, c.id);
      }
    } catch (_) {}
  }

  // Populate Default Settings if empty
  const defaultSettings = [
    { key: 'theme', value: 'light' },
    { key: 'default_download_folder', value: path.join(os.homedir(), 'Downloads') },
    { key: 'max_concurrent_downloads', value: '4' },
    { key: 'max_connections_per_task', value: '16' },
    { key: 'download_mode', value: 'smart' },
    { key: 'auto_organize', value: 'true' },
    { key: 'duplicate_detection', value: 'true' },
    { key: 'clipboard_monitor', value: 'true' },
    { key: 'speed_limit_bps', value: '0' },
    { key: 'minimize_to_tray', value: 'true' },
    { key: 'notify_on_complete', value: 'true' },
    { key: 'auto_intercept_browser', value: 'true' },
    { key: 'ask_download_location', value: 'true' }
  ];

  const setSetting = db.prepare(`
    INSERT OR IGNORE INTO application_settings (key, value) VALUES (?, ?)
  `);
  for (const s of defaultSettings) {
    setSetting.run(s.key, s.value);
  }
}

// Database helper functions
const dbApi = {
  getDb,

  // --- Downloads ---
  getAllDownloads() {
    const database = getDb();
    const rows = database.prepare(`SELECT * FROM downloads ORDER BY created_at DESC`).all();
    const segStmt = database.prepare(`SELECT * FROM download_segments WHERE download_id = ? ORDER BY segment_id ASC`);

    return rows.map(r => {
      const segRows = segStmt.all(r.id);
      return {
        ...r,
        is_stream: !!r.is_stream,
        segments: segRows.map(s => ({
          id: s.segment_id,
          start_byte: s.start_byte,
          end_byte: s.end_byte,
          current_offset: s.current_offset,
          speed_bps: s.speed_bps,
          active_worker_id: s.is_completed ? null : s.segment_id,
          is_completed: !!s.is_completed
        }))
      };
    });
  },

  getDownload(id) {
    const database = getDb();
    const row = database.prepare(`SELECT * FROM downloads WHERE id = ?`).get(id);
    if (!row) return null;
    const segRows = database.prepare(`SELECT * FROM download_segments WHERE download_id = ? ORDER BY segment_id ASC`).all(id);
    return {
      ...row,
      is_stream: !!row.is_stream,
      segments: segRows.map(s => ({
        id: s.segment_id,
        start_byte: s.start_byte,
        end_byte: s.end_byte,
        current_offset: s.current_offset,
        speed_bps: s.speed_bps,
        active_worker_id: s.is_completed ? null : s.segment_id,
        is_completed: !!s.is_completed
      }))
    };
  },

  saveDownload(item) {
    const database = getDb();
    const upsertDownload = database.prepare(`
      INSERT INTO downloads (
        id, url, filename, destination_path, total_bytes, downloaded_bytes,
        speed_bps, eta_seconds, status, category, is_stream, connections,
        mode, etag, last_modified, checksum_sha256, verified_hash, error_message,
        retry_count, cookies, referrer, user_agent, created_at, updated_at, completed_at
      ) VALUES (
        @id, @url, @filename, @destination_path, @total_bytes, @downloaded_bytes,
        @speed_bps, @eta_seconds, @status, @category, @is_stream, @connections,
        @mode, @etag, @last_modified, @checksum_sha256, @verified_hash, @error_message,
        @retry_count, @cookies, @referrer, @user_agent, @created_at, @updated_at, @completed_at
      ) ON CONFLICT(id) DO UPDATE SET
        filename = excluded.filename,
        destination_path = excluded.destination_path,
        total_bytes = excluded.total_bytes,
        downloaded_bytes = excluded.downloaded_bytes,
        speed_bps = excluded.speed_bps,
        eta_seconds = excluded.eta_seconds,
        status = excluded.status,
        category = excluded.category,
        etag = excluded.etag,
        last_modified = excluded.last_modified,
        checksum_sha256 = excluded.checksum_sha256,
        verified_hash = excluded.verified_hash,
        error_message = excluded.error_message,
        retry_count = excluded.retry_count,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `);

    upsertDownload.run({
      id: item.id,
      url: item.url,
      filename: item.filename,
      destination_path: item.destination_path,
      total_bytes: item.total_bytes || 0,
      downloaded_bytes: item.downloaded_bytes || 0,
      speed_bps: item.speed_bps || 0,
      eta_seconds: item.eta_seconds || 0,
      status: item.status || 'queued',
      category: item.category || 'Other',
      is_stream: item.is_stream ? 1 : 0,
      connections: item.connections || 16,
      mode: item.mode || 'smart',
      etag: item.etag || null,
      last_modified: item.last_modified || null,
      checksum_sha256: item.checksum_sha256 || null,
      verified_hash: item.verified_hash || null,
      error_message: item.error_message || null,
      retry_count: item.retry_count || 0,
      cookies: item.cookies || null,
      referrer: item.referrer || null,
      user_agent: item.user_agent || null,
      created_at: item.created_at || Date.now(),
      updated_at: Date.now(),
      completed_at: item.completed_at || null
    });

    if (item.segments && Array.isArray(item.segments)) {
      const upsertSegment = database.prepare(`
        INSERT INTO download_segments (
          download_id, segment_id, start_byte, end_byte, current_offset, speed_bps, is_completed
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(download_id, segment_id) DO UPDATE SET
          current_offset = excluded.current_offset,
          speed_bps = excluded.speed_bps,
          is_completed = excluded.is_completed
      `);

      for (const seg of item.segments) {
        upsertSegment.run(
          item.id,
          seg.id,
          seg.start_byte,
          seg.end_byte,
          seg.current_offset,
          seg.speed_bps || 0,
          seg.is_completed ? 1 : 0
        );
      }
    }
  },

  deleteDownload(id) {
    const database = getDb();
    database.prepare(`DELETE FROM download_segments WHERE download_id = ?`).run(id);
    database.prepare(`DELETE FROM downloads WHERE id = ?`).run(id);
    database.prepare(`DELETE FROM scheduled_tasks WHERE download_id = ?`).run(id);
  },

  // --- History ---
  recordHistory(item) {
    const database = getDb();
    database.prepare(`
      INSERT OR REPLACE INTO download_history (
        id, url, filename, destination_path, file_size, category, status, completed_at, checksum_sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.url,
      item.filename,
      item.destination_path,
      item.total_bytes || item.downloaded_bytes || 0,
      item.category || 'Other',
      item.status || 'completed',
      item.completed_at || Date.now(),
      item.checksum_sha256 || null
    );
  },

  getHistory(search = '', category = '', limit = 100) {
    const database = getDb();
    let query = `SELECT * FROM download_history WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (filename LIKE ? OR url LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }
    query += ` ORDER BY completed_at DESC LIMIT ?`;
    params.push(limit);

    return database.prepare(query).all(...params);
  },

  clearHistory() {
    const database = getDb();
    database.prepare(`DELETE FROM download_history`).run();
  },

  // --- Categories ---
  getCategories() {
    const database = getDb();
    const rows = database.prepare(`SELECT * FROM download_categories ORDER BY name ASC`).all();
    return rows.map(r => ({
      ...r,
      extensions: JSON.parse(r.extensions || '[]'),
      is_custom: !!r.is_custom
    }));
  },

  saveCategory(cat) {
    const database = getDb();
    database.prepare(`
      INSERT INTO download_categories (id, name, extensions, destination_folder, is_custom)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        extensions = excluded.extensions,
        destination_folder = excluded.destination_folder
    `).run(
      cat.id,
      cat.name,
      JSON.stringify(cat.extensions || []),
      cat.destination_folder,
      cat.is_custom ? 1 : 0
    );
  },

  deleteCategory(id) {
    const database = getDb();
    database.prepare(`DELETE FROM download_categories WHERE id = ? AND is_custom = 1`).run(id);
  },

  // --- Settings ---
  getSetting(key) {
    const database = getDb();
    const row = database.prepare(`SELECT value FROM application_settings WHERE key = ?`).get(key);
    return row ? row.value : null;
  },

  getAllSettings() {
    const database = getDb();
    const rows = database.prepare(`SELECT * FROM application_settings`).all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return settings;
  },

  setSetting(key, value) {
    const database = getDb();
    database.prepare(`
      INSERT INTO application_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },

  // --- Scheduled Tasks ---
  getScheduledTasks() {
    const database = getDb();
    return database.prepare(`
      SELECT st.*, d.filename, d.url, d.total_bytes, d.destination_path
      FROM scheduled_tasks st
      JOIN downloads d ON st.download_id = d.id
      ORDER BY st.scheduled_time ASC
    `).all();
  },

  addScheduledTask(task) {
    const database = getDb();
    database.prepare(`
      INSERT INTO scheduled_tasks (id, download_id, scheduled_time, stop_time, action_on_complete, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.download_id,
      task.scheduled_time,
      task.stop_time || null,
      task.action_on_complete || 'notify',
      task.status || 'pending',
      Date.now()
    );
  },

  deleteScheduledTask(id) {
    const database = getDb();
    database.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`).run(id);
  },

  // --- Analytics ---
  getAnalytics() {
    const database = getDb();
    const totalDownloads = database.prepare(`SELECT COUNT(*) as count FROM downloads`).get().count;
    const completedDownloads = database.prepare(`SELECT COUNT(*) as count FROM downloads WHERE status = 'completed'`).get().count;
    const failedDownloads = database.prepare(`SELECT COUNT(*) as count FROM downloads WHERE status = 'error'`).get().count;
    const totalBytes = database.prepare(`SELECT SUM(downloaded_bytes) as total FROM downloads`).get().total || 0;

    const categoryBreakdown = database.prepare(`
      SELECT category, COUNT(*) as count, SUM(downloaded_bytes) as bytes
      FROM downloads
      GROUP BY category
    `).all();

    const historyItems = database.prepare(`
      SELECT completed_at, file_size
      FROM download_history
      ORDER BY completed_at DESC
      LIMIT 100
    `).all();

    return {
      totalDownloads,
      completedDownloads,
      failedDownloads,
      totalBytes,
      categoryBreakdown,
      historyItems
    };
  }
};

module.exports = dbApi;
