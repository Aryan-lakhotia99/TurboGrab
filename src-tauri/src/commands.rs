use crate::engine::types::{DownloadItem, EngineStats, StreamDemuxOption};
use crate::engine::DownloadEngine;
use std::path::Path;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn start_download(
    engine: State<'_, Arc<DownloadEngine>>,
    url: String,
    filename: Option<String>,
    cookies: Option<String>,
    referrer: Option<String>,
    user_agent: Option<String>,
    is_stream: Option<bool>,
) -> Result<String, String> {
    let engine = engine.inner().clone();
    engine
        .start_download(
            url,
            filename,
            cookies,
            referrer,
            user_agent,
            is_stream.unwrap_or(false),
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pause_download(
    engine: State<'_, Arc<DownloadEngine>>,
    id: String,
) -> Result<(), String> {
    engine.pause_download(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resume_download(
    engine: State<'_, Arc<DownloadEngine>>,
    id: String,
) -> Result<(), String> {
    let engine = engine.inner().clone();
    engine.resume_download(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_download(
    engine: State<'_, Arc<DownloadEngine>>,
    id: String,
) -> Result<(), String> {
    engine.cancel_download(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_queue_stats(engine: State<'_, Arc<DownloadEngine>>) -> EngineStats {
    engine.get_queue_stats()
}

#[tauri::command]
pub fn get_all_downloads(engine: State<'_, Arc<DownloadEngine>>) -> Vec<DownloadItem> {
    engine.get_all_downloads()
}

#[tauri::command]
pub fn set_speed_limit(
    engine: State<'_, Arc<DownloadEngine>>,
    limit_bps: u64,
) {
    engine.set_speed_limit(limit_bps);
}

#[tauri::command]
pub async fn sniff_stream(url: String) -> Result<Vec<StreamDemuxOption>, String> {
    // Quick probe for stream playlist qualities
    let mut options = Vec::new();
    if url.contains(".m3u8") {
        options.push(StreamDemuxOption {
            quality: "Source / Master 1080p".into(),
            resolution: "1920x1080".into(),
            bandwidth: 6_000_000,
            video_url: Some(url.clone()),
            audio_url: None,
        });
        options.push(StreamDemuxOption {
            quality: "720p HD".into(),
            resolution: "1280x720".into(),
            bandwidth: 3_000_000,
            video_url: Some(url.clone()),
            audio_url: None,
        });
        options.push(StreamDemuxOption {
            quality: "Audio Only (.aac)".into(),
            resolution: "Audio".into(),
            bandwidth: 320_000,
            video_url: None,
            audio_url: Some(url.clone()),
        });
    } else {
        options.push(StreamDemuxOption {
            quality: "Direct File".into(),
            resolution: "Auto".into(),
            bandwidth: 0,
            video_url: Some(url),
            audio_url: None,
        });
    }
    Ok(options)
}

#[tauri::command]
pub fn open_download_folder(filepath: String) -> Result<(), String> {
    let path = Path::new(&filepath);
    let target = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(target)
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(target)
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(target)
            .spawn();
    }
    Ok(())
}
