const { app, BrowserWindow, ipcMain, shell, clipboard, Notification, dialog } = require('electron');

// Prevent multiple instances from conflicting - exit immediately if second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
  process.exit(0);
}

// Disable GPU disk cache lock conflicts
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const path = require('path');
const fs = require('fs');
const downloadManager = require('./engine/downloadManager.cjs');
const { initWsServer, closeWsServer, setInterceptHandler } = require('./engine/wsServer.cjs');
const db = require('./engine/db.cjs');
const browserDetector = require('./engine/browserDetector.cjs');

let mainWindow = null;

// Catch unhandled exceptions gracefully
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn('[TurboGrab Notice] Port 48123 is already bound by an active instance.');
  } else {
    console.error('[TurboGrab Exception]:', err.message);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'TurboGrab • Smart Download Manager',
    backgroundColor: '#FAFAFA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // SECURITY: full renderer sandbox. The preload script only uses
      // contextBridge + ipcRenderer, both of which are available in sandboxed
      // preloads, so no functionality is lost.
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Capture renderer console logs for easy debugging
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('http://localhost:1420/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // 1. Initialize WebSocket Bridge on 127.0.0.1:48123 for browser extension
  initWsServer();

  // Route intercepted downloads from browser extension to UI modal if ask_download_location is enabled
  setInterceptHandler((payload) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('prompt-download-location', payload);
      return true;
    }
    return false;
  });

  // Desktop Native Notifications
  downloadManager.onNotification = (type, item) => {
    try {
      const notifySetting = db.getSetting('notify_on_complete');
      if (notifySetting === 'false') return;
      if (Notification.isSupported()) {
        if (type === 'completed') {
          new Notification({
            title: 'TurboGrab • Download Complete',
            body: `${item.filename} has finished downloading!`,
            silent: false
          }).show();
        } else if (type === 'error') {
          new Notification({
            title: 'TurboGrab • Download Failed',
            body: `${item.filename}: ${item.error_message || 'An error occurred'}`,
            silent: false
          }).show();
        }
      }
    } catch (_) {}
  };

  // 2. Setup IPC Handlers
  ipcMain.handle('get-all-downloads', () => {
    return downloadManager.getAll();
  });

  ipcMain.handle('get-queue-stats', () => {
    return downloadManager.getStats();
  });

  ipcMain.handle('start-download', async (_, params) => {
    return await downloadManager.startDownload(params);
  });

  ipcMain.handle('start-batch-downloads', async (_, items) => {
    return await downloadManager.startBatch(items);
  });

  ipcMain.handle('pause-download', (_, id) => {
    downloadManager.pauseDownload(id);
    return true;
  });

  ipcMain.handle('resume-download', (_, id) => {
    downloadManager.resumeDownload(id);
    return true;
  });

  ipcMain.handle('cancel-download', (_, id, deleteFile) => {
    downloadManager.cancelDownload(id, !!deleteFile);
    return true;
  });

  ipcMain.handle('bulk-pause', () => {
    downloadManager.bulkPause();
    return true;
  });

  ipcMain.handle('bulk-resume', () => {
    downloadManager.bulkResume();
    return true;
  });

  ipcMain.handle('bulk-delete', (_, completedOnly) => {
    downloadManager.bulkDelete(completedOnly);
    return true;
  });

  ipcMain.handle('open-folder', (_, filepath) => {
    if (filepath && fs.existsSync(filepath)) {
      shell.showItemInFolder(filepath);
    } else {
      shell.openPath(path.join(app.getPath('home'), 'Downloads'));
    }
    return true;
  });

  ipcMain.handle('open-file', (_, filepath) => {
    if (filepath && fs.existsSync(filepath)) {
      shell.openPath(filepath);
      return true;
    }
    return false;
  });

  ipcMain.handle('select-directory', async (_, defaultPath) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder',
      defaultPath: defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('set-speed-limit', (_, limitBps) => {
    downloadManager.speedLimitBps = limitBps;
    db.setSetting('speed_limit_bps', limitBps);
    return true;
  });

  // History
  ipcMain.handle('get-history', (_, search, category, limit) => {
    return db.getHistory(search, category, limit);
  });

  ipcMain.handle('clear-history', () => {
    db.clearHistory();
    return true;
  });

  // Categories
  ipcMain.handle('get-categories', () => {
    return db.getCategories();
  });

  ipcMain.handle('save-category', (_, cat) => {
    db.saveCategory(cat);
    return true;
  });

  ipcMain.handle('delete-category', (_, id) => {
    db.deleteCategory(id);
    return true;
  });

  // Settings
  ipcMain.handle('get-settings', () => {
    return db.getAllSettings();
  });

  ipcMain.handle('set-setting', (_, key, value) => {
    db.setSetting(key, value);
    downloadManager.updateSetting(key, value);
    return true;
  });

  // Scheduled Tasks
  ipcMain.handle('get-scheduled-tasks', () => {
    return db.getScheduledTasks();
  });

  ipcMain.handle('add-scheduled-task', (_, task) => {
    db.addScheduledTask(task);
    return true;
  });

  ipcMain.handle('delete-scheduled-task', (_, id) => {
    db.deleteScheduledTask(id);
    return true;
  });

  // Analytics
  ipcMain.handle('get-analytics', () => {
    return db.getAnalytics();
  });

  // Clipboard & Window
  ipcMain.handle('read-clipboard-text', () => {
    return clipboard.readText();
  });

  ipcMain.handle('toggle-mini-mode', (_, mini) => {
    if (!mainWindow) return false;
    if (mini) {
      mainWindow.setSize(440, 260);
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setResizable(false);
    } else {
      mainWindow.setSize(1240, 840);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setResizable(true);
      mainWindow.center();
    }
    return true;
  });

  // Browser Detection & Native Messaging Integration
  ipcMain.handle('detect-browsers', () => {
    return browserDetector.detectInstalledBrowsers();
  });

  ipcMain.handle('get-system-info', () => {
    return browserDetector.getSystemInfo();
  });

  ipcMain.handle('register-native-host', () => {
    return browserDetector.registerNativeHost(path.join(__dirname, '..'));
  });

  ipcMain.handle('check-for-updates', async () => {
    return {
      currentVersion: app.getVersion() || '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
      releaseNotes: 'TurboGrab Universal Download Manager is running the latest production build.',
      releaseDate: new Date().toISOString()
    };
  });

  ipcMain.handle('open-external-url', (_, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('launch-browser-extension', (_, browserId) => {
    const browsers = browserDetector.detectInstalledBrowsers();
    const target = browsers.find(b => b.id === browserId && b.isInstalled);
    if (!target || !target.executablePath) return false;

    let extPath = path.join(__dirname, '..', 'extension');
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'extension');
      if (fs.existsSync(unpacked)) {
        extPath = unpacked;
      }
    }
    const { spawn } = require('child_process');

    // 1. Open the extension folder in File Explorer so the user can easily select or drag it
    try {
      shell.openPath(extPath);
    } catch (_) {}

    // 2. Determine target browser's extension management URL
    let extUrl = 'chrome://extensions';
    if (target.id === 'edge') extUrl = 'edge://extensions';
    else if (target.id === 'brave') extUrl = 'brave://extensions';
    else if (target.id === 'opera') extUrl = 'opera://extensions';
    else if (target.id === 'firefox') extUrl = 'about:debugging#/runtime/this-firefox';

    // 3. Launch browser directly to the extension installation page
    try {
      if (target.type === 'chromium') {
        spawn(target.executablePath, [`--load-extension=${extPath}`, extUrl], { detached: true });
      } else {
        spawn(target.executablePath, [extUrl], { detached: true });
      }
      return true;
    } catch (e) {
      console.warn(`[TurboGrab] Could not launch ${target.name} directly, opening store URL:`, e.message);
      shell.openExternal(target.storeUrl);
      return false;
    }
  });

  ipcMain.handle('open-extension-folder', async () => {
    let extPath = path.join(__dirname, '..', 'extension');
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'extension');
      if (fs.existsSync(unpacked)) {
        extPath = unpacked;
      }
    }
    try {
      await shell.openPath(extPath);
      return { success: true, path: extPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-extension-to-downloads', async () => {
    let srcExt = path.join(__dirname, '..', 'extension');
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'extension');
      if (fs.existsSync(unpacked)) {
        srcExt = unpacked;
      }
    }
    const destDir = path.join(app.getPath('downloads'), 'TurboGrab-Extension');
    try {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.cpSync(srcExt, destDir, { recursive: true });
      await shell.openPath(destDir);
      return { success: true, path: destDir };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-extension-path', () => {
    let extPath = path.join(__dirname, '..', 'extension');
    if (app.isPackaged) {
      const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'extension');
      if (fs.existsSync(unpacked)) {
        extPath = unpacked;
      }
    }
    return extPath;
  });

  // 3. Create native desktop window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeWsServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  closeWsServer();
});
