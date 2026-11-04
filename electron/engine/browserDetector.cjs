const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class BrowserDetector {
  constructor() {
    this.platform = process.platform; // 'win32' | 'darwin' | 'linux'
  }

  /**
   * Get OS and system metadata for the onboarding wizard
   */
  getSystemInfo() {
    let osName = 'Unknown OS';
    if (this.platform === 'win32') osName = 'Windows';
    else if (this.platform === 'darwin') osName = 'macOS';
    else if (this.platform === 'linux') osName = 'Linux';

    return {
      platform: this.platform,
      osName,
      osRelease: os.release(),
      arch: process.arch, // 'x64' | 'arm64' | 'ia32'
      hostname: os.hostname(),
      homeDir: os.homedir(),
      nodeVersion: process.version
    };
  }

  /**
   * Get multi-platform browser definitions
   */
  getBrowserDefinitions() {
    const home = os.homedir();

    if (this.platform === 'win32') {
      const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData = process.env['LocalAppData'] || path.join(home, 'AppData', 'Local');

      return [
        {
          id: 'chrome',
          name: 'Google Chrome',
          type: 'chromium',
          execPaths: [
            path.join(progFiles, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(progFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe')
          ],
          regKey: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.turbograb.host',
          storeUrl: 'https://chromewebstore.google.com'
        },
        {
          id: 'edge',
          name: 'Microsoft Edge',
          type: 'chromium',
          execPaths: [
            path.join(progFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(progFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe')
          ],
          regKey: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.turbograb.host',
          storeUrl: 'https://microsoftedge.microsoft.com/addons'
        },
        {
          id: 'firefox',
          name: 'Mozilla Firefox',
          type: 'gecko',
          execPaths: [
            path.join(progFiles, 'Mozilla Firefox\\firefox.exe'),
            path.join(progFilesX86, 'Mozilla Firefox\\firefox.exe'),
            path.join(localAppData, 'Mozilla Firefox\\firefox.exe')
          ],
          regKey: 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.turbograb.host',
          storeUrl: 'https://addons.mozilla.org'
        },
        {
          id: 'brave',
          name: 'Brave Browser',
          type: 'chromium',
          execPaths: [
            path.join(progFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
            path.join(progFilesX86, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
            path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
          ],
          regKey: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.turbograb.host',
          storeUrl: 'https://chromewebstore.google.com'
        },
        {
          id: 'opera',
          name: 'Opera',
          type: 'chromium',
          execPaths: [
            path.join(localAppData, 'Programs\\Opera\\opera.exe'),
            path.join(progFiles, 'Opera\\opera.exe'),
            path.join(progFilesX86, 'Opera\\opera.exe')
          ],
          regKey: 'HKCU\\Software\\Opera Software\\NativeMessagingHosts\\com.turbograb.host',
          storeUrl: 'https://addons.opera.com'
        }
      ];
    }

    if (this.platform === 'darwin') {
      return [
        {
          id: 'chrome',
          name: 'Google Chrome',
          type: 'chromium',
          execPaths: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
          ],
          nativeHostDir: path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
          storeUrl: 'https://chromewebstore.google.com'
        },
        {
          id: 'edge',
          name: 'Microsoft Edge',
          type: 'chromium',
          execPaths: [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            path.join(home, 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
          ],
          nativeHostDir: path.join(home, 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'),
          storeUrl: 'https://microsoftedge.microsoft.com/addons'
        },
        {
          id: 'firefox',
          name: 'Mozilla Firefox',
          type: 'gecko',
          execPaths: [
            '/Applications/Firefox.app/Contents/MacOS/firefox',
            path.join(home, 'Applications/Firefox.app/Contents/MacOS/firefox')
          ],
          nativeHostDir: path.join(home, 'Library/Application Support/Mozilla/NativeMessagingHosts'),
          storeUrl: 'https://addons.mozilla.org'
        },
        {
          id: 'brave',
          name: 'Brave Browser',
          type: 'chromium',
          execPaths: [
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            path.join(home, 'Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
          ],
          nativeHostDir: path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts'),
          storeUrl: 'https://chromewebstore.google.com'
        },
        {
          id: 'opera',
          name: 'Opera',
          type: 'chromium',
          execPaths: [
            '/Applications/Opera.app/Contents/MacOS/Opera',
            path.join(home, 'Applications/Opera.app/Contents/MacOS/Opera')
          ],
          nativeHostDir: path.join(home, 'Library/Application Support/com.operasoftware.Opera/NativeMessagingHosts'),
          storeUrl: 'https://addons.opera.com'
        }
      ];
    }

    // Linux
    return [
      {
        id: 'chrome',
        name: 'Google Chrome',
        type: 'chromium',
        execPaths: [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/snap/bin/google-chrome'
        ],
        nativeHostDir: path.join(home, '.config/google-chrome/NativeMessagingHosts'),
        storeUrl: 'https://chromewebstore.google.com'
      },
      {
        id: 'chromium',
        name: 'Chromium',
        type: 'chromium',
        execPaths: [
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium'
        ],
        nativeHostDir: path.join(home, '.config/chromium/NativeMessagingHosts'),
        storeUrl: 'https://chromewebstore.google.com'
      },
      {
        id: 'edge',
        name: 'Microsoft Edge',
        type: 'chromium',
        execPaths: [
          '/usr/bin/microsoft-edge',
          '/usr/bin/microsoft-edge-stable'
        ],
        nativeHostDir: path.join(home, '.config/microsoft-edge/NativeMessagingHosts'),
        storeUrl: 'https://microsoftedge.microsoft.com/addons'
      },
      {
        id: 'firefox',
        name: 'Mozilla Firefox',
        type: 'gecko',
        execPaths: [
          '/usr/bin/firefox',
          '/snap/bin/firefox'
        ],
        nativeHostDir: path.join(home, '.mozilla/native-messaging-hosts'),
        storeUrl: 'https://addons.mozilla.org'
      },
      {
        id: 'brave',
        name: 'Brave Browser',
        type: 'chromium',
        execPaths: [
          '/usr/bin/brave-browser',
          '/snap/bin/brave'
        ],
        nativeHostDir: path.join(home, '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts'),
        storeUrl: 'https://chromewebstore.google.com'
      },
      {
        id: 'opera',
        name: 'Opera',
        type: 'chromium',
        execPaths: [
          '/usr/bin/opera',
          '/snap/bin/opera'
        ],
        nativeHostDir: path.join(home, '.config/opera/NativeMessagingHosts'),
        storeUrl: 'https://addons.opera.com'
      }
    ];
  }

  /**
   * Scan system for installed browsers
   */
  detectInstalledBrowsers() {
    const browsers = this.getBrowserDefinitions();
    const results = [];

    for (const b of browsers) {
      let isInstalled = false;
      let detectedExe = null;

      for (const p of b.execPaths) {
        if (p && fs.existsSync(p)) {
          isInstalled = true;
          detectedExe = p;
          break;
        }
      }

      // Check if native host is registered
      let isHostRegistered = false;

      if (this.platform === 'win32') {
        try {
          const query = execSync(`reg query "${b.regKey}" /ve`, { stdio: 'pipe' }).toString();
          if (query.includes('com.turbograb.host.json') || query.includes('com.turbograb.host.firefox.json')) {
            isHostRegistered = true;
          }
        } catch (_) {
          isHostRegistered = false;
        }
      } else {
        // macOS / Linux file check
        if (b.nativeHostDir) {
          const manifestFile = path.join(b.nativeHostDir, 'com.turbograb.host.json');
          if (fs.existsSync(manifestFile)) {
            isHostRegistered = true;
          }
        }
      }

      results.push({
        id: b.id,
        name: b.name,
        type: b.type,
        isInstalled,
        executablePath: detectedExe,
        isHostRegistered,
        storeUrl: b.storeUrl
      });
    }

    return results;
  }

  /**
   * Register Native Messaging Host across Windows, macOS, or Linux
   */
  registerNativeHost(projectRoot) {
    const rootDir = projectRoot || path.resolve(__dirname, '..', '..');
    const results = [];

    if (this.platform === 'win32') {
      const chromeManifest = path.join(rootDir, 'extension', 'host', 'com.turbograb.host.json');
      const firefoxManifest = path.join(rootDir, 'extension', 'host', 'com.turbograb.host.firefox.json');

      const ops = [
        { key: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.turbograb.host', path: chromeManifest },
        { key: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.turbograb.host', path: chromeManifest },
        { key: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.turbograb.host', path: chromeManifest },
        { key: 'HKCU\\Software\\Opera Software\\NativeMessagingHosts\\com.turbograb.host', path: chromeManifest },
        { key: 'HKCU\\Software\\Mozilla\\NativeMessagingHosts\\com.turbograb.host', path: firefoxManifest }
      ];

      for (const op of ops) {
        try {
          execSync(`reg add "${op.key}" /ve /t REG_SZ /d "${op.path}" /f`, { stdio: 'pipe' });
          results.push({ key: op.key, success: true });
        } catch (err) {
          results.push({ key: op.key, success: false, error: err.message });
        }
      }
    } else {
      // macOS or Linux
      const hostScriptPath = path.join(rootDir, 'extension', 'host', 'turbograb_host.sh');

      // Ensure host script is executable
      try {
        fs.chmodSync(hostScriptPath, 0o755);
      } catch (_) {}

      // Write Chromium JSON manifest
      const chromeManifestContent = JSON.stringify({
        name: 'com.turbograb.host',
        description: 'TurboGrab Native Messaging Host',
        path: hostScriptPath,
        type: 'stdio',
        allowed_origins: [
          'chrome-extension://*/',
          'chrome-extension://turbograb-interceptor@turbograb.app/'
        ]
      }, null, 2);

      // Write Firefox JSON manifest
      const firefoxManifestContent = JSON.stringify({
        name: 'com.turbograb.host',
        description: 'TurboGrab Native Messaging Host for Firefox',
        path: hostScriptPath,
        type: 'stdio',
        allowed_extensions: [
          'turbograb-interceptor@turbograb.app'
        ]
      }, null, 2);

      const browsers = this.getBrowserDefinitions();
      for (const b of browsers) {
        if (!b.nativeHostDir) continue;

        try {
          fs.mkdirSync(b.nativeHostDir, { recursive: true });
          const targetFile = path.join(b.nativeHostDir, 'com.turbograb.host.json');
          const content = b.type === 'gecko' ? firefoxManifestContent : chromeManifestContent;
          fs.writeFileSync(targetFile, content, 'utf8');
          results.push({ path: targetFile, success: true });
        } catch (err) {
          results.push({ path: b.nativeHostDir, success: false, error: err.message });
        }
      }
    }

    return results;
  }
}

module.exports = new BrowserDetector();
