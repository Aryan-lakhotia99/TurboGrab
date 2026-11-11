# Contributing to TurboGrab

Thank you for your interest in contributing to **TurboGrab**! We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## 🛠️ Development Setup

### Prerequisites
* **Node.js**: v22.5+ (**v24 LTS recommended**) — the engine uses the built-in `node:sqlite` module, which is unavailable in Node 20/21. A `.nvmrc` is provided (`nvm use`).
* **npm**: v10+
* **Git LFS**: Only needed if you want the release binaries locally (`git lfs pull`)
* **FFmpeg** (optional): required only for YouTube / HLS / DASH downloads. Any recent build on your `PATH` works.

### Getting Started

1. **Fork and Clone the Repository:**
   ```bash
   git clone https://github.com/Aryan-lakhotia99/TurboGrab.git
   cd TurboGrab
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Launch the Development Workstation (two terminals):**
   ```bash
   # Terminal A — Vite dev server (UI hot reload)
   npm run dev

   # Terminal B — Electron shell
   npm start
   ```
   > The Electron window loads the Vite dev server while it is running, or a
   > production `dist/` build if one exists. For a single-command production
   > run use `npm run build && npm start`.

4. **Run the Test Suite:**
   ```bash
   npm test
   ```
   All four suites (engine, cross-platform, file types, location prompt) must
   pass. CI runs them on Ubuntu, Windows, and macOS for every PR.

---

## 📁 Project Architecture Overview

* **`electron/`**: Electron main process, IPC handlers, multi-threaded Range engine, and WebSocket native messaging bridge.
* **`src/`**: React 18 Genesis UI frontend with TypeScript and Tailwind CSS.
* **`extension/`**: Chromium Manifest V3 browser extension with floating media chip and video sniffer.
* **`Documentation/`**: Technical architecture guides, API channel specs, and engine documentation.
* **`Downloads/`**: Official release distribution binaries managed via Git LFS.

---

## 📋 Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names:
   * `feat/your-feature-name`
   * `fix/bug-description`
   * `docs/documentation-update`
2. **Zero Python Policy**: TurboGrab is strictly written in pure Node.js, Electron, React, and TypeScript. Do not introduce Python runtime dependencies.
3. **Commit Messages**: Follow standard conventional commits format:
   * `feat: add new download schedule queue`
   * `fix: handle edge case in range stream chunk stitching`
   * `docs: update IPC channel specification`
4. **Testing**: Ensure that all automated tests pass (`npm test`) before opening a PR. CI must be green on all three platforms (Ubuntu, Windows, macOS).
5. **Code of Conduct**: By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
6. **Security**: Never fix security vulnerabilities in a public PR — report them privately per [SECURITY.md](.github/SECURITY.md).

---

## 🐛 Reporting Issues

If you encounter bugs or want to suggest new features, please open an issue using the appropriate template in the [Issues tab](https://github.com/Aryan-lakhotia99/TurboGrab/issues).
