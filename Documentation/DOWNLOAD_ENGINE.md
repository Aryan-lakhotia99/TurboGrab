# TurboGrab — Multi-Threaded Range & Stream Download Engine

## 1. Multi-Threaded Range Chunking
For standard HTTP/HTTPS resources, TurboGrab maximizes network throughput through dynamic work-stealing Range chunking:
1. **Pre-flight Probe (`HEAD` / Range `GET`)**:
   - Queries server headers for `Accept-Ranges: bytes` and `Content-Length`.
   - If ranges are supported, partitions total file length into 16 balanced byte segments:
     - Segment $i$: `bytes=[start_byte, end_byte]`
   - If range headers are rejected by the server, falls back transparently to a resilient single-stream download.
2. **Concurrent Workers**:
   - Spawns parallel asynchronous workers streaming chunks directly to temporary part files (`${filepath}.part${segmentIndex}`).
3. **Dynamic Work-Stealing**:
   - If a worker finishes early while others are lagging, the remaining range of the slowest segment is split and handed off to the idle worker.
4. **Zero-Copy File Assembly**:
   - Once all segments report completion, chunks are concatenated in sequential order into the destination file.
   - Part files are removed, and SHA-256 integrity checksums are verified.

## 2. Adaptive Video & Audio Stream Extraction
For adaptive streaming sources (HLS, DASH, YouTube-style adaptive streams):
1. **Format Enumeration**:
   - Inspects adaptive video formats (1080p, 720p, 480p, 360p) and separate audio streams.
2. **Target Matching**:
   - User selects requested resolution or audio-only from extension popup/chip.
   - Engine downloads matching high-bitrate video stream alongside highest-fidelity audio track.
3. **FFmpeg Muxing**:
   - Spawns local FFmpeg binary:
     `ffmpeg -i video.mp4 -i audio.m4a -c:v copy -c:a aac -movflags +faststart output.mp4`
   - For audio-only extraction:
     `ffmpeg -i audio.m4a -vn -c:a libmp3lame -q:a 2 output.mp3`
4. **Automatic Cleanup**:
   - Temporary video and audio intermediate files are deleted upon successful muxing.

## 3. Resiliency, Watchdog, and Rate Limiting
- **Token-Bucket Throttling**: Configurable bandwidth cap prevents network congestion.
- **Worker Watchdog**: Active 20-second stall detection reconnects stalled sockets.
- **Disk Space Pre-flight**: Verifies target drive has sufficient capacity before allocating chunks.
