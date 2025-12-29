//! WebSocket server for browser communication

use super::{BrowserMessage, NativeMessage, AudioMessageHeader};
use crate::AppState;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{info, warn, error};

pub struct BridgeServer {
    state: Arc<Mutex<AppState>>,
}

impl BridgeServer {
    pub fn new(state: Arc<Mutex<AppState>>) -> Self {
        Self { state }
    }

    pub async fn run(&self, addr: &str) -> Result<()> {
        let listener = TcpListener::bind(addr).await?;
        info!("WebSocket server listening on ws://{}", addr);

        while let Ok((stream, peer)) = listener.accept().await {
            info!("Browser connected from {}", peer);
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

async fn handle_connection(stream: TcpStream, state: Arc<Mutex<AppState>>) -> Result<()> {
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
                let app = state_clone.lock().await;
                let audio_levels = app.audio_engine.get_levels();

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
        let mut app = state.lock().await;
        let _ = app.audio_engine.stop();
    }

    Ok(())
}

async fn handle_message(msg: BrowserMessage, state: &Arc<Mutex<AppState>>) -> Option<NativeMessage> {
    match msg {
        BrowserMessage::Hello { version, room_id, user_id } => {
            info!("Browser hello: v{}, room={:?}, user={:?}", version, room_id, user_id);

            // Update state with room/user info
            {
                let mut app = state.lock().await;
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
            let app = state.lock().await;

            let inputs = app.audio_engine.get_input_devices().unwrap_or_default();
            let outputs = app.audio_engine.get_output_devices().unwrap_or_default();

            Some(NativeMessage::Devices { inputs, outputs })
        }

        BrowserMessage::SetInputDevice { device_id } => {
            let mut app = state.lock().await;

            match app.audio_engine.set_input_device(&device_id) {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "DEVICE_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::SetOutputDevice { device_id } => {
            let mut app = state.lock().await;

            match app.audio_engine.set_output_device(&device_id) {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "DEVICE_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::SetChannelConfig { config } => {
            let mut app = state.lock().await;

            match app.audio_engine.set_channel_config(config) {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "CONFIG_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::StartAudio => {
            let mut app = state.lock().await;

            match app.audio_engine.start() {
                Ok(_) => {
                    let latency = app.audio_engine.get_latency_info();
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
            let mut app = state.lock().await;

            let _ = app.audio_engine.stop();

            Some(NativeMessage::AudioStatus {
                is_running: false,
                input_latency_ms: 0.0,
                output_latency_ms: 0.0,
                total_latency_ms: 0.0,
            })
        }

        BrowserMessage::SetBufferSize { size } => {
            let mut app = state.lock().await;

            let buffer_size = match size {
                32 => crate::audio::BufferSize::Samples32,
                64 => crate::audio::BufferSize::Samples64,
                128 => crate::audio::BufferSize::Samples128,
                256 => crate::audio::BufferSize::Samples256,
                512 => crate::audio::BufferSize::Samples512,
                1024 => crate::audio::BufferSize::Samples1024,
                _ => crate::audio::BufferSize::Samples128,
            };

            match app.audio_engine.set_buffer_size(buffer_size) {
                Ok(_) => None,
                Err(e) => Some(NativeMessage::Error {
                    code: "CONFIG_ERROR".to_string(),
                    message: e.to_string(),
                }),
            }
        }

        BrowserMessage::UpdateTrackState { track_id: _, state: track_state } => {
            let app = state.lock().await;
            app.audio_engine.update_track_state(track_state);
            None
        }

        BrowserMessage::UpdateEffects { track_id: _, effects } => {
            let app = state.lock().await;
            app.audio_engine.update_effects(effects);
            None
        }

        BrowserMessage::SetMonitoring { enabled, volume } => {
            let app = state.lock().await;
            app.audio_engine.set_monitoring(enabled);
            app.audio_engine.set_monitoring_volume(volume);
            None
        }

        BrowserMessage::SetMasterVolume { volume } => {
            let mut app = state.lock().await;
            app.mixer.set_master_volume(volume);
            None
        }

        // TODO: Implement remaining message handlers
        _ => {
            warn!("Unhandled message type");
            None
        }
    }
}

async fn handle_audio_data(data: &[u8], _state: &Arc<Mutex<AppState>>) {
    // Parse binary audio data and route to appropriate destination
    // Format: [header][samples as f32 little-endian]

    if let Some(header) = AudioMessageHeader::from_bytes(data) {
        let samples_offset = AudioMessageHeader::SIZE;
        let sample_bytes = &data[samples_offset..];

        // Convert bytes to f32 samples
        let _samples: Vec<f32> = sample_bytes
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
        return "WASAPI".to_string();
    }

    #[cfg(target_os = "macos")]
    {
        return "CoreAudio".to_string();
    }

    #[cfg(target_os = "linux")]
    {
        return "ALSA".to_string();
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "Unknown".to_string()
    }
}
