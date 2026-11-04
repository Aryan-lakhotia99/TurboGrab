# TurboGrab Official Downloads

This directory contains the release distribution binaries for TurboGrab, tracked using **Git Large File Storage (Git LFS)**.

---

## 📦 Available Download Packages

| Operating System | Package | Size | SHA-256 Checksum | Tracking |
|---|---|---|---|---|
| **Windows 10 / 11** | [`TurboGrab Setup 1.0.0.exe`](./TurboGrab%20Setup%201.0.0.exe) | 125.88 MB | `A6660A4C8DA45C733B3789E686F368AB52E11524B9F80FE3432A4EFC8B76A9AA` | Git LFS |
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
A6660A4C8DA45C733B3789E686F368AB52E11524B9F80FE3432A4EFC8B76A9AA
```

---

## 🌐 Cross-Platform Binaries (macOS & Linux)
TurboGrab's automated release pipeline (`.github/workflows/release.yml`) builds:
- **macOS Apple Silicon**: `turbograb_aarch64.dmg`
- **Linux 64-bit**: `turbograb_amd64.AppImage`
- **Windows MSI**: `turbograb_x64.msi`

You can download all platform binaries from the [Releases Tab](../../releases).
