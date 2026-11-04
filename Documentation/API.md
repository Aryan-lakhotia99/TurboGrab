# TurboGrab API & Protocol Specification

## 1. WebSocket Bridge Protocol (`version: 1`)

The desktop engine exposes a local loopback WebSocket server on:
```text
ws://127.0.0.1:48123
```

### Connection Rules
* Only connections from `chrome-extension://*`, `moz-extension://*`, `127.0.0.1`, or `localhost` are permitted. Arbitrary external web origins are rejected with `403 Forbidden`.
* Maximum rate limit: 40 messages per 5-second window per socket.

---

### Message Schemas

#### 1. Handshake / Ping
```json
// Request
{
  "version": 1,
  "type": "HANDSHAKE",
  "client": "TurboGrab WebExtension MV3",
  "requestId": "req_1001"
}

// Response
{
  "version": 1,
  "type": "PONG",
  "status": "connected",
  "requestId": "req_1001"
}
```

#### 2. Start / Intercept Download
```json
// Request
{
  "version": 1,
  "command": "start_download",
  "payload": {
    "url": "https://example.com/archive.zip",
    "filename": "archive.zip",
    "cookies": "session=xyz123",
    "referrer": "https://example.com",
    "connections": 16,
    "mode": "smart",
    "isStream": false
  },
  "requestId": "req_1002"
}

// Response
{
  "version": 1,
  "status": "accepted",
  "success": true,
  "download_id": "task_1793556823052_36rl3b",
  "action": "start_download",
  "requestId": "req_1002"
}
```

#### 3. Task Control (Pause / Resume / Cancel)
```json
// Request
{
  "version": 1,
  "command": "pause_download",
  "payload": { "id": "task_1793556823052_36rl3b" },
  "requestId": "req_1003"
}

// Response
{
  "version": 1,
  "success": true,
  "requestId": "req_1003"
}
```

---

## 2. Electron Preload IPC API (`window.electronAPI`)

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `getAllDownloads()` | None | `Promise<DownloadItem[]>` | Retrieves all tracked downloads from SQLite. |
| `getQueueStats()` | None | `Promise<EngineStats>` | Returns aggregated speed, active tasks, and total count. |
| `startDownload(params)` | `params: DownloadParams` | `Promise<string>` | Dispatches a new accelerated download task. |
| `startBatchDownloads(items)` | `items: Array<DownloadParams>` | `Promise<string[]>` | Queues multiple URLs at once. |
| `pauseDownload(id)` | `id: string` | `Promise<boolean>` | Pauses an active download and saves byte offsets. |
| `resumeDownload(id)` | `id: string` | `Promise<boolean>` | Resumes a paused task from saved chunk offsets. |
| `cancelDownload(id, deleteFile)` | `id: string, deleteFile: boolean` | `Promise<boolean>` | Removes task and optionally unlinks the target file. |
| `bulkPause()` | None | `Promise<boolean>` | Pauses all downloading tasks. |
| `bulkResume()` | None | `Promise<boolean>` | Resumes all paused tasks. |
| `bulkDelete(completedOnly)`| `completedOnly: boolean` | `Promise<boolean>` | Clears completed or all tasks from the queue. |
| `setSpeedLimit(limitBps)` | `limitBps: number` | `Promise<boolean>` | Sets global bandwidth throttle in bytes/sec. |
| `getHistory(search, cat)` | `search: string, cat: string` | `Promise<HistoryItem[]>` | Queries completed download history records. |
| `clearHistory()` | None | `Promise<boolean>` | Clears history log without deleting disk files. |
| `getCategories()` | None | `Promise<CategoryItem[]>` | Retrieves category organization rules. |
| `saveCategory(cat)` | `cat: CategoryItem` | `Promise<boolean>` | Saves or updates a category routing rule. |
| `getAllSettings()` | None | `Promise<Record<string, string>>` | Returns all application settings. |
| `setSetting(key, val)` | `key: string, val: string` | `Promise<boolean>` | Updates a setting in the database. |
| `getScheduledTasks()` | None | `Promise<ScheduledTask[]>` | Returns queued scheduled tasks. |
| `addScheduledTask(task)` | `task: ScheduledTask` | `Promise<boolean>` | Enqueues a timed download execution. |
| `getAnalytics()` | None | `Promise<AnalyticsData>` | Returns total data and category distributions. |
| `toggleMiniMode(mini)` | `mini: boolean` | `Promise<boolean>` | Toggles compact floating window mode. |
