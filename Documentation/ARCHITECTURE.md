# TurboGrab Technical Architecture

TurboGrab is engineered as a decoupled, multi-process desktop acceleration ecosystem consisting of four primary subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Layer (MV3)                          │
│  - background.js (Interceptor, Context Menu, WS Client)         │
│  - content.js (Genesis Grab-Chip, Media Sniffer, SPA tracker)   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket (127.0.0.1:48123)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Electron Main Process                         │
│  - wsServer.cjs (Protocol v1, Origin Check, Rate Limiter)       │
│  - main.cjs (Single-instance Lock, Window Management, IPC)      │
│  - preload.cjs (Context Isolation, Safe API Bridge)             │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Direct In-Process Engine Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Engine & Storage Layer                        │
│  - downloadManager.cjs (16-thread work-stealing Range engine)   │
│  - streamDemuxer.cjs (HLS/DASH segmenter, FFmpeg multiplexer)   │
│  - db.cjs (Zero-dependency SQLite WAL Database)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ IPC Events (750ms Telemetry)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   React 18 Genesis UI                           │
│  - 13-View Sidebar Navigation & Active Queue Dashboard          │
│  - 16-Segment Thread Heatmaps & Detail Inspection Drawer        │
│  - Modals: Batch URL, Scheduler, Bandwidth Throttle, Sniffer    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Multi-Threaded Range Engine & Dynamic Work-Stealing

### Segment Division
When an HTTP URL supports `Accept-Ranges: bytes` and `Content-Length > 1MB`, the engine divides the total bytes $L$ into $N$ equal chunks (default $N = 16$):
$$\text{Chunk Size} = \left\lceil \frac{L}{N} \right\rceil$$

### Dynamic Work-Stealing
When worker $i$ finishes its assigned range (`current >= end`), it inspects all other workers to find victim $v$ with the maximum remaining bytes:
$$\text{Remaining}_v = \text{End}_v - \text{Current}_v$$
If $\text{Remaining}_v > 512\text{ KB}$, the remaining byte range is split in half at the midpoint:
$$M = \text{Current}_v + \left\lfloor \frac{\text{End}_v - \text{Current}_v}{2} \right\rfloor$$
Worker $v$'s end is truncated to $M$, and worker $i$ adopts range $[M + 1, \text{End}_v]$. This prevents the "tail latency" problem where 15 threads wait idle while 1 slow thread finishes.

### Non-Destructive Resumption
Unlike naive downloaders that truncate files on start (`'w+'`), TurboGrab uses `'r+'` mode on existing files, reading saved chunk offsets directly from SQLite and resuming from byte $B_{\text{saved}}$.

---

## 2. YouTube & Stream Multiplexing Pipeline

* **YouTube Separation:** High-definition video (1080p, 1440p, 4K) on YouTube does not come pre-muxed with audio. TurboGrab fetches separate video and audio streams via `@distube/ytdl-core`.
* **Zero-Copy Piping:** Video and audio streams are piped simultaneously into **FFmpeg 9.0.2** using OS pipes (`pipe:3` and `pipe:4`) with `-c:v copy -c:a aac`. Muxing occurs directly as bytes arrive without intermediate temporary disk files.
* **HLS / DASH:** For adaptive manifests, playlist variants are parsed, media segments are fetched in bounded parallel batches, and concatenated using FFmpeg concat protocols.

---

## 3. SQLite Persistence & Schema WAL

State is maintained in `~/.turbograb/turbograb.db` using Node.js native `node:sqlite`:
* **WAL Mode:** Write-Ahead Logging (`PRAGMA journal_mode = WAL`) enables non-blocking concurrent reads and atomic writes.
* **Tables:** `downloads`, `download_segments`, `download_categories`, `download_queues`, `scheduled_tasks`, `application_settings`, and `download_history`.
* **Auto-Migration:** Schema versioning dynamically inspects `PRAGMA table_info` and applies missing column definitions on startup without data loss.
