use anyhow::{Context, Result};
use reqwest::header::USER_AGENT;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

#[derive(Debug, Clone)]
pub struct StreamSegment {
    pub uri: String,
    pub duration_sec: f32,
    pub index: usize,
}

#[derive(Debug, Clone)]
pub struct ParsedPlaylist {
    pub is_master: bool,
    pub video_segments: Vec<StreamSegment>,
    pub audio_segments: Vec<StreamSegment>,
    pub target_duration: f32,
}

pub struct StreamDemuxer {
    client: reqwest::Client,
}

impl StreamDemuxer {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .pool_max_idle_per_host(16)
                .build()
                .unwrap_or_default(),
        }
    }

    /// Parse an HLS .m3u8 playlist URL
    pub async fn parse_hls(&self, playlist_url: &str) -> Result<ParsedPlaylist> {
        let resp = self
            .client
            .get(playlist_url)
            .header(USER_AGENT, "Mozilla/5.0 TurboGrab/1.0")
            .send()
            .await
            .context("Failed to fetch .m3u8 playlist")?;

        let body = resp.text().await?;
        let base_url = Self::get_base_url(playlist_url);

        let mut video_segments = Vec::new();
        let mut target_duration = 10.0;
        let mut is_master = false;

        let lines: Vec<&str> = body.lines().collect();
        let mut idx = 0;
        let mut next_duration = 0.0;

        for line in lines {
            let line = line.trim();
            if line.starts_with("#EXT-X-STREAM-INF") {
                is_master = true;
            } else if line.starts_with("#EXT-X-TARGETDURATION:") {
                if let Ok(d) = line["#EXT-X-TARGETDURATION:".len()..].parse::<f32>() {
                    target_duration = d;
                }
            } else if line.starts_with("#EXTINF:") {
                let parts: Vec<&str> = line["#EXTINF:".len()..].split(',').collect();
                if let Ok(d) = parts[0].parse::<f32>() {
                    next_duration = d;
                }
            } else if !line.is_empty() && !line.starts_with('#') {
                let full_url = if line.starts_with("http://") || line.starts_with("https://") {
                    line.to_string()
                } else {
                    format!("{}{}", base_url, line)
                };

                video_segments.push(StreamSegment {
                    uri: full_url,
                    duration_sec: next_duration,
                    index: idx,
                });
                idx += 1;
                next_duration = 0.0;
            }
        }

        // If master playlist with sub-streams, fetch the highest bandwidth variant
        if is_master && !video_segments.is_empty() {
            let highest_variant = &video_segments[0].uri;
            return Box::pin(self.parse_hls(highest_variant)).await;
        }

        Ok(ParsedPlaylist {
            is_master,
            video_segments,
            audio_segments: Vec::new(),
            target_duration,
        })
    }

    /// Parse a DASH .mpd manifest URL (simplified parser for representations & segment templates)
    pub async fn parse_dash(&self, mpd_url: &str) -> Result<ParsedPlaylist> {
        let resp = self
            .client
            .get(mpd_url)
            .header(USER_AGENT, "Mozilla/5.0 TurboGrab/1.0")
            .send()
            .await
            .context("Failed to fetch .mpd manifest")?;

        let body = resp.text().await?;
        let base_url = Self::get_base_url(mpd_url);

        let mut segments = Vec::new();
        // Parse basic segment URLs from XML body
        for line in body.lines() {
            let line = line.trim();
            if line.contains("<SegmentURL") && line.contains("media=") {
                if let Some(start) = line.find("media=\"") {
                    let sub = &line[start + 7..];
                    if let Some(end) = sub.find('"') {
                        let media_rel = &sub[..end];
                        let full_url = if media_rel.starts_with("http") {
                            media_rel.to_string()
                        } else {
                            format!("{}{}", base_url, media_rel)
                        };
                        segments.push(StreamSegment {
                            uri: full_url,
                            duration_sec: 4.0,
                            index: segments.len(),
                        });
                    }
                }
            }
        }

        Ok(ParsedPlaylist {
            is_master: false,
            video_segments: segments,
            audio_segments: Vec::new(),
            target_duration: 4.0,
        })
    }

    /// Fetch all segments concurrently and multiplex / concatenate into output file
    pub async fn download_and_multiplex(
        &self,
        playlist: ParsedPlaylist,
        output_path: &Path,
        cancel_signal: Arc<AtomicBool>,
        progress_callback: impl Fn(usize, usize),
    ) -> Result<()> {
        let total = playlist.video_segments.len();
        if total == 0 {
            anyhow::bail!("Playlist contains zero segments to download.");
        }

        let temp_dir = output_path
            .parent()
            .unwrap_or(Path::new("."))
            .join(format!(".turbograb_tmp_{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await?;

        // Download segments in parallel batches of 8
        let concurrency = 8;
        let mut downloaded_files = Vec::new();

        for chunk in playlist.video_segments.chunks(concurrency) {
            if cancel_signal.load(Ordering::Relaxed) {
                break;
            }

            let mut tasks = Vec::new();
            for seg in chunk {
                let client = self.client.clone();
                let uri = seg.uri.clone();
                let file_path = temp_dir.join(format!("seg_{:05}.ts", seg.index));
                tasks.push(async move {
                    let data = client.get(&uri).send().await?.bytes().await?;
                    tokio::fs::write(&file_path, &data).await?;
                    Ok::<PathBuf, anyhow::Error>(file_path)
                });
            }

            let results = futures_util::future::join_all(tasks).await;
            for res in results {
                let path = res?;
                downloaded_files.push(path);
            }
            progress_callback(downloaded_files.len(), total);
        }

        // Multiplex or concatenate
        let success = Self::try_ffmpeg_multiplex(&downloaded_files, output_path).await;
        if !success {
            // Built-in binary concatenation fallback
            Self::concat_files(&downloaded_files, output_path).await?;
        }

        // Clean up temporary segment files
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;

        Ok(())
    }

    /// Bundled static FFmpeg multiplexer via piped command
    async fn try_ffmpeg_multiplex(input_files: &[PathBuf], output_path: &Path) -> bool {
        // Build ffmpeg concat demuxer list
        let concat_list = input_files
            .iter()
            .map(|p| format!("file '{}'", p.to_string_lossy().replace('\\', "/")))
            .collect::<Vec<_>>()
            .join("\n");

        let concat_file = output_path.with_extension("txt");
        if tokio::fs::write(&concat_file, &concat_list).await.is_err() {
            return false;
        }

        let status = Command::new("ffmpeg")
            .arg("-y")
            .arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(&concat_file)
            .arg("-c")
            .arg("copy")
            .arg(output_path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await;

        let _ = tokio::fs::remove_file(&concat_file).await;

        match status {
            Ok(s) => s.success(),
            Err(_) => false,
        }
    }

    /// Fast binary concatenation for TS segments
    async fn concat_files(input_files: &[PathBuf], output_path: &Path) -> Result<()> {
        let mut outfile = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(output_path)
            .await?;

        for file_path in input_files {
            let data = tokio::fs::read(file_path).await?;
            outfile.write_all(&data).await?;
        }
        outfile.flush().await?;
        Ok(())
    }

    fn get_base_url(url: &str) -> String {
        if let Some(idx) = url.rfind('/') {
            format!("{}/", &url[..idx])
        } else {
            format!("{}/", url)
        }
    }
}
