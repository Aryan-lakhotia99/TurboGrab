const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAllDownloads: () => ipcRenderer.invoke('get-all-downloads'),
  getQueueStats: () => ipcRenderer.invoke('get-queue-stats'),
  startDownload: (params) => ipcRenderer.invoke('start-download', params),
  startBatchDownloads: (items) => ipcRenderer.invoke('start-batch-downloads', items),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', id),
  cancelDownload: (id, deleteFile) => ipcRenderer.invoke('cancel-download', id, deleteFile),
  bulkPause: () => ipcRenderer.invoke('bulk-pause'),
  bulkResume: () => ipcRenderer.invoke('bulk-resume'),
  bulkDelete: (completedOnly) => ipcRenderer.invoke('bulk-delete', completedOnly),
  openFolder: (filepath) => ipcRenderer.invoke('open-folder', filepath),
  openFile: (filepath) => ipcRenderer.invoke('open-file', filepath),
  setSpeedLimit: (limitBps) => ipcRenderer.invoke('set-speed-limit', limitBps),

  // History
  getHistory: (search, category, limit) => ipcRenderer.invoke('get-history', search, category, limit),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  saveCategory: (cat) => ipcRenderer.invoke('save-category', cat),
  deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),

  // Settings
  getAllSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Scheduled Tasks
  getScheduledTasks: () => ipcRenderer.invoke('get-scheduled-tasks'),
  addScheduledTask: (task) => ipcRenderer.invoke('add-scheduled-task', task),
  deleteScheduledTask: (id) => ipcRenderer.invoke('delete-scheduled-task', id),

  // Analytics
  getAnalytics: () => ipcRenderer.invoke('get-analytics'),

  // Clipboard & Window
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  toggleMiniMode: (mini) => ipcRenderer.invoke('toggle-mini-mode', mini),

  // Folder Selector Dialog
  selectDirectory: (defaultPath) => ipcRenderer.invoke('select-directory', defaultPath),

  // Browser Interception Location Prompt Listener
  onPromptDownloadLocation: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('prompt-download-location', handler);
    return () => ipcRenderer.removeListener('prompt-download-location', handler);
  },

  // Browser Integration & Native Messaging
  detectBrowsers: () => ipcRenderer.invoke('detect-browsers'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  registerNativeHost: () => ipcRenderer.invoke('register-native-host'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  launchBrowserExtension: (browserId) => ipcRenderer.invoke('launch-browser-extension', browserId),
});
