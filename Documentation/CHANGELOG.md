# TurboGrab Changelog

All notable changes to the TurboGrab ecosystem will be documented in this file.

---

## [v1.1.0] - 2026-11-02

### Added
- **Full IDM Genesis UI Suite:**
  - 13-View sidebar: *Dashboard, All Downloads, Active, Queued, Paused, Completed, Failed, Scheduled, Video Downloader, Categories, Download History, Analytics, Settings*.
  - Detailed task inspection drawer with real-time 16-segment thread heatmaps and SHA-256 integrity verification.
  - Batch URL Downloader modal with multi-line input and `.txt` file importer.
  - Task Scheduler with timed executions, countdowns, and post-transfer automations.
  - Download History view with text search, category filters, and JSON export.
  - Categories management view with custom category creator and folder target assignments.
  - Analytics & Telemetry view with data volume KPIs and media distribution charts.
  - Comprehensive Settings view for concurrency, auto-organization, and clipboard monitoring.
  - Mini Floating Bar mode for compact, always-on-top multitasking.
- **Embedded SQLite WAL Database (`node:sqlite`):**
  - High-performance, zero-external-dependency SQLite persistence for tasks, segments, categories, queues, scheduler, history, and settings.
  - Auto-migration system dynamically updates table columns without data loss.
- **Browser Extension Improvements:**
  - Context menu actions: *"Download link with TurboGrab"*, *"Download image with TurboGrab"*, and *"Download media with TurboGrab"*.
  - Protocol v1 standardization with request tracking, origin checks, and rate limiting.
  - Support for YouTube Shorts and Single Page App (`yt-navigate-finish`) video sniffing.

### Fixed
- **Resume File Truncation:** Replaced `'w+'` file open mode with `'r+'` and offset preservation so resumed downloads never overwrite existing downloaded bytes.
- **Vite Relative Asset Resolution:** Configured `base: './'` to eliminate Electron blank white screen on startup.
- **Port Conflict (`EADDRINUSE`):** Added process-level single-instance lock and automatic port clearance in `TurboGrab.bat`.
- **Extension Red Squiggly:** Added `@types/chrome` declarations in `extension/jsconfig.json` and wrapped messaging in `safeSendMessage`.

---

## [v1.0.0] - 2026-11-01

### Initial Release
- Multi-threaded 16-worker HTTP Range accelerator with dynamic work-stealing.
- YouTube 1080p/4K audio/video stream merger via FFmpeg 9.0.2.
- Manifest V3 browser extension with floating Genesis Grab-Chip.
- Native Electron desktop interface with Genesis design system.
