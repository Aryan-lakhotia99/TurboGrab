# TurboGrab Official Downloads

This directory contains the release distribution binaries for TurboGrab, tracked using **Git Large File Storage (Git LFS)**.

---

## 📦 Available Download Packages

| Operating System | Package | Size | SHA-256 Checksum | Tracking |
|---|---|---|---|---|
| **Windows 10 / 11** | [`TurboGrab Setup 1.0.0.exe`](./TurboGrab%20Setup%201.0.0.exe) | 125.88 MB | `47B582CF74CF207EBA23CBF986179DB1DA04E881B80B34C216CA510864E9A29C` | Git LFS |
| **Browser Extension (Zip)** | [`TurboGrab-Browser-Extension-v1.0.0.zip`](./TurboGrab-Browser-Extension-v1.0.0.zip) | 21 KB | `D1DF9BFB28FAE3454DC36AE2B6AA7C75FC6006B919822FABAFBA136D64865D68` | Direct Download |
| **Browser Extension (Unpacked)** | [`extension/`](./extension) | Directory | Ready to Load | Direct Repository |
| **Cross-Platform Portable** | [`TurboGrab-v1.0.0-Windows-x64.zip`](./TurboGrab-v1.0.0-Windows-x64.zip) | 126 KB | Dynamic Build | Git LFS |
| **macOS (Apple Silicon)** | `turbograb_aarch64.dmg` | Auto-built | Automated CI/CD | [GitHub Releases](../../releases) |
| **Linux (Universal)** | `turbograb_amd64.AppImage` | Auto-built | Automated CI/CD | [GitHub Releases](../../releases) |

---

## 🚀 How to Download

### Method 1: Web Browser Download from GitHub
1. Click on [`TurboGrab Setup 1.0.0.exe`](./TurboGrab%20Setup%201.0.0.exe).
2. Click the **Download** or **View Raw** button on GitHub.
3. Your browser will download the full 125.88 MB installer directly via GitHub's CDN.

### Method 2: Git LFS Clone / Pull
If you cloned the repository with Git, download the binaries using:
```bash
git lfs install
git lfs pull
```

---

## 🔒 Checksum Verification (Windows PowerShell)

To verify the integrity and authenticity of the installer:
```powershell
Get-FileHash -Path "TurboGrab Setup 1.0.0.exe" -Algorithm SHA256
```
Expected Hash:
```
47B582CF74CF207EBA23CBF986179DB1DA04E881B80B34C216CA510864E9A29C
```

---

## 🌐 Cross-Platform Binaries (macOS & Linux)
Additional platform packages (macOS `.dmg` and Linux `.AppImage`) can be built directly from source or downloaded from the [Releases Tab](../../releases).
