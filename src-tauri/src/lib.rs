pub mod commands;
pub mod engine;

use engine::server::{LocalServer, DEFAULT_WS_PORT};
use engine::DownloadEngine;
use std::env;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::mpsc;

pub fn run() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--native-messaging") {
        if let Err(e) = LocalServer::run_native_messaging_host() {
            eprintln!("Native messaging host error: {:?}", e);
        }
        return;
    }

    // Determine paths
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let download_dir = dirs::download_dir().unwrap_or_else(|| home_dir.join("Downloads"));
    let data_dir = home_dir.join(".turbograb");
    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::create_dir_all(&download_dir);

    // Initialize core engine
    let engine = match DownloadEngine::new(&data_dir, download_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("Failed to initialize TurboGrab Engine: {:?}", err);
            return;
        }
    };

    // Channel for browser extension handoff
    let (intercept_tx, mut intercept_rx) = mpsc::channel(100);

    // Spawn WebSocket loopback server on 127.0.0.1:48123
    let server = Arc::new(LocalServer::new(DEFAULT_WS_PORT, intercept_tx));
    tauri::async_runtime::spawn(async move {
        if let Err(e) = server.run().await {
            eprintln!("[TurboGrab Host] WebSocket server terminated: {:?}", e);
        }
    });

    // Handle incoming intercepted downloads from browser extension
    let engine_for_intercept = Arc::clone(&engine);
    tauri::async_runtime::spawn(async move {
        while let Some(payload) = intercept_rx.recv().await {
            let engine = Arc::clone(&engine_for_intercept);
            engine.handle_browser_intercept(payload).await;
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::clone(&engine))
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::get_queue_stats,
            commands::get_all_downloads,
            commands::set_speed_limit,
            commands::sniff_stream,
            commands::open_download_folder,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            engine.set_app_handle(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod dirs {
    use std::path::PathBuf;
    pub fn home_dir() -> Option<PathBuf> {
        #[cfg(windows)]
        {
            std::env::var_os("USERPROFILE").map(PathBuf::from)
        }
        #[cfg(not(windows))]
        {
            std::env::var_os("HOME").map(PathBuf::from)
        }
    }

    pub fn download_dir() -> Option<PathBuf> {
        home_dir().map(|h| h.join("Downloads"))
    }
}
