//! WebSocket server for browser communication

use super::{BrowserMessage, NativeMessage};
use crate::AppState;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{info, warn, error};

pub struct BridgeServer {
    state: Arc<RwLock<AppState>>,
}

impl BridgeServer {
    pub fn new(state: Arc<RwLock<AppState>>) -> Self {
        Self { state }
    }

    pub async fn run(&self, addr: &str) -> Result<()> {
        let listener = TcpListener::bind(addr).await?;
        info!("🌐 WebSocket server listening on ws://{}", addr);

        while let Ok((stream, peer)) = listener.accept().await {
            info!("📱 Browser connected from {}", peer);
            let state = self.state.clone();

            tokio::spawn(async move {
                if let Err(e) = handle_connection(stream, state).await {
                    error!("Connection error: {}", e);
                }
            });
        }

        Ok(())
    }
}

async fn handle_connection(stream: TcpStream, state: Arc<RwLock<AppState>>) -> Result<()> {
    let ws_stream = accept_async(stream).await?;
    let (mut write, mut read) = ws_stream.split();

    // Send welcome message
    let welcome = NativeMessage::Welcome {
        version: env!("CARGO_PKG_VERSION").to_string(),
        driver_type: detect_driver_type(),
    };
    write.send(Message::Text(serde_json::to_string(&welcome)?)).await?;

    // Start level metering task
    let state_clone = state.clone();
    let (level_tx, mut level_rx) = tokio::sync::mpsc::channel::<NativeMessage>(32);

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

            let levels = {
                let app = state_clone.read().await;
                let engine = app.audio_engine.read().await;
                let audio_levels = engine.get_levels().await;

                NativeMessage::Levels {
                    input_level: audio_levels.input_level,
                    input_peak: audio_levels.input_peak,
                    output_level: audio_levels.output_level,
                    output_peak: audio_levels.output_peak,
                    remote_levels: vec![], // TODO: Collect from mixer
                }
            };

            if level_tx.send(levels).await.is_err() {
                break; // Channel closed, connection dropped
            }
        }
    });

    // Handle incoming messages
    loop {
        tokio::select! {
            // Level updates to send
            Some(msg) = level_rx.recv() => {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if write.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }

            // Incoming messages from browser
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<BrowserMessage>(&text) {
                            Ok(browser_msg) => {
                                if let Some(response) = handle_message(browser_msg, &state).await {
                                    let json = serde_json::to_string(&response)?;
                                    write.send(Message::Text(json)).await?;
                                }
                            }
                            Err(e) => {
                                warn!("Failed to parse message: {}", e);
                                let error = NativeMessage::Error {
                                    code: "PARSE_ERROR".to_string(),
                                    message: e.to_string(),
                                };
                                write.send(Message::Text(serde_json::to_string(&error)?)).await?;
                            }
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        // Handle binary audio data
                        handle_audio_data(&data, &state).await;
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("Browser disconnected");
                        break;
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }
        }
    }

    // Cleanup
    {
        let app = state.read().await;
        let mut engine = app.audio_engine.write().await;
        let _ = engine.stop().await;
    }

    Ok(())
}

