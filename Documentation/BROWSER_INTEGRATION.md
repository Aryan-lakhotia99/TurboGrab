# TurboGrab — Multi-Browser Integration Guide

## 1. Overview
TurboGrab provides deep integration with modern web browsers, enabling automated media sniffing, one-click floating download chips, resolution selection, and seamless transfer into the desktop download engine.

## 2. Supported Browsers
| Browser | Engine | Extension Standard | Integration Method |
|---|---|---|---|
| **Google Chrome** | Chromium | Manifest V3 | Native Messaging Host + Load Unpacked / WebStore |
| **Microsoft Edge** | Chromium | Manifest V3 | Native Messaging Host + Edge Add-ons |
| **Brave Browser** | Chromium | Manifest V3 | Native Messaging Host + Chromium Extension |
| **Mozilla Firefox** | Gecko | WebExtensions V2/V3 | Native Messaging Host (`allowed_extensions`) |

## 3. Communication Bridge Architecture
```
┌─────────────────────────────────┐
│     Web Browser (Chrome/Edge)   │
│  - Media Sniffer Content Script │
│  - Floating Quality Grab-Chip   │
│  - Background Service Worker    │
└────────────────┬────────────────┘
                 │ Native Messaging (chrome.runtime.sendNativeMessage)
                 ▼
┌─────────────────────────────────┐
│   Native Messaging Host         │
│  - com.turbograb.host.json      │
│  - native_host.cjs (stdin/out)  │
└────────────────┬────────────────┘
                 │ HTTP/WebSocket (127.0.0.1:48123)
                 ▼
┌─────────────────────────────────┐
│   TurboGrab Desktop Engine      │
│  - wsServer.cjs                 │
│  - downloadManager.cjs          │
│  - FFmpeg Post-Processing       │
└─────────────────────────────────┘
```

## 4. Automated Registry Registration
TurboGrab automatically inspects and writes the native messaging registry keys for the current user:
- Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.turbograb.host`
- Edge: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.turbograb.host`
- Firefox: `HKCU\Software\Mozilla\NativeMessagingHosts\com.turbograb.host`

Can also be registered with one click via the desktop app's **Browser Integration** tab or by running `install-chrome-integration.bat`.
