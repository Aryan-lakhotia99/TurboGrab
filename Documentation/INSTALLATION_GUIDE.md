# TurboGrab — Cross-Platform Desktop Installation & Deployment Guide

## 1. Supported Operating Systems
TurboGrab is fully cross-platform, supporting 64-bit and ARM architectures across:
- **Windows**: Windows 10 and Windows 11 (x64, ia32)
- **macOS**: macOS 12 Monterey, macOS 13 Ventura, macOS 14 Sonoma, macOS 15 Sequoia (Apple Silicon arm64 & Intel x64)
- **Linux**: Ubuntu/Debian (.deb), Fedora/RedHat (.rpm), and Universal portable (.AppImage)

---

## 2. Windows Installation

### Option A: Standard NSIS Installer (.exe)
1. Navigate to the `release/` folder.
2. Run `TurboGrab Setup 1.0.0.exe`.
3. Select your installation folder (Default: `%LocalAppData%\Programs\turbograb`).
4. TurboGrab automatically creates:
   - Desktop shortcut
   - Start Menu shortcut
   - Windows Registry uninstaller
5. Launch TurboGrab from your Start Menu or Desktop.

### Option B: Standalone Portable Executable
1. Run `release\TurboGrab 1.0.0.exe` directly without administrative installation.
2. Settings and download task database (`turbograb.db`) will be stored in your user profile.

### Option C: Developer / Source Launch
1. Ensure Node.js 18+ is installed.
2. Double-click `TurboGrab.bat` or `Start-TurboGrab-With-Chrome.bat`.

---

## 3. macOS Installation
1. Mount the generated Apple Disk Image:
   ```bash
   hdiutil attach release/TurboGrab-1.0.0.dmg
   ```
2. Drag `TurboGrab.app` into your `/Applications` folder.
3. On first launch, open Terminal and authorize the local Native Messaging script:
   ```bash
   chmod +x /Applications/TurboGrab.app/Contents/Resources/extension/host/turbograb_host.sh
   ```
4. Native Messaging manifests are automatically registered in:
   `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
   `~/Library/Application Support/Mozilla/NativeMessagingHosts/`

---

## 4. Linux Installation

### AppImage (Universal)
1. Make the AppImage executable:
   ```bash
   chmod +x release/TurboGrab-1.0.0.AppImage
   ```
2. Run `./TurboGrab-1.0.0.AppImage`.

### Debian / Ubuntu (.deb)
```bash
sudo dpkg -i release/turbograb_1.0.0_amd64.deb
sudo apt-get install -f # Fix dependencies if needed
```

### Fedora / RHEL (.rpm)
```bash
sudo rpm -i release/turbograb-1.0.0.x86_64.rpm
```

---

## 5. Browser Extension Integration Workflow
When TurboGrab launches, the **Setup Wizard** guides the user through automatic onboarding:
1. **System Detection**: Verifies OS, version, and CPU architecture.
2. **Browser Selection**: Detects Chrome, Edge, Firefox, Brave, and Opera.
3. **1-Click Host Registration**: Writes Native Messaging manifests.
4. **Extension Install**: Direct link to Chrome Web Store, Edge Add-ons, or Firefox AMO.
5. **Connection Verification**: Real-time heartbeat probe confirms active bridge.
