# Contributing to TurboGrab

Thank you for your interest in contributing to **TurboGrab**! We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## 🛠️ Development Setup

### Prerequisites
* **Node.js**: v20+ (Node.js 24 recommended for native `node:sqlite`)
* **npm**: v10+
* **Git** & **Git LFS**: Installed and initialized

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

3. **Launch the Development Workstation:**
   ```bash
   # Starts Vite development server and launches Electron
   npm start
   ```

4. **Build the Production Frontend:**
   ```bash
   npm run build
   ```

5. **Run the Test Suite:**
   ```bash
   npm test
   ```

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
4. **Testing**: Ensure that all automated tests pass (`npm test`) before opening a PR.

---

## 🐛 Reporting Issues

If you encounter bugs or want to suggest new features, please open an issue using the appropriate template in the [Issues tab](https://github.com/Aryan-lakhotia99/TurboGrab/issues).
