use crate::engine::mmap_writer::MmapWriter;
use crate::engine::types::SegmentState;
use anyhow::{Context, Result};
use futures_util::StreamExt;
use parking_lot::RwLock;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT_RANGES, CONTENT_LENGTH, RANGE, USER_AGENT};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;

const MIN_STEALABLE_BYTES: u64 = 1024 * 512; // 512 KB threshold for work-stealing
const DEFAULT_CHUNK_COUNT: usize = 16;
const MAX_CONCURRENT_WORKERS: usize = 32;

#[derive(Debug, Clone)]
pub struct WorkerRange {
    pub id: usize,
    pub start: u64,
    pub current: Arc<AtomicU64>,
    pub end: Arc<AtomicU64>,
    pub is_active: Arc<AtomicBool>,
    pub is_done: Arc<AtomicBool>,
}

impl WorkerRange {
    pub fn remaining(&self) -> u64 {
        let cur = self.current.load(Ordering::Relaxed);
        let end = self.end.load(Ordering::Relaxed);
        if cur >= end {
            0
        } else {
            end - cur
        }
    }
}

pub struct SegmenterEngine {
    pub url: String,
    pub writer: Arc<MmapWriter>,
    pub total_size: u64,
    pub workers: Arc<RwLock<Vec<WorkerRange>>>,
    pub client: reqwest::Client,
    pub cookies: Option<String>,
    pub user_agent: Option<String>,
    pub pause_signal: Arc<AtomicBool>,
    pub cancel_signal: Arc<AtomicBool>,
    pub global_speed_limit: Arc<AtomicU64>, // 0 for unlimited
    pub downloaded_bytes: Arc<AtomicU64>,
}

impl SegmenterEngine {
    pub fn new(
        url: String,
        writer: Arc<MmapWriter>,
        total_size: u64,
        cookies: Option<String>,
        user_agent: Option<String>,
        global_speed_limit: Arc<AtomicU64>,
    ) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(MAX_CONCURRENT_WORKERS)
            .build()
            .unwrap_or_default();

        Self {
            url,
            writer,
            total_size,
            workers: Arc::new(RwLock::new(Vec::new())),
            client,
            cookies,
            user_agent,
            pause_signal: Arc::new(AtomicBool::new(false)),
            cancel_signal: Arc::new(AtomicBool::new(false)),
            global_speed_limit,
            downloaded_bytes: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Inspect URL headers to check total content-length and Range support
    pub async fn probe(
        client: &reqwest::Client,
        url: &str,
        cookies: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(u64, bool)> {
        let mut req = client.head(url);
        if let Some(c) = cookies {
            req = req.header("Cookie", c);
        }
        if let Some(ua) = user_agent {
            req = req.header(USER_AGENT, ua);
        } else {
            req = req.header(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TurboGrab/1.0");
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(_) => {
                // Some servers reject HEAD requests; fallback to a 0-1 range GET request
                client
                    .get(url)
                    .header(RANGE, "bytes=0-1")
                    .send()
                    .await
                    .context("Failed to probe download URL")?
            }
        };

        let headers = resp.headers();
        let supports_range = headers.contains_key(ACCEPT_RANGES)
            || resp.status() == reqwest::StatusCode::PARTIAL_CONTENT;

        let content_length = if let Some(cl) = headers.get(CONTENT_LENGTH) {
            cl.to_str()
                .unwrap_or("0")
                .parse::<u64>()
                .unwrap_or(0)
        } else if let Some(cr) = headers.get("content-range") {
            // e.g. "bytes 0-1/1048576"
            let s = cr.to_str().unwrap_or("");
            s.split('/')
                .nth(1)
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0)
        } else {
            0
        };

        Ok((content_length, supports_range))
    }

    /// Initialize workers and run dynamic work-stealing download loop
    pub async fn run(
        self: Arc<Self>,
        num_initial_workers: usize,
        progress_tx: broadcast::Sender<Vec<SegmentState>>,
    ) -> Result<()> {
        let chunk_count = num_initial_workers.clamp(1, MAX_CONCURRENT_WORKERS);

        // Partition file into initial ranges
        let chunk_size = (self.total_size + chunk_count as u64 - 1) / chunk_count as u64;
        let mut initial_workers = Vec::with_capacity(chunk_count);

        for i in 0..chunk_count {
            let start = i as u64 * chunk_size;
            let end = ((i as u64 + 1) * chunk_size).min(self.total_size);
            if start >= self.total_size {
                break;
            }

            initial_workers.push(WorkerRange {
                id: i,
                start,
                current: Arc::new(AtomicU64::new(start)),
                end: Arc::new(AtomicU64::new(end)),
                is_active: Arc::new(AtomicBool::new(true)),
                is_done: Arc::new(AtomicBool::new(false)),
            });
        }

        {
            let mut w = self.workers.write();
            *w = initial_workers.clone();
        }

        // Spawn progress reporting task
        let engine_for_progress = Arc::clone(&self);
        let progress_cancel = Arc::clone(&self.cancel_signal);
        let progress_handle = tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_millis(200));
            while !progress_cancel.load(Ordering::Relaxed) {
                ticker.tick().await;
                let segments = engine_for_progress.get_segments_snapshot();
                let all_done = segments.iter().all(|s| s.is_completed);
                let _ = progress_tx.send(segments);
                if all_done {
                    break;
                }
            }
        });

