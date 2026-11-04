use crate::engine::types::InterceptPayload;
use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::io::{Read, Write};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

pub const DEFAULT_WS_PORT: u16 = 48123;

pub struct LocalServer {
    port: u16,
    intercept_tx: mpsc::Sender<InterceptPayload>,
}

impl LocalServer {
    pub fn new(port: u16, intercept_tx: mpsc::Sender<InterceptPayload>) -> Self {
        Self { port, intercept_tx }
    }

    /// Run the local loopback WebSocket server at 127.0.0.1:48123
    pub async fn run(self: Arc<Self>) -> Result<()> {
        let addr: SocketAddr = format!("127.0.0.1:{}", self.port)
            .parse()
            .context("Invalid loopback address")?;

        let listener = TcpListener::bind(&addr)
            .await
            .with_context(|| format!("Failed to bind WebSocket server on {}", addr))?;

        println!("[TurboGrab Engine] WebSocket Host listening on ws://{}", addr);

        loop {
            if let Ok((stream, peer_addr)) = listener.accept().await {
                let intercept_tx = self.intercept_tx.clone();
                tokio::spawn(async move {
                    if let Ok(ws_stream) = accept_async(stream).await {
                        println!("[TurboGrab Engine] Extension connected from {}", peer_addr);
                        let (mut write, mut read) = ws_stream.split();

                        // Send welcome
                        let welcome = serde_json::json!({
                            "type": "WELCOME",
                            "engine": "TurboGrab Core v1.0",
                            "speed_mode": "Zero-Copy Work-Stealing"
                        });
                        let _ = write.send(Message::Text(welcome.to_string())).await;

                        while let Some(msg_result) = read.next().await {
                            if let Ok(msg) = msg_result {
                                match msg {
                                    Message::Text(text) => {
                                        if let Ok(val) = serde_json::from_str::<Value>(&text) {
                                            let cmd = val.get("command").and_then(|v| v.as_str()).unwrap_or("");
                                            if cmd == "intercept_download" || cmd == "start_download" || cmd == "start_stream" {
                                                if let Some(payload_val) = val.get("payload") {
                                                    if let Ok(mut payload) = serde_json::from_value::<InterceptPayload>(payload_val.clone()) {
                                                        if cmd == "start_stream" {
                                                            payload.is_stream = Some(true);
                                                        }
                                                        let _ = intercept_tx.send(payload).await;

                                                        let ack = serde_json::json!({
                                                            "status": "accepted",
                                                            "action": cmd
                                                        });
                                                        let _ = write.send(Message::Text(ack.to_string())).await;
                                                    }
                                                }
                                            } else if val.get("type").and_then(|v| v.as_str()) == Some("PING") {
                                                let pong = serde_json::json!({ "type": "PONG" });
                                                let _ = write.send(Message::Text(pong.to_string())).await;
                                            }
                                        }
                                    }
                                    Message::Ping(p) => {
                                        let _ = write.send(Message::Pong(p)).await;
                                    }
                                    Message::Close(_) => break,
                                    _ => {}
                                }
                            } else {
                                break;
                            }
                        }
                    }
                });
            }
        }
    }

    /// Stdio binary-length-framed Native Messaging Host mode
    pub fn run_native_messaging_host() -> Result<()> {
        let mut stdin = std::io::stdin().lock();
        let mut stdout = std::io::stdout().lock();

        loop {
            let mut length_bytes = [0u8; 4];
            if stdin.read_exact(&mut length_bytes).is_err() {
                break;
            }

            let length = u32::from_ne_bytes(length_bytes) as usize;
            if length == 0 || length > 10 * 1024 * 1024 {
                break;
            }

            let mut buffer = vec![0u8; length];
            if stdin.read_exact(&mut buffer).is_err() {
                break;
            }

            if let Ok(msg) = serde_json::from_slice::<Value>(&buffer) {
                let response = serde_json::json!({
                    "status": "received",
                    "echo": msg,
                    "engine": "TurboGrab Native Host"
                });

                let resp_str = serde_json::to_string(&response)?;
                let resp_bytes = resp_str.as_bytes();
                let resp_len = (resp_bytes.len() as u32).to_ne_bytes();

                stdout.write_all(&resp_len)?;
                stdout.write_all(resp_bytes)?;
                stdout.flush()?;
            }
        }

        Ok(())
    }
}
