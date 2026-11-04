pub mod demuxer;
pub mod ledger;
pub mod mmap_writer;
pub mod segmenter;
pub mod server;
pub mod types;

use crate::engine::demuxer::StreamDemuxer;
use crate::engine::ledger::SqliteLedger;
use crate::engine::mmap_writer::MmapWriter;
use crate::engine::segmenter::SegmenterEngine;
use crate::engine::types::{DownloadItem, EngineStats, InterceptPayload, SegmentState, TaskStatus};
use anyhow::{Context, Result};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::{broadcast, mpsc};

pub struct ActiveTaskHandle {
    pub pause_signal: Arc<AtomicBool>,
    pub cancel_signal: Arc<AtomicBool>,
    pub downloaded_bytes: Arc<AtomicU64>,
    pub segmenter: Option<Arc<SegmenterEngine>>,
}

pub struct DownloadEngine {
    pub downloads: Arc<RwLock<HashMap<String, DownloadItem>>>,
    pub active_tasks: Arc<RwLock<HashMap<String, ActiveTaskHandle>>>,
    pub ledger: Arc<SqliteLedger>,
    pub global_speed_limit: Arc<AtomicU64>,
    pub default_download_dir: PathBuf,
    pub app_handle: Arc<RwLock<Option<AppHandle>>>,
}

impl DownloadEngine {
    pub fn new(data_dir: &Path, download_dir: PathBuf) -> Result<Arc<Self>> {
        let db_path = data_dir.join("turbograb.db");
        let ledger = Arc::new(SqliteLedger::new(&db_path)?);

        // Load existing downloads from ledger
        let mut initial_downloads = HashMap::new();
        if let Ok(saved) = ledger.get_all_downloads() {
            for mut item in saved {
                // If app crashed while downloading, mark as paused
                if item.status == TaskStatus::Downloading {
                    item.status = TaskStatus::Paused;
                }
                initial_downloads.insert(item.id.clone(), item);
            }
        }

        let engine = Arc::new(Self {
            downloads: Arc::new(RwLock::new(initial_downloads)),
            active_tasks: Arc::new(RwLock::new(HashMap::new())),
            ledger,
            global_speed_limit: Arc::new(AtomicU64::new(0)),
            default_download_dir: download_dir,
            app_handle: Arc::new(RwLock::new(None)),
        });

        // Spawn background speed calculator & stats monitor
        let engine_clone = Arc::clone(&engine);
        tokio::spawn(async move {
            let mut last_instant = Instant::now();
            let mut last_bytes: HashMap<String, u64> = HashMap::new();

            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;
                let now = Instant::now();
                let elapsed_sec = (now - last_instant).as_secs_f64().max(0.1);
                last_instant = now;

                let mut active_count = 0;
                let mut total_speed = 0u64;

                {
                    let active_tasks = engine_clone.active_tasks.read();
                    let mut downloads = engine_clone.downloads.write();

                    for (id, handle) in active_tasks.iter() {
                        if let Some(item) = downloads.get_mut(id) {
                            if item.status == TaskStatus::Downloading {
                                active_count += 1;
                                let current_bytes = handle.downloaded_bytes.load(Ordering::Relaxed);
                                let prev = last_bytes.get(id).copied().unwrap_or(current_bytes);
                                let delta = current_bytes.saturating_sub(prev);
                                last_bytes.insert(id.clone(), current_bytes);

                                let speed = (delta as f64 / elapsed_sec) as u64;
                                item.speed_bps = speed;
                                item.downloaded_bytes = current_bytes;
                                total_speed += speed;

                                if speed > 0 && item.total_bytes > current_bytes {
                                    item.eta_seconds = (item.total_bytes - current_bytes) / speed;
                                }

                                if let Some(ref seg) = handle.segmenter {
                                    item.segments = seg.get_segments_snapshot();
                                }
                            }
                        }
                    }
                }

                // Emit live update to Tauri window
                if let Some(ref app) = *engine_clone.app_handle.read() {
                    let _ = app.emit(
                        "turbograb://stats",
                        EngineStats {
                            global_speed_bps: total_speed,
                            active_downloads: active_count,
                            total_downloads: engine_clone.downloads.read().len(),
                            speed_limit_bps: engine_clone.global_speed_limit.load(Ordering::Relaxed),
                        },
                    );
                }
            }
        });