async fn handle_message(msg: BrowserMessage, state: &Arc<RwLock<AppState>>) -> Option<NativeMessage> {
    match msg {
        BrowserMessage::Hello { version, room_id, user_id } => {
            info!("Browser hello: v{}, room={:?}, user={:?}", version, room_id, user_id);

            // Update state with room/user info
            {
                let mut app = state.write().await;
                app.connected_room = room_id;
                app.user_id = user_id;
            }

            None // Already sent Welcome
        }

        BrowserMessage::Ping { timestamp } => {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;

            Some(NativeMessage::Pong {
                timestamp,
                native_time: now,
            })
        }

        BrowserMessage::GetDevices => {
            let app = state.read().await;
            let engine = app.audio_engine.read().await;

            let inputs = engine.get_input_devices().unwrap_or_default();
            let outputs = engine.get_output_devices().unwrap_or_default();

            Some(NativeMessage::Devices { inputs, outputs })
        }

        BrowserMessage::SetInputDevice { device_id } => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            match engine.set_input_device(&device_id).await {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "DEVICE_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::SetOutputDevice { device_id } => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            match engine.set_output_device(&device_id).await {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "DEVICE_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::SetChannelConfig { config } => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            match engine.set_channel_config(config).await {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "CONFIG_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::StartAudio => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            match engine.start().await {
                Ok(_) => {
                    let latency = engine.get_latency_info();
                    Some(NativeMessage::AudioStatus {
                        is_running: true,
                        input_latency_ms: latency.input_latency_ms,
                        output_latency_ms: latency.output_latency_ms,
                        total_latency_ms: latency.total_latency_ms,
                    })
                }
                Err(e) => Some(NativeMessage::Error {
                    code: "AUDIO_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::StopAudio => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            let _ = engine.stop().await;

            Some(NativeMessage::AudioStatus {
                is_running: false,
                input_latency_ms: 0.0,
                output_latency_ms: 0.0,
                total_latency_ms: 0.0,
            })
        }

        BrowserMessage::SetBufferSize { size } => {
            let app = state.read().await;
            let mut engine = app.audio_engine.write().await;

            let buffer_size = match size {
                32 => crate::audio::BufferSize::Samples32,
                64 => crate::audio::BufferSize::Samples64,
                128 => crate::audio::BufferSize::Samples128,
                256 => crate::audio::BufferSize::Samples256,
                512 => crate::audio::BufferSize::Samples512,
                1024 => crate::audio::BufferSize::Samples1024,
                _ => crate::audio::BufferSize::Samples128,
            };

            match engine.set_buffer_size(buffer_size).await {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "CONFIG_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::UpdateTrackState { track_id, state: track_state } => {
            let app = state.read().await;
            let engine = app.audio_engine.read().await;
            engine.update_track_state(track_state).await;
            None
        }

        BrowserMessage::UpdateEffects { track_id, effects } => {
            let app = state.read().await;
            let engine = app.audio_engine.read().await;
            engine.update_effects(effects).await;
            None
        }

        BrowserMessage::SetMonitoring { enabled, volume } => {
            let app = state.read().await;
            let engine = app.audio_engine.read().await;
            engine.set_monitoring(enabled);
            engine.set_monitoring_volume(volume);
            None
        }

        BrowserMessage::SetMasterVolume { volume } => {
            let app = state.read().await;
            let mut mixer = app.mixer.write().await;
            mixer.set_master_volume(volume);
            None
        }

        // TODO: Implement remaining message handlers
        _ => {
            warn!("Unhandled message type");
            None
        }
    }
}

async fn handle_audio_data(data: &[u8], state: &Arc<RwLock<AppState>>) {
    // Parse binary audio data and route to appropriate destination
    // Format: [header][samples as f32 little-endian]
    use super::AudioMessageHeader;

    if let Some(header) = AudioMessageHeader::from_bytes(data) {
        let samples_offset = AudioMessageHeader::SIZE;
        let sample_bytes = &data[samples_offset..];

        // Convert bytes to f32 samples
        let samples: Vec<f32> = sample_bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect();

        // Route to mixer based on message type
        // 0 = from browser (remote user audio to play)
        // 1 = request for local capture (not used in this direction)
        if header.msg_type == 0 {
            // TODO: Route to mixer for playback
        }
    }
}

fn detect_driver_type() -> String {
    #[cfg(target_os = "windows")]
    {
        // Check if ASIO is available
        if cpal::host_from_id(cpal::HostId::Asio).is_ok() {
            return "ASIO".to_string();
        }
        "WASAPI".to_string()
    }

    #[cfg(target_os = "macos")]
    {
        "CoreAudio".to_string()
    }

    #[cfg(target_os = "linux")]
    {
        "ALSA".to_string()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "Unknown".to_string()
    }
}
