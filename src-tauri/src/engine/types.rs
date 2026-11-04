use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Queued,
    Downloading,
    Paused,
    Completed,
    Demuxing,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentState {
    pub id: usize,
    pub start_byte: u64,
    pub end_byte: u64,
    pub current_offset: u64,
    pub speed_bps: u64,
    pub active_worker_id: Option<usize>,
    pub is_completed: bool,
}

impl SegmentState {
    pub fn remaining_bytes(&self) -> u64 {
        if self.current_offset >= self.end_byte {
            0
        } else {
            self.end_byte - self.current_offset
        }
    }

    pub fn progress_pct(&self) -> f32 {
        let total = self.end_byte.saturating_sub(self.start_byte);
        if total == 0 {
            return 100.0;
        }
        let done = self.current_offset.saturating_sub(self.start_byte);
        (done as f32 / total as f32) * 100.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItem {
    pub id: String,
    pub url: String,
    pub filename: String,
    pub destination_path: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub speed_bps: u64,
    pub eta_seconds: u64,
    pub status: TaskStatus,
    pub segments: Vec<SegmentState>,
    pub is_stream: bool,
    pub cookies: Option<String>,
    pub referrer: Option<String>,
    pub user_agent: Option<String>,
    pub error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStats {
    pub global_speed_bps: u64,
    pub active_downloads: usize,
    pub total_downloads: usize,
    pub speed_limit_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterceptPayload {
    pub url: String,
    pub filename: Option<String>,
    pub filesize: Option<u64>,
    pub referrer: Option<String>,
    pub cookies: Option<String>,
    pub user_agent: Option<String>,
    pub is_stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamDemuxOption {
    pub quality: String,
    pub resolution: String,
    pub bandwidth: u64,
    pub video_url: Option<String>,
    pub audio_url: Option<String>,
}