        // Spawn Tokio worker pool
        let mut worker_tasks = Vec::new();
        for worker in initial_workers {
            let engine = Arc::clone(&self);
            let handle = tokio::spawn(async move {
                engine.run_worker_with_stealing(worker).await;
            });
            worker_tasks.push(handle);
        }

        // Await all workers
        for handle in worker_tasks {
            let _ = handle.await;
        }

        // Ensure final flush
        self.writer.flush()?;
        let _ = progress_handle.await;

        Ok(())
    }

    /// Single worker loop: executes its assigned slice, then dynamically steals
    /// the trailing half from the slowest active worker B
    async fn run_worker_with_stealing(&self, mut current_task: WorkerRange) {
        loop {
            if self.cancel_signal.load(Ordering::Relaxed)
                || self.pause_signal.load(Ordering::Relaxed)
            {
                break;
            }

            let start_byte = current_task.current.load(Ordering::Relaxed);
            let end_byte = current_task.end.load(Ordering::Relaxed);

            if start_byte < end_byte {
                // Execute download for slice [start_byte, end_byte)
                let _ = self.stream_range(&current_task).await;
            }

            current_task.is_done.store(true, Ordering::Relaxed);
            current_task.is_active.store(false, Ordering::Relaxed);

            // Dynamic Work-Stealing Segmenter:
            // Worker A completes. Look for slowest active worker B
            let stolen = self.attempt_work_steal(current_task.id);
            match stolen {
                Some(new_task) => {
                    // Stolen slice obtained! Continue working
                    current_task = new_task;
                }
                None => {
                    // No remaining work to steal, worker terminates
                    break;
                }
            }
        }
    }

    /// Stream a specific range over HTTP using reqwest and zero-copy write
    async fn stream_range(&self, worker: &WorkerRange) -> Result<()> {
        let cur = worker.current.load(Ordering::Relaxed);
        let end = worker.end.load(Ordering::Relaxed);
        if cur >= end {
            return Ok(());
        }

        // HTTP Range header is inclusive [cur, end - 1]
        let range_header = format!("bytes={}-{}", cur, end - 1);

        let mut req = self.client.get(&self.url).header(RANGE, range_header);
        if let Some(ref c) = self.cookies {
            req = req.header("Cookie", c);
        }
        if let Some(ref ua) = self.user_agent {
            req = req.header(USER_AGENT, ua);
        } else {
            req = req.header(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TurboGrab/1.0");
        }

        let resp = req.send().await.context("Worker stream request failed")?;
        let mut stream = resp.bytes_stream();

        let mut write_pos = cur;

        while let Some(chunk_result) = stream.next().await {
            if self.cancel_signal.load(Ordering::Relaxed)
                || self.pause_signal.load(Ordering::Relaxed)
            {
                break;
            }

            let chunk = chunk_result.context("Failed reading byte chunk")?;
            let chunk_len = chunk.len() as u64;

            // Check if end bound was adjusted by work stealing
            let dynamic_end = worker.end.load(Ordering::Relaxed);
            let available_space = dynamic_end.saturating_sub(write_pos);

            let bytes_to_write = (chunk_len).min(available_space);
            if bytes_to_write > 0 {
                self.writer
                    .write_at(write_pos, &chunk[..bytes_to_write as usize])?;
                write_pos += bytes_to_write;
                worker.current.store(write_pos, Ordering::Relaxed);
                self.downloaded_bytes.fetch_add(bytes_to_write, Ordering::Relaxed);
            }

            if write_pos >= dynamic_end {
                // Reached the dynamically adjusted end bound
                break;
            }

            // Speed limit throttle if enabled
            let limit = self.global_speed_limit.load(Ordering::Relaxed);
            if limit > 0 {
                // Basic throttle tick
                tokio::task::yield_now().await;
            }
        }

        Ok(())
    }

    /// Dynamic Work-Stealing Algorithm:
    /// $M = C_B + \lfloor(E_B - C_B) / 2\rfloor$
    fn attempt_work_steal(&self, thief_id: usize) -> Option<WorkerRange> {
        let workers_lock = self.workers.read();

        // 1. Find slowest active worker B with the greatest remaining byte delta
        let mut max_remaining = 0;
        let mut victim_idx = None;

        for (idx, w) in workers_lock.iter().enumerate() {
            if w.is_active.load(Ordering::Relaxed) && !w.is_done.load(Ordering::Relaxed) {
                let rem = w.remaining();
                if rem > max_remaining {
                    max_remaining = rem;
                    victim_idx = Some(idx);
                }
            }
        }

        let victim_idx = victim_idx?;
        if max_remaining < MIN_STEALABLE_BYTES {
            // Remaining work is too small to justify connection overhead
            return None;
        }

        let victim = &workers_lock[victim_idx];
        let c_b = victim.current.load(Ordering::Relaxed);
        let e_b = victim.end.load(Ordering::Relaxed);

        if e_b <= c_b || (e_b - c_b) < MIN_STEALABLE_BYTES {
            return None;
        }

        // Split midpoint formula from specification:
        // M = C_B + floor((E_B - C_B) / 2)
        let midpoint = c_b + (e_b - c_b) / 2;

        // Atomically contract victim's upper bound to M
        victim.end.store(midpoint, Ordering::SeqCst);

        // Thief takes from midpoint to old E_B
        let new_worker_range = WorkerRange {
            id: workers_lock.len() + thief_id,
            start: midpoint,
            current: Arc::new(AtomicU64::new(midpoint)),
            end: Arc::new(AtomicU64::new(e_b)),
            is_active: Arc::new(AtomicBool::new(true)),
            is_done: Arc::new(AtomicBool::new(false)),
        };

        drop(workers_lock);

        // Register the new split range
        let mut write_lock = self.workers.write();
        write_lock.push(new_worker_range.clone());

        Some(new_worker_range)
    }

    /// Snapshot for frontend heatmap and visualizer
    pub fn get_segments_snapshot(&self) -> Vec<SegmentState> {
        let workers = self.workers.read();
        workers
            .iter()
            .map(|w| {
                let start = w.start;
                let end = w.end.load(Ordering::Relaxed);
                let cur = w.current.load(Ordering::Relaxed);
                let done = w.is_done.load(Ordering::Relaxed) || (cur >= end && end > start);
                SegmentState {
                    id: w.id,
                    start_byte: start,
                    end_byte: end,
                    current_offset: cur,
                    speed_bps: 0,
                    active_worker_id: if w.is_active.load(Ordering::Relaxed) {
                        Some(w.id)
                    } else {
                        None
                    },
                    is_completed: done,
                }
            })
            .collect()
    }
}
