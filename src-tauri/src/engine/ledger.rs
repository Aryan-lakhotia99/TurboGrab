use crate::engine::types::{DownloadItem, SegmentState, TaskStatus};
use anyhow::{Context, Result};
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Arc;

pub struct SqliteLedger {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteLedger {
    pub fn new(db_path: &Path) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(db_path)
            .with_context(|| format!("Failed to open SQLite database at {:?}", db_path))?;

        // Initialize schema
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                filename TEXT NOT NULL,
                destination_path TEXT NOT NULL,
                total_bytes INTEGER NOT NULL,
                downloaded_bytes INTEGER NOT NULL,
                status TEXT NOT NULL,
                is_stream INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS segments (
                download_id TEXT NOT NULL,
                segment_id INTEGER NOT NULL,
                start_byte INTEGER NOT NULL,
                end_byte INTEGER NOT NULL,
                current_offset INTEGER NOT NULL,
                is_completed INTEGER NOT NULL,
                PRIMARY KEY (download_id, segment_id)
            );
            "#,
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn save_download(&self, item: &DownloadItem) -> Result<()> {
        let conn = self.conn.lock();
        let status_str = match item.status {
            TaskStatus::Queued => "queued",
            TaskStatus::Downloading => "downloading",
            TaskStatus::Paused => "paused",
            TaskStatus::Completed => "completed",
            TaskStatus::Demuxing => "demuxing",
            TaskStatus::Error => "error",
        };

        conn.execute(
            r#"
            INSERT INTO downloads (id, url, filename, destination_path, total_bytes, downloaded_bytes, status, is_stream, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                downloaded_bytes = excluded.downloaded_bytes,
                status = excluded.status,
                updated_at = excluded.updated_at
            "#,
            params![
                item.id,
                item.url,
                item.filename,
                item.destination_path,
                item.total_bytes as i64,
                item.downloaded_bytes as i64,
                status_str,
                if item.is_stream { 1 } else { 0 },
                item.created_at,
                item.updated_at,
            ],
        )?;

        Ok(())
    }

    pub fn save_segments(&self, download_id: &str, segments: &[SegmentState]) -> Result<()> {
        let mut conn = self.conn.lock();
        let tx = conn.transaction()?;

        for seg in segments {
            tx.execute(
                r#"
                INSERT INTO segments (download_id, segment_id, start_byte, end_byte, current_offset, is_completed)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(download_id, segment_id) DO UPDATE SET
                    current_offset = excluded.current_offset,
                    is_completed = excluded.is_completed
                "#,
                params![
                    download_id,
                    seg.id as i64,
                    seg.start_byte as i64,
                    seg.end_byte as i64,
                    seg.current_offset as i64,
                    if seg.is_completed { 1 } else { 0 },
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn get_all_downloads(&self) -> Result<Vec<DownloadItem>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, url, filename, destination_path, total_bytes, downloaded_bytes, status, is_stream, created_at, updated_at FROM downloads ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            let status_str: String = row.get(6)?;
            let status = match status_str.as_str() {
                "downloading" => TaskStatus::Downloading,
                "paused" => TaskStatus::Paused,
                "completed" => TaskStatus::Completed,
                "demuxing" => TaskStatus::Demuxing,
                "error" => TaskStatus::Error,
                _ => TaskStatus::Queued,
            };

            let is_stream: i64 = row.get(7)?;

            Ok(DownloadItem {
                id: row.get(0)?,
                url: row.get(1)?,
                filename: row.get(2)?,
                destination_path: row.get(3)?,
                total_bytes: row.get::<_, i64>(4)? as u64,
                downloaded_bytes: row.get::<_, i64>(5)? as u64,
                speed_bps: 0,
                eta_seconds: 0,
                status,
                segments: Vec::new(),
                is_stream: is_stream == 1,
                cookies: None,
                referrer: None,
                user_agent: None,
                error_message: None,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_download(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM segments WHERE download_id = ?1", params![id])?;
        conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
        Ok(())
    }
}
