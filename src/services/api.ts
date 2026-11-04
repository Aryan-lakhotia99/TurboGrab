import {
  DownloadItem,
  EngineStats,
  HistoryItem,
  CategoryItem,
  ScheduledTask,
  AnalyticsData
} from '../types';

const getElectronAPI = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
};

// Fallback in-memory state for standalone browser preview
let mockDownloads: DownloadItem[] = [];
let mockHistory: HistoryItem[] = [];
let mockCategories: CategoryItem[] = [
  { id: 'cat_video', name: 'Videos', extensions: ['mp4', 'mkv', 'avi'], destination_folder: 'Downloads/Videos', is_custom: false },
  { id: 'cat_music', name: 'Music', extensions: ['mp3', 'flac', 'wav'], destination_folder: 'Downloads/Music', is_custom: false },
  { id: 'cat_doc', name: 'Documents', extensions: ['pdf', 'doc', 'docx'], destination_folder: 'Downloads/Documents', is_custom: false },
  { id: 'cat_archive', name: 'Compressed Files', extensions: ['zip', 'rar', '7z'], destination_folder: 'Downloads/Compressed', is_custom: false },
  { id: 'cat_prog', name: 'Programs', extensions: ['exe', 'msi', 'apk'], destination_folder: 'Downloads/Programs', is_custom: false },
  { id: 'cat_img', name: 'Images', extensions: ['jpg', 'png', 'webp'], destination_folder: 'Downloads/Images', is_custom: false },
  { id: 'cat_other', name: 'Other Files', extensions: [], destination_folder: 'Downloads/Other', is_custom: false },
];
let mockSettings: Record<string, string> = {
  theme: 'light',
  default_download_folder: 'Downloads',
  max_connections_per_task: '16',
  download_mode: 'smart',
  auto_organize: 'true',
  clipboard_monitor: 'true'
};
let mockScheduled: ScheduledTask[] = [];