        Ok(engine)
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        let mut h = self.app_handle.write();
        *h = Some(handle);
    }

    /// Add and start a new download
    pub async fn start_download(
        self: Arc<Self>,
        url: String,
        filename_opt: Option<String>,
        cookies: Option<String>,
        referrer: Option<String>,
        user_agent: Option<String>,
        is_stream: bool,
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();

        let filename = filename_opt.unwrap_or_else(|| {
            url.split('?')
                .next()
                .unwrap_or(&url)
                .split('/')
                .last()
                .filter(|s| !s.is_empty())
                .unwrap_or("download.bin")
                .to_string()
        });

        let destination_path = self.default_download_dir.join(&filename);
        let now = chrono::Utc::now().timestamp();

        let mut item = DownloadItem {
            id: id.clone(),
            url: url.clone(),
            filename,
            destination_path: destination_path.to_string_lossy().to_string(),
            total_bytes: 0,
            downloaded_bytes: 0,
            speed_bps: 0,
            eta_seconds: 0,
            status: TaskStatus::Queued,
            segments: Vec::new(),
            is_stream,
            cookies: cookies.clone(),
            referrer: referrer.clone(),
            user_agent: user_agent.clone(),
            error_message: None,
            created_at: now,
            updated_at: now,
        };

        {
            let mut d = self.downloads.write();
            d.insert(id.clone(), item.clone());
        }
        let _ = self.ledger.save_download(&item);

        // Spawn runner
        let engine_clone = Arc::clone(&self);
        let id_clone = id.clone();
        tokio::spawn(async move {
            engine_clone.execute_download(id_clone).await;
        });

        Ok(id)
    }

    /// Core execution for a download task
    async fn execute_download(self: Arc<Self>, id: String) {
        let (url, dest_path, cookies, user_agent, is_stream) = {
            let mut downloads = self.downloads.write();
            if let Some(item) = downloads.get_mut(&id) {
                item.status = TaskStatus::Downloading;
                (
                    item.url.clone(),
                    PathBuf::from(&item.destination_path),
                    item.cookies.clone(),
                    item.user_agent.clone(),
                    item.is_stream,
                )
            } else {
                return;
            }
        };

        let pause_signal = Arc::new(AtomicBool::new(false));
        let cancel_signal = Arc::new(AtomicBool::new(false));
        let downloaded_bytes = Arc::new(AtomicU64::new(0));

        if is_stream || url.contains(".m3u8") || url.contains(".mpd") {
            // Stream Demuxer Pipeline
            {
                let mut d = self.downloads.write();
                if let Some(item) = d.get_mut(&id) {
                    item.status = TaskStatus::Demuxing;
                }
            }

            let demuxer = StreamDemuxer::new();
            let parsed_res = if url.contains(".mpd") {
                demuxer.parse_dash(&url).await
            } else {
                demuxer.parse_hls(&url).await
            };

            match parsed_res {
                Ok(playlist) => {
                    let total_segs = playlist.video_segments.len();
                    {
                        let mut d = self.downloads.write();
                        if let Some(item) = d.get_mut(&id) {
                            item.total_bytes = (total_segs * 1024 * 512) as u64; // approximate
                        }
                    }

                    let dl_bytes_for_prog = Arc::clone(&downloaded_bytes);
                    let result = demuxer
                        .download_and_multiplex(
                            playlist,
                            &dest_path,
                            cancel_signal.clone(),
                            move |done, _| {
                                dl_bytes_for_prog
                                    .store((done * 1024 * 512) as u64, Ordering::Relaxed);
                            },
                        )
                        .await;

                    let mut d = self.downloads.write();
                    if let Some(item) = d.get_mut(&id) {
                        if result.is_ok() {
                            item.status = TaskStatus::Completed;
                            item.downloaded_bytes = item.total_bytes;
                        } else {
                            item.status = TaskStatus::Error;
                            item.error_message = Some(format!("{:?}", result.err()));
                        }
                    }
                }
                Err(e) => {
                    let mut d = self.downloads.write();
                    if let Some(item) = d.get_mut(&id) {
                        item.status = TaskStatus::Error;
                        item.error_message = Some(format!("Stream parse error: {:?}", e));
                    }
                }
            }
            return;
        }

        // Standard Zero-Copy Dynamic Segmented Download
        let client = reqwest::Client::new();
        let probe_res = SegmenterEngine::probe(&client, &url, cookies.as_deref(), user_agent.as_deref()).await;

        let (total_size, supports_range) = match probe_res {
            Ok(p) => p,
            Err(e) => {
                let mut d = self.downloads.write();
                if let Some(item) = d.get_mut(&id) {
                    item.status = TaskStatus::Error;
                    item.error_message = Some(format!("Network probe failed: {:?}", e));
                }
                return;
            }
        };

        {
            let mut d = self.downloads.write();
            if let Some(item) = d.get_mut(&id) {
                item.total_bytes = total_size;
            }
        }

        // Initialize MmapWriter (pre-allocates target file zero-copy)
        let writer_res = MmapWriter::new(&dest_path, total_size.max(1));
        let writer = match writer_res {
            Ok(w) => Arc::new(w),
            Err(e) => {
                let mut d = self.downloads.write();
                if let Some(item) = d.get_mut(&id) {
                    item.status = TaskStatus::Error;
                    item.error_message = Some(format!("Disk pre-allocation failed: {:?}", e));
                }
                return;
            }
        };

        let segmenter = Arc::new(SegmenterEngine::new(
            url,
            writer,
            total_size,
            cookies,
            user_agent,
            Arc::clone(&self.global_speed_limit),
        ));

        // Register active task handle
        {
            let mut tasks = self.active_tasks.write();
            tasks.insert(
                id.clone(),
                ActiveTaskHandle {
                    pause_signal: Arc::clone(&pause_signal),
                    cancel_signal: Arc::clone(&cancel_signal),
                    downloaded_bytes: Arc::clone(&segmenter.downloaded_bytes),
                    segmenter: Some(Arc::clone(&segmenter)),
                },
            );
        }

        let num_workers = if supports_range && total_size > 1024 * 1024 {
            16
        } else {
            1
        };

        let (tx, _rx) = broadcast::channel(100);
        let run_res = Arc::clone(&segmenter).run(num_workers, tx).await;

        {
            let mut d = self.downloads.write();
            if let Some(item) = d.get_mut(&id) {
                match run_res {
                    Ok(_) => {
                        item.status = TaskStatus::Completed;
                        item.downloaded_bytes = total_size;
                        item.eta_seconds = 0;
                        item.speed_bps = 0;
                    }
                    Err(e) => {
                        if pause_signal.load(Ordering::Relaxed) {
                            item.status = TaskStatus::Paused;
                        } else {
                            item.status = TaskStatus::Error;
                            item.error_message = Some(format!("{:?}", e));
                        }
                    }
                }
                let _ = self.ledger.save_download(item);
            }
            let mut tasks = self.active_tasks.write();
            tasks.remove(&id);
        }
    }

    pub fn pause_download(&self, id: &str) -> Result<()> {
        let tasks = self.active_tasks.read();
        if let Some(handle) = tasks.get(id) {
            handle.pause_signal.store(true, Ordering::Relaxed);
        }
        let mut d = self.downloads.write();
        if let Some(item) = d.get_mut(id) {
            item.status = TaskStatus::Paused;
            let _ = self.ledger.save_download(item);
        }
        Ok(())
    }

    pub fn resume_download(self: Arc<Self>, id: &str) -> Result<()> {
        let is_paused = {
            let d = self.downloads.read();
            d.get(id).map(|item| item.status == TaskStatus::Paused).unwrap_or(false)
        };

        if is_paused {
            let engine = Arc::clone(&self);
            let id_str = id.to_string();
            tokio::spawn(async move {
                engine.execute_download(id_str).await;
            });
        }
        Ok(())
    }

    pub fn cancel_download(&self, id: &str) -> Result<()> {
        let mut tasks = self.active_tasks.write();
        if let Some(handle) = tasks.remove(id) {
            handle.cancel_signal.store(true, Ordering::Relaxed);
        }
        let mut d = self.downloads.write();
        d.remove(id);
        let _ = self.ledger.delete_download(id);
        Ok(())
    }

    pub fn set_speed_limit(&self, bytes_per_sec: u64) {
        self.global_speed_limit.store(bytes_per_sec, Ordering::Relaxed);
    }

    pub fn get_queue_stats(&self) -> EngineStats {
        let d = self.downloads.read();
        let active = d.values().filter(|i| i.status == TaskStatus::Downloading).count();
        let total_speed: u64 = d.values().map(|i| i.speed_bps).sum();

        EngineStats {
            global_speed_bps: total_speed,
            active_downloads: active,
            total_downloads: d.len(),
            speed_limit_bps: self.global_speed_limit.load(Ordering::Relaxed),
        }
    }

    pub fn get_all_downloads(&self) -> Vec<DownloadItem> {
        let d = self.downloads.read();
        let mut list: Vec<DownloadItem> = d.values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub async fn handle_browser_intercept(self: Arc<Self>, payload: InterceptPayload) {
        println!("[TurboGrab Intercept] Dispatched from extension: {}", payload.url);
        let is_stream = payload.is_stream.unwrap_or(false);
        let _ = self
            .start_download(
                payload.url,
                payload.filename,
                payload.cookies,
                payload.referrer,
                payload.user_agent,
                is_stream,
            )
            .await;
    }
}
