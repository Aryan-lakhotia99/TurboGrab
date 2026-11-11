<div align="center">

<img src="public/logo.svg" alt="TurboGrab Logo" width="110" height="110" />

# TurboGrab

**Open-source, privacy-first download accelerator & manager for Windows, macOS & Linux**

Pure Node.js engine • Electron • React 18 + TypeScript • WebExtension (MV3)

[![CI](https://github.com/Aryan-lakhotia99/TurboGrab/actions/workflows/ci.yml/badge.svg)](https://github.com/Aryan-lakhotia99/TurboGrab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933.svg)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F.svg)](https://www.electronjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*Zero telemetry • 100% local • MIT licensed*

</div>

---

## ⚡ Overview

TurboGrab is a high-speed desktop download manager built for power users. It
combines a multi-connection parallel HTTP Range engine with dynamic work
stealing, byte-level resumption, an embedded SQLite database, and an optional
Chromium/Firefox extension that intercepts browser downloads and hands them to
the desktop engine over a loopback WebSocket bridge.

Everything runs on your machine. No accounts, no analytics, no cloud.

---

## 📊 Feature Comparison

| Feature | Browser Download | Legacy Tools (IDM, etc.) | TurboGrab |
|---|:---:|:---:|:---:|
| **License & cost** | Free (closed source) | Paid shareware | **Free & open source (MIT)** |
| **Parallel HTTP Range** | Single stream | Multi-part | **Up to 16 parallel streams + work stealing** |
| **Dynamic resumption** | Often fails | Yes | **`r+` byte-level offset resume w/ ETag validation** |
| **Browser integration** | Built-in | Proprietary bridge | **MV3 extension + loopback WebSocket** |
| **Embedded database** | Unindexed history | Proprietary format | **SQLite with WAL (`node:sqlite`)** |
| **Telemetry** | High | Closed source | **None — 100% local** |
| **Stack** | N/A | Monolithic binary | **Node.js + Electron + React** |

---

## 🖥️ Platform Support

| Platform | Status | Package |
|---|---|---|
| **Windows 10/11** (x64) | ✅ Released | NSIS installer (`.exe`) |
| **macOS** (Apple Silicon & Intel) | 🚧 Packaging verified in CI, artifacts on the roadmap | `electron-builder --mac` |
| **Linux** (x64) | 🚧 Packaging verified in CI, artifacts on the roadmap | AppImage / `.deb` / `.rpm` |

> **Honesty note:** the v1.0.0 release currently ships a Windows installer only.
> macOS `.dmg` and Linux AppImage builds are produced by the same
> `electron-builder` configuration and will be published to GitHub Releases
> (see the [Roadmap](#-roadmap)). We do not claim artifacts that don't exist.

---

## ⬇️ Downloads

### Recommended: GitHub Releases

Download the latest stable binaries from the
**[Releases page](https://github.com/Aryan-lakhotia99/TurboGrab/releases)**.
Release artifacts are checksummed automatically.

### Current packages

| Package | Size | SHA-256 |
|---|---|---|
| `TurboGrab Setup 1.0.0.exe` (Windows) | 125.88 MB | `47B582CF74CF207EBA23CBF986179DB1DA04E881B80B34C216CA510864E9A29C` |
| `TurboGrab-Browser-Extension-v1.0.0.zip` | 21 KB | `D1DF9BFB28FAE3454DC36AE2B6AA7C75FC6006B919822FABAFBA136D64865D68` |

These files are also mirrored in the [`Downloads/`](./Downloads) directory via
Git LFS (see its [README](./Downloads/README.md)). GitHub Releases is the
preferred channel — cloning the repository will not download LFS binaries
unless you run `git lfs pull`.

### Verifying integrity (PowerShell)

```powershell
Get-FileHash -Algorithm SHA256 "TurboGrab Setup 1.0.0.exe"
```

> ⚠️ Binaries are currently **unsigned**. Windows SmartScreen may show an
> "unknown publisher" warning, and macOS Gatekeeper will require manual
> approval. Code signing is on the roadmap — see
> [`project_update.md`](./project_update.md).

---

## 🚀 Key Features

* **Parallel HTTP Range accelerator**
  * Configurable parallel streams (1, 2, 4, 8, or 16)
  * Dynamic work stealing with midpoint division — faster workers steal byte
    ranges from lagging ones
  * Non-truncating `r+` byte-level resumption with ETag/Last-Modified validation
  * Retry with exponential backoff and server `429` back-off handling
* **Smart destination & category routing**
  * Interactive destination folder prompt (IDM-style) before download starts
  * Automatic extension categorization: Videos, Music, Documents, Compressed,
    Programs, Images, Other
* **Genesis UI desktop workstation** (React 18 + Tailwind)
  * Dashboard, active queue, history, analytics, scheduled tasks, settings
  * Per-segment progress telemetry with visual heatmaps
  * SHA-256 integrity verification on every completed file
  * Global and per-task bandwidth throttling (token bucket)
* **Embedded SQLite database** — WAL journaling, instant state persistence
  across restarts
* **Browser extension (Chromium MV3 + Firefox)**
  * Loopback WebSocket bridge (`ws://127.0.0.1:48123`) with origin validation
  * Floating media download chip and context menu integration
  * Native messaging fallback host
* **Media pipeline** — YouTube video/audio extraction and HLS (`.m3u8`) /
  DASH (`.mpd`) stream downloading & muxing (requires FFmpeg, see below)

---

## 🛠️ Running from Source

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | **≥ 22.5** (24 LTS recommended) | Required for the built-in `node:sqlite` module |
| **npm** | ≥ 10 | |
| **FFmpeg** | any recent build | *Optional* — only needed for YouTube / HLS / DASH downloads. Must be on `PATH` (on Windows, the winget `Gyan.FFmpeg` install location is also detected) |
| **Git LFS** | any | Only if you want the release binaries via `git lfs pull` |

### Quick start (two terminals)

```bash
# 1. Install dependencies
npm install

# 2. Terminal A — start the Vite dev server (UI hot reload)
npm run dev

# 3. Terminal B — launch the Electron shell
npm start
```

> The Electron window loads the Vite dev server (`localhost:1420`) when it is
> running, and falls back to a production build in `dist/` otherwise.

### Production run (no dev server)

```bash
npm run build   # TypeScript check + Vite production build
npm start       # Electron loads dist/index.html
```

### Run the test suite

```bash
npm test
```

Runs the engine, cross-platform, file-type, and location-prompt suites on your
machine. The same suite runs on Ubuntu, Windows, and macOS in CI.

### Package installers

```bash
npm run package:win     # Windows NSIS installer  → release/
npm run package:mac     # macOS .dmg (x64 + arm64)
npm run package:linux   # Linux AppImage + .deb + .rpm
```

---

## 🧩 Browser Extension Setup

1. Launch TurboGrab (`npm start` or an installed build).
2. Open **Integration Hub** in the app sidebar, or manually:
3. In Chrome/Edge/Brave/Opera: go to `chrome://extensions`, enable
   **Developer mode**, click **Load unpacked**, select the `extension/` folder.
4. In Firefox: go to `about:debugging#/runtime/this-firefox` → **Load Temporary
   Add-on** → pick `extension/firefox-manifest.json`'s folder.
5. Confirm the TurboGrab chip turns green (bridge connected on `127.0.0.1:48123`).

---

## 📁 Repository Structure

```text
TurboGrab/
├── electron/                 # Electron main process & download engine
│   ├── main.cjs              # App entry, IPC handlers, window lifecycle
│   ├── preload.cjs           # Sandboxed ContextBridge IPC surface
│   └── engine/               # downloadManager, SQLite, WS bridge, demuxer,
│                             # browser detection
├── src/                      # React 18 frontend (TypeScript + Tailwind)
│   ├── components/           # Genesis UI views & modals
│   ├── services/api.ts       # IPC client bridge (Electron + browser fallback)
│   └── types.ts              # Domain models
├── extension/                # Browser extension (Chromium MV3 + Firefox)
├── src-tauri/                # Experimental Rust/Tauri engine (not shipped)
├── scripts/                  # Per-platform packaging scripts
├── tests/                    # Engine, cross-platform & integration suites
├── Documentation/            # Architecture, API, security & install guides
├── Downloads/                # Git LFS release binaries mirror
├── assets/                   # Screenshots
└── public/                   # Static assets
```

---

## 🔒 Security & Privacy

TurboGrab is designed security-first:

* Renderer runs fully sandboxed (`contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`) with a minimal, explicit IPC surface
* The loopback bridge binds to `127.0.0.1` only and validates browser extension
  origins before accepting commands
* All filenames are sanitized against path traversal
* Downloaded executables are never auto-executed
* Zero telemetry — history and settings live in `~/.turbograb/turbograb.db`

Please report vulnerabilities privately — see
[SECURITY.md](.github/SECURITY.md). Technical details of the current
safeguards: [Documentation/SECURITY.md](Documentation/SECURITY.md).

---

## 🗺️ Roadmap

See [`project_update.md`](./project_update.md) for the full engineering plan:

- [ ] Publish macOS `.dmg` and Linux AppImage to GitHub Releases
- [ ] Code signing & macOS notarization
- [ ] In-app auto-update via `electron-updater`
- [ ] Bundle FFmpeg per-platform (no PATH dependency)
- [ ] Publish the extension to the Chrome Web Store & AMO, pin extension IDs
- [ ] Electron fuses & asar integrity validation
- [ ] Retire the experimental `src-tauri` engine

---

## 🤝 Contributing

Contributions are welcome! Read [CONTRIBUTING.md](CONTRIBUTING.md) for the dev
setup, branch naming, and PR guidelines, and please follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## 🐛 Issues & Support

Found a bug or have a feature request? Please open an issue with the matching
template in the
[Issues tab](https://github.com/Aryan-lakhotia99/TurboGrab/issues).

## 📜 License

Distributed under the [MIT License](LICENSE).