export const api = {
  async getAllDownloads(): Promise<DownloadItem[]> {
    const electron = getElectronAPI();
    if (electron && electron.getAllDownloads) {
      try {
        const items = await electron.getAllDownloads();
        if (Array.isArray(items)) return items;
      } catch (e) {
        console.warn('Electron getAllDownloads error:', e);
      }
    }
    return [...mockDownloads];
  },

  async getQueueStats(): Promise<EngineStats> {
    const electron = getElectronAPI();
    if (electron && electron.getQueueStats) {
      try {
        const stats = await electron.getQueueStats();
        if (stats) return stats;
      } catch (e) {
        console.warn('Electron getQueueStats error:', e);
      }
    }

    const active = mockDownloads.filter(d => d.status === 'downloading' || d.status === 'demuxing');
    const totalSpeed = active.reduce((sum, d) => sum + (d.speed_bps || 0), 0);
    return {
      global_speed_bps: totalSpeed,
      active_downloads: active.length,
      total_downloads: mockDownloads.length,
      speed_limit_bps: 0
    };
  },

  async startDownload(params: {
    url: string;
    filename?: string;
    destination_folder?: string;
    destination_path?: string;
    cookies?: string;
    referrer?: string;
    user_agent?: string;
    is_stream?: boolean;
    connections?: number;
    mode?: 'normal' | 'high_speed' | 'smart';
    checksum_sha256?: string;
  }): Promise<string> {
    const electron = getElectronAPI();
    if (electron && electron.startDownload) {
      try {
        return await electron.startDownload(params);
      } catch (e) {
        console.warn('Electron startDownload error:', e);
      }
    }

    const id = 'mock_' + Date.now();
    const item: DownloadItem = {
      id,
      url: params.url,
      filename: params.filename || 'download_' + Date.now() + '.bin',
      destination_path: 'Downloads/' + (params.filename || 'download_' + Date.now() + '.bin'),
      total_bytes: 50 * 1024 * 1024,
      downloaded_bytes: 0,
      speed_bps: 12.5 * 1024 * 1024,
      eta_seconds: 4,
      status: 'downloading',
      category: 'Other Files',
      is_stream: !!params.is_stream,
      connections: params.connections || 16,
      mode: params.mode || 'smart',
      segments: Array.from({ length: 16 }, (_, i) => ({
        id: i,
        start_byte: i * 3125000,
        end_byte: (i + 1) * 3125000,
        current_offset: i * 3125000,
        speed_bps: 800000,
        active_worker_id: i,
        is_completed: false
      })),
      created_at: Date.now(),
      updated_at: Date.now()
    };
    mockDownloads.unshift(item);
    return id;
  },

  async startBatchDownloads(items: { url: string; filename?: string; category?: string }[]): Promise<string[]> {
    const electron = getElectronAPI();
    if (electron && electron.startBatchDownloads) {
      try {
        return await electron.startBatchDownloads(items);
      } catch (e) {
        console.warn('Electron startBatchDownloads error:', e);
      }
    }
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await this.startDownload(item));
    }
    return ids;
  },

  async pauseDownload(id: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.pauseDownload) {
      try {
        return await electron.pauseDownload(id);
      } catch (e) {
        console.warn('Electron pauseDownload error:', e);
      }
    }
    const item = mockDownloads.find(d => d.id === id);
    if (item) {
      item.status = 'paused';
      item.speed_bps = 0;
    }
    return true;
  },

  async resumeDownload(id: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.resumeDownload) {
      try {
        return await electron.resumeDownload(id);
      } catch (e) {
        console.warn('Electron resumeDownload error:', e);
      }
    }
    const item = mockDownloads.find(d => d.id === id);
    if (item) {
      item.status = 'downloading';
      item.speed_bps = 10 * 1024 * 1024;
    }
    return true;
  },

  async cancelDownload(id: string, deleteFile = false): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.cancelDownload) {
      try {
        return await electron.cancelDownload(id, deleteFile);
      } catch (e) {
        console.warn('Electron cancelDownload error:', e);
      }
    }
    mockDownloads = mockDownloads.filter(d => d.id !== id);
    return true;
  },

  async bulkPause(): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.bulkPause) {
      return await electron.bulkPause();
    }
    mockDownloads.forEach(d => { if (d.status === 'downloading') d.status = 'paused'; });
    return true;
  },

  async bulkResume(): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.bulkResume) {
      return await electron.bulkResume();
    }
    mockDownloads.forEach(d => { if (d.status === 'paused') d.status = 'downloading'; });
    return true;
  },

  async bulkDelete(completedOnly = false): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.bulkDelete) {
      return await electron.bulkDelete(completedOnly);
    }
    if (completedOnly) {
      mockDownloads = mockDownloads.filter(d => d.status !== 'completed');
    } else {
      mockDownloads = [];
    }
    return true;
  },

  async openFolder(filepath: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.openFolder) {
      return await electron.openFolder(filepath);
    }
    return true;
  },

  async openFile(filepath: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.openFile) {
      return await electron.openFile(filepath);
    }
    return true;
  },

  async setSpeedLimit(limit_bps: number): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.setSpeedLimit) {
      return await electron.setSpeedLimit(limit_bps);
    }
    return true;
  },

  // History
  async getHistory(search = '', category = '', limit = 100): Promise<HistoryItem[]> {
    const electron = getElectronAPI();
    if (electron && electron.getHistory) {
      return await electron.getHistory(search, category, limit);
    }
    return [...mockHistory];
  },

  async clearHistory(): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.clearHistory) {
      return await electron.clearHistory();
    }
    mockHistory = [];
    return true;
  },

  // Categories
  async getCategories(): Promise<CategoryItem[]> {
    const electron = getElectronAPI();
    if (electron && electron.getCategories) {
      return await electron.getCategories();
    }
    return [...mockCategories];
  },

  async saveCategory(cat: CategoryItem): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.saveCategory) {
      return await electron.saveCategory(cat);
    }
    const idx = mockCategories.findIndex(c => c.id === cat.id);
    if (idx >= 0) mockCategories[idx] = cat;
    else mockCategories.push(cat);
    return true;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.deleteCategory) {
      return await electron.deleteCategory(id);
    }
    mockCategories = mockCategories.filter(c => c.id !== id);
    return true;
  },

  // Settings
  async getAllSettings(): Promise<Record<string, string>> {
    const electron = getElectronAPI();
    if (electron && electron.getAllSettings) {
      return await electron.getAllSettings();
    }
    return { ...mockSettings };
  },

  async setSetting(key: string, value: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.setSetting) {
      return await electron.setSetting(key, value);
    }
    mockSettings[key] = value;
    return true;
  },

  // Scheduled Tasks
  async getScheduledTasks(): Promise<ScheduledTask[]> {
    const electron = getElectronAPI();
    if (electron && electron.getScheduledTasks) {
      return await electron.getScheduledTasks();
    }
    return [...mockScheduled];
  },

  async addScheduledTask(task: ScheduledTask): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.addScheduledTask) {
      return await electron.addScheduledTask(task);
    }
    mockScheduled.push(task);
    return true;
  },

  async deleteScheduledTask(id: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.deleteScheduledTask) {
      return await electron.deleteScheduledTask(id);
    }
    mockScheduled = mockScheduled.filter(s => s.id !== id);
    return true;
  },

  // Analytics
  async getAnalytics(): Promise<AnalyticsData> {
    const electron = getElectronAPI();
    if (electron && electron.getAnalytics) {
      return await electron.getAnalytics();
    }
    return {
      totalDownloads: mockDownloads.length,
      completedDownloads: mockDownloads.filter(d => d.status === 'completed').length,
      failedDownloads: mockDownloads.filter(d => d.status === 'error').length,
      totalBytes: mockDownloads.reduce((sum, d) => sum + d.downloaded_bytes, 0),
      categoryBreakdown: [
        { category: 'Videos', count: 4, bytes: 1400000000 },
        { category: 'Documents', count: 8, bytes: 45000000 }
      ],
      historyItems: []
    };
  },

  // Clipboard & Window
  async readClipboardText(): Promise<string> {
    const electron = getElectronAPI();
    if (electron && electron.readClipboardText) {
      return await electron.readClipboardText();
    }
    return '';
  },

  async toggleMiniMode(mini: boolean): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.toggleMiniMode) {
      return await electron.toggleMiniMode(mini);
    }
    return true;
  },

  // Browser Integration & Native Messaging
  async getSystemInfo(): Promise<any> {
    const electron = getElectronAPI();
    if (electron && electron.getSystemInfo) {
      return await electron.getSystemInfo();
    }
    return {
      platform: 'win32',
      osName: 'Windows',
      osRelease: '10.0.22631',
      arch: 'x64',
      hostname: 'DESKTOP-TURBOGRAB',
      homeDir: 'C:\\Users\\User',
      nodeVersion: 'v20.0.0'
    };
  },

  async checkForUpdates(): Promise<any> {
    const electron = getElectronAPI();
    if (electron && electron.checkForUpdates) {
      return await electron.checkForUpdates();
    }
    return {
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
      releaseNotes: 'TurboGrab is running the latest production build.',
      releaseDate: new Date().toISOString()
    };
  },

  async detectBrowsers(): Promise<any[]> {
    const electron = getElectronAPI();
    if (electron && electron.detectBrowsers) {
      return await electron.detectBrowsers();
    }
    return [
      { id: 'chrome', name: 'Google Chrome', type: 'chromium', isInstalled: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', isHostRegistered: true, storeUrl: 'https://chromewebstore.google.com' },
      { id: 'edge', name: 'Microsoft Edge', type: 'chromium', isInstalled: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', isHostRegistered: true, storeUrl: 'https://microsoftedge.microsoft.com/addons' },
      { id: 'firefox', name: 'Mozilla Firefox', type: 'gecko', isInstalled: false, executablePath: null, isHostRegistered: false, storeUrl: 'https://addons.mozilla.org' },
      { id: 'brave', name: 'Brave Browser', type: 'chromium', isInstalled: false, executablePath: null, isHostRegistered: false, storeUrl: 'https://chromewebstore.google.com' }
    ];
  },

  async registerNativeHost(): Promise<any[]> {
    const electron = getElectronAPI();
    if (electron && electron.registerNativeHost) {
      return await electron.registerNativeHost();
    }
    return [{ key: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.turbograb.host', success: true }];
  },

  async openExternalUrl(url: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.openExternalUrl) {
      return await electron.openExternalUrl(url);
    }
    window.open(url, '_blank');
    return true;
  },

  async launchBrowserExtension(browserId: string): Promise<boolean> {
    const electron = getElectronAPI();
    if (electron && electron.launchBrowserExtension) {
      return await electron.launchBrowserExtension(browserId);
    }
    return true;
  },

  async selectDirectory(defaultPath?: string): Promise<string | null> {
    const electron = getElectronAPI();
    if (electron && electron.selectDirectory) {
      try {
        return await electron.selectDirectory(defaultPath);
      } catch (e) {
        console.warn('Electron selectDirectory error:', e);
      }
    }
    return null;
  },

  onPromptDownloadLocation(callback: (payload: any) => void): () => void {
    const electron = getElectronAPI();
    if (electron && electron.onPromptDownloadLocation) {
      return electron.onPromptDownloadLocation(callback);
    }
    return () => {};
  }
};
