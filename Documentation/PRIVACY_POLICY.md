# TurboGrab — Privacy & Data Protection Policy

## 1. Local-First Philosophy
TurboGrab is engineered as a local-first application. All download requests, telemetry statistics, bandwidth calculations, and media processing occur entirely on your local machine.

## 2. Telemetry and Analytics
- **No Cloud Reporting**: TurboGrab transmits no browsing activity, downloaded file contents, or personal identifiers to any remote servers.
- **Local WebSocket & Native Messaging**: All communications between the browser extension and desktop engine occur strictly on local loopback (`127.0.0.1`) and stdio pipes.
- **Cookies & Session Tokens**: Cookies captured for authenticated download streams remain strictly in memory on the local machine and are discarded immediately after request completion.

## 3. Data Storage
Download histories, scheduled tasks, and segment state are stored in a local SQLite file (`turbograb.db`) in your user data directory. You can delete or clear this history at any time using the **History** view in the application.
