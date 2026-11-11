# TurboGrab Security & Privacy Policy

Security is a primary design pillar of TurboGrab. This document outlines the technical safeguards implemented across the desktop client, browser extension, and network engine. For vulnerability reporting, see [`.github/SECURITY.md`](../.github/SECURITY.md).

---

## 1. Electron Isolation & Sandboxing
* **Context Isolation:** `contextIsolation: true` is strictly enforced. The renderer process running the React UI has no access to Node.js internals or arbitrary filesystem calls.
* **Full Renderer Sandbox:** `sandbox: true` is enabled on the BrowserWindow. The renderer has no access to Node.js primitives whatsoever; the preload script only uses `contextBridge` and `ipcRenderer`, both of which are available in sandboxed preloads.
* **Node Integration Disabled:** `nodeIntegration: false` prevents malicious scripts or injected content from invoking native system commands.
* **Preload Gatekeeping:** Only safe, explicit IPC handlers are exposed via `contextBridge.exposeInMainWorld('electronAPI', ...)`.
* **Single Instance Lock:** A second app instance exits immediately, preventing duplicate loopback listeners and GPU cache lock conflicts.

---

## 2. Zero Automatic Code Execution
* **Executable Safeguard:** Downloaded binary files (`.exe`, `.msi`, `.bat`, `.cmd`, `.ps1`) are **NEVER** executed automatically.
* Users must explicitly open containing folders and launch executable programs manually.

---

## 3. Path Traversal & Filename Sanitization
* All incoming filenames (from HTTP `Content-Disposition`, URLs, or extension headers) are sanitized using regular expressions:
  ```javascript
  filename = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
  ```
* All relative traversal indicators (`../`, `..\\`) are stripped to prevent arbitrary file write vulnerabilities outside the intended destination directories.

---

## 4. WebSocket Bridge Protection
* **Loopback Binding:** The WebSocket server listens strictly on `127.0.0.1:48123` (never on `0.0.0.0`), preventing exposure to local LAN or remote networks.
* **Strict Origin Allowlist:** Only `chrome-extension://…` / `moz-extension://…` origins (the TurboGrab extension) and the native messaging host are accepted. Web traffic from arbitrary internet domains **and local web pages** (`http://localhost:*`, `http://127.0.0.1:*`) is rejected with `403 Forbidden`.
* **No Wildcard CORS:** `Access-Control-Allow-Origin` is only ever echoed for validated extension origins — never `*` and never arbitrary origins — so websites cannot read responses or issue cross-origin POSTs to the engine.
* **Rate Limiting:** Inbound messaging is capped at 40 requests per 5-second interval to protect against denial-of-service spamming.
* **Known Limitation (tracked):** until the extension is published to the Chrome Web Store / AMO, the allowlist matches extension *schemes* rather than pinned extension IDs, so any installed extension could technically connect. Pinning exact IDs is planned immediately after store publication (see `project_update.md`).

---

## 5. Cryptographic Integrity
* Automated background computation of SHA-256 hashes (`crypto.createHash('sha256')`) validates downloaded files against corruption or partial truncations.
* User-supplied hashes are compared upon final file write to confirm byte-for-byte fidelity.

---

## 6. Privacy & Data Handling
* **Zero Cloud Uploads:** Downloaded files, video segments, and personal media remain strictly on the local machine.
* **No Telemetry Tracking:** Download logs and history are stored locally in `~/.turbograb/turbograb.db` and are never transmitted to third-party tracking services.
* **Credential Redaction:** Sensitive authentication tokens and cookies are excluded from system log outputs.
