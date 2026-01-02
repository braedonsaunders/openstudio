//! WebSocket server for browser communication

use super::{BrowserMessage, NativeMessage, AudioMessageHeader};
use crate::AppState;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH, Instant};
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

        // Single-connection model - handle one connection at a time
        // This is appropriate for a desktop audio bridge where only one browser connects
        while let Ok((stream, peer)) = listener.accept().await {
            info!("Browser connected from {}", peer);

            if let Err(e) = self.handle_connection(stream).await {
                error!("Connection error: {}", e);
            }

            info!("Browser disconnected");
        }

        Ok(())
    }

    async fn handle_connection(&self, stream: TcpStream) -> Result<()> {
        let ws_stream = accept_async(stream).await?;
        let (mut write, mut read) = ws_stream.split();

        // Send welcome message
        let welcome = NativeMessage::Welcome {
            version: env!("CARGO_PKG_VERSION").to_string(),
            driver_type: detect_driver_type(),
        };
        write.send(Message::Text(serde_json::to_string(&welcome)?)).await?;

        // Track time for periodic level updates
        let mut last_level_update = Instant::now();
        let level_interval = std::time::Duration::from_millis(50);

        // Track time for health status updates (less frequent than levels)
        let mut last_health_update = Instant::now();
        let health_interval = std::time::Duration::from_millis(500);

        // Accumulate audio samples - allows batching multiple ring buffer reads per loop
        // but we send immediately (no artificial delay) for minimum latency
        let mut audio_accumulator: Vec<f32> = Vec::with_capacity(2048);
        let mut loop_counter: u64 = 0;
        let mut empty_read_counter: u64 = 0;
        let mut last_diagnostic = Instant::now();
        let diagnostic_interval = std::time::Duration::from_secs(2);

        // Handle incoming messages with periodic level updates and audio streaming
        loop {
            // Check if we should send level update
            if last_level_update.elapsed() >= level_interval {
                let levels = {
                    let app = self.state.lock().await;
                    let audio_levels = app.audio_engine.get_levels();

                    NativeMessage::Levels {
                        input_level: audio_levels.input_level,
                        input_peak: audio_levels.input_peak,
                        output_level: audio_levels.output_level,
                        output_peak: audio_levels.output_peak,
                        remote_levels: audio_levels.remote_levels,
                    }
                };

                if let Ok(json) = serde_json::to_string(&levels) {
                    if write.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                last_level_update = Instant::now();
            }

            // Send health status less frequently
            if last_health_update.elapsed() >= health_interval {
                let app = self.state.lock().await;
                let (overflow_count, overflow_samples) = app.audio_engine.get_overflow_stats();
                let (buffer_used, buffer_capacity) = app.audio_engine.get_browser_stream_occupancy();
                let is_healthy = app.audio_engine.is_browser_stream_healthy();
                let ms_since_last_read = app.audio_engine.ms_since_last_browser_read();
                drop(app);

                let health = NativeMessage::StreamHealth {
                    buffer_occupancy: buffer_used as f32 / buffer_capacity as f32,
                    overflow_count,
                    overflow_samples,
                    is_healthy,
                    ms_since_last_read,
                };

                if let Ok(json) = serde_json::to_string(&health) {
                    if write.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                last_health_update = Instant::now();
            }

            // Stream raw audio to browser for WebRTC broadcast
            // Accumulate samples and send in batches to reduce WebSocket overhead
            loop_counter += 1;
            {
                let app = self.state.lock().await;
                let is_running = app.audio_engine.is_running();
                if is_running {
                    // Read available samples into accumulator (up to 2048 at a time for lower latency)
                    let samples = app.audio_engine.get_browser_stream_audio(2048);
                    if !samples.is_empty() {
                        audio_accumulator.extend_from_slice(&samples);
                        empty_read_counter = 0;
                        // Mark successful read for health tracking
                        app.audio_engine.mark_browser_read();
                    } else {
                        empty_read_counter += 1;
                    }
                } else if loop_counter % 1000 == 0 {
                    warn!("[Server] Audio engine not running (loop {})", loop_counter);
                }
            }

            // Periodic diagnostic logging with overflow and health tracking
            if last_diagnostic.elapsed() >= diagnostic_interval {
                let app = self.state.lock().await;
                let (input_cbs, output_cbs) = app.audio_engine.get_callback_counts();
                let (overflow_count, overflow_samples) = app.audio_engine.get_and_reset_overflow_stats();
                let (buffer_used, buffer_capacity) = app.audio_engine.get_browser_stream_occupancy();
                let buffer_pct = (buffer_used as f64 / buffer_capacity as f64 * 100.0) as u32;
                let healthy = app.audio_engine.is_browser_stream_healthy();
                drop(app);

                if overflow_count > 0 {
                    warn!("[Server] BUFFER OVERFLOW: {} batches, {} samples dropped", overflow_count, overflow_samples);
                }

                info!("[Server] Diagnostic: loop={}, empty_reads={}, cbs=({},{}), buffer={}% ({}/{}), healthy={}",
                      loop_counter, empty_read_counter, input_cbs, output_cbs,
                      buffer_pct, buffer_used, buffer_capacity, healthy);
                last_diagnostic = Instant::now();
            }

            // Send accumulated audio immediately for low-latency
            // No artificial delay - send as soon as we have samples
            // The accumulator still helps batch multiple ring buffer reads per loop iteration
            let should_send_audio = !audio_accumulator.is_empty();

            if should_send_audio {
                // Create binary message: [msg_type: u8][sample_count: u32][timestamp: u64][samples: f32...]
                let header = AudioMessageHeader {
                    msg_type: 1, // 1 = local capture to browser
                    sample_count: audio_accumulator.len() as u32,
                    timestamp: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                };

                let mut binary_data = Vec::with_capacity(AudioMessageHeader::SIZE + audio_accumulator.len() * 4);
                binary_data.extend_from_slice(&header.to_bytes());
                for sample in &audio_accumulator {
                    binary_data.extend_from_slice(&sample.to_le_bytes());
                }

                // Don't break on send failure - just log and continue
                // Audio will be lost but connection stays open
                match write.send(Message::Binary(binary_data)).await {
                    Ok(_) => {}
                    Err(e) => {
                        warn!("Failed to send audio data: {} (samples: {})", e, audio_accumulator.len());
                        // Check if this is a fatal error (connection closed)
                        if e.to_string().contains("close") || e.to_string().contains("Connection") {
                            error!("WebSocket connection lost, stopping audio loop");
                            break;
                        }
                    }
                }

                audio_accumulator.clear();
            }

            // Use short timeout to ensure audio is sent frequently
            // Browser's ScriptProcessorNode at 48kHz/256 buffer runs ~187 times/sec
            // We need to send audio at least that fast to avoid buffer starvation
            let msg = tokio::time::timeout(
                std::time::Duration::from_millis(2),
                read.next()
            ).await;

            match msg {
                Ok(Some(Ok(Message::Text(text)))) => {
                    match serde_json::from_str::<BrowserMessage>(&text) {
                        Ok(browser_msg) => {
                            if let Some(response) = self.handle_message(browser_msg).await {
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
                Ok(Some(Ok(Message::Binary(data)))) => {
                    self.handle_audio_data(&data).await;
                }
                Ok(Some(Ok(Message::Close(_)))) => {
                    break;
                }
                Ok(Some(Err(e))) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                Ok(None) => break,
                Ok(Some(Ok(_))) => {} // Ping/Pong handled automatically
                Err(_) => {} // Timeout - continue loop for level updates
            }
        }

        // Cleanup
        {
            let mut app = self.state.lock().await;
            let _ = app.audio_engine.stop();
        }

        Ok(())
    }

    async fn handle_message(&self, msg: BrowserMessage) -> Option<NativeMessage> {
        match msg {
            BrowserMessage::Hello { version, room_id, user_id } => {
                info!("Browser hello: v{}, room={:?}, user={:?}", version, room_id, user_id);

                {
                    let mut app = self.state.lock().await;
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
                let app = self.state.lock().await;

                let inputs = app.audio_engine.get_input_devices().unwrap_or_default();
                let outputs = app.audio_engine.get_output_devices().unwrap_or_default();

                Some(NativeMessage::Devices { inputs, outputs })
            }

            BrowserMessage::SetInputDevice { device_id } => {
                let mut app = self.state.lock().await;

                match app.audio_engine.set_input_device(&device_id) {
                    Ok(_) => None,
                    Err(e) => Some(NativeMessage::Error {
                        code: "DEVICE_ERROR".to_string(),
                        message: e.to_string(),
                    }),
                }
            }

            BrowserMessage::SetOutputDevice { device_id } => {
                let mut app = self.state.lock().await;

                match app.audio_engine.set_output_device(&device_id) {
                    Ok(_) => None,
                    Err(e) => Some(NativeMessage::Error {
                        code: "DEVICE_ERROR".to_string(),
                        message: e.to_string(),
                    }),
                }
            }

            BrowserMessage::SetChannelConfig { config } => {
                info!("SetChannelConfig received: {:?}", config);
                let mut app = self.state.lock().await;

                match app.audio_engine.set_channel_config(config) {
                    Ok(_) => {
                        info!("Channel config applied successfully");
                        None
                    }
                    Err(e) => Some(NativeMessage::Error {
                        code: "CONFIG_ERROR".to_string(),
                        message: e.to_string(),
                    }),
                }
            }

            BrowserMessage::StartAudio => {
                let mut app = self.state.lock().await;

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
                let mut app = self.state.lock().await;

                let _ = app.audio_engine.stop();

                Some(NativeMessage::AudioStatus {
                    is_running: false,
                    input_latency_ms: 0.0,
                    output_latency_ms: 0.0,
                    total_latency_ms: 0.0,
                })
            }

            BrowserMessage::SetBufferSize { size } => {
                info!("SetBufferSize received: {}", size);
                let mut app = self.state.lock().await;

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

            BrowserMessage::SetSampleRate { rate } => {
                info!("SetSampleRate received: {}", rate);
                let mut app = self.state.lock().await;

                let sample_rate = match rate {
                    44100 => crate::audio::SampleRate::Hz44100,
                    48000 => crate::audio::SampleRate::Hz48000,
                    _ => crate::audio::SampleRate::Hz48000,
                };

                match app.audio_engine.set_sample_rate(sample_rate) {
                    Ok(_) => None,
                    Err(e) => Some(NativeMessage::Error {
                        code: "CONFIG_ERROR".to_string(),
                        message: e.to_string(),
                    }),
                }
            }

            BrowserMessage::UpdateTrackState { state: track_state, .. } => {
                let app = self.state.lock().await;
                app.audio_engine.update_track_state(track_state);
                None
            }

            BrowserMessage::UpdateEffects { effects, .. } => {
                let app = self.state.lock().await;
                app.audio_engine.update_effects(effects);
                None
            }

            BrowserMessage::SetMonitoring { enabled, volume } => {
                let app = self.state.lock().await;
                app.audio_engine.set_monitoring(enabled);
                app.audio_engine.set_monitoring_volume(volume);
                None
            }

            BrowserMessage::SetMasterVolume { volume } => {
                let app = self.state.lock().await;
                app.audio_engine.set_master_volume(volume);
                None
            }

            // === Remote Users ===
            BrowserMessage::AddRemoteUser { user_id, user_name } => {
                info!("AddRemoteUser: {} ({})", user_name, user_id);
                let app = self.state.lock().await;
                app.audio_engine.add_remote_user(&user_id, &user_name);
                None
            }

            BrowserMessage::RemoveRemoteUser { user_id } => {
                info!("RemoveRemoteUser: {}", user_id);
                let app = self.state.lock().await;
                app.audio_engine.remove_remote_user(&user_id);
                None
            }

            BrowserMessage::UpdateRemoteUser { user_id, volume, muted, compensation_delay_ms } => {
                let app = self.state.lock().await;
                app.audio_engine.update_remote_user(&user_id, volume, muted, compensation_delay_ms);
                None
            }

            // === Backing Track ===
            BrowserMessage::LoadBackingTrack { url, duration } => {
                info!("LoadBackingTrack: {} ({:.1}s)", url, duration);
                // Note: Actual audio fetching would be done here
                // For now, acknowledge the load request
                Some(NativeMessage::BackingTrackLoaded {
                    duration,
                    waveform: vec![], // Would compute waveform from decoded audio
                })
            }

            BrowserMessage::PlayBackingTrack { sync_timestamp: _, offset } => {
                info!("PlayBackingTrack at offset: {:.2}s", offset);
                let app = self.state.lock().await;
                app.audio_engine.set_backing_track_state(true, offset);
                None
            }

            BrowserMessage::StopBackingTrack => {
                info!("StopBackingTrack");
                let app = self.state.lock().await;
                app.audio_engine.set_backing_track_state(false, 0.0);
                None
            }

            BrowserMessage::SeekBackingTrack { time } => {
                let app = self.state.lock().await;
                app.audio_engine.set_backing_track_state(true, time);
                None
            }

            BrowserMessage::SetBackingTrackVolume { volume } => {
                let app = self.state.lock().await;
                app.audio_engine.set_backing_track_volume(volume);
                None
            }

            // === Stems ===
            BrowserMessage::SetStemState { stem, enabled, volume } => {
                info!("SetStemState: {} enabled={} volume={:.2}", stem, enabled, volume);
                let mut app = self.state.lock().await;
                app.mixer.set_stem_state(&stem, enabled, volume);
                None
            }

            // === Master Effects ===
            BrowserMessage::SetMasterEffectsEnabled { enabled } => {
                let mut app = self.state.lock().await;
                app.mixer.set_master_effects_enabled(enabled);
                None
            }

            BrowserMessage::UpdateMasterEffects { eq, compressor, reverb, limiter } => {
                info!("UpdateMasterEffects");
                // Would update master effects chain here
                let _ = (eq, compressor, reverb, limiter);
                None
            }

            other => {
                warn!("Unhandled message type: {:?}", other);
                None
            }
        }
    }

    /// Handle binary audio data from browser
    /// Format for msg_type 0 (remote audio):
    ///   [header: 13 bytes][user_id_len: u8][user_id: utf8][samples: f32 LE...]
    /// Format for msg_type 1 (backing track):
    ///   [header: 13 bytes][samples: f32 LE...]
    async fn handle_audio_data(&self, data: &[u8]) {
        if let Some(header) = AudioMessageHeader::from_bytes(data) {
            let samples_offset = AudioMessageHeader::SIZE;

            if header.msg_type == 0 {
                // Remote user audio - extract user_id and route to audio engine
                if data.len() <= samples_offset {
                    return;
                }

                let user_id_len = data[samples_offset] as usize;
                if user_id_len == 0 || data.len() <= samples_offset + 1 + user_id_len {
                    return;
                }

                let user_id_start = samples_offset + 1;
                let user_id_end = user_id_start + user_id_len;

                if let Ok(user_id) = std::str::from_utf8(&data[user_id_start..user_id_end]) {
                    let sample_bytes = &data[user_id_end..];
                    let samples: Vec<f32> = sample_bytes
                        .chunks_exact(4)
                        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                        .collect();

                    if !samples.is_empty() {
                        let app = self.state.lock().await;
                        app.audio_engine.push_remote_audio(user_id, &samples);
                    }
                }
            } else if header.msg_type == 1 {
                // Backing track audio - route to backing track buffer
                let sample_bytes = &data[samples_offset..];
                let samples: Vec<f32> = sample_bytes
                    .chunks_exact(4)
                    .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                    .collect();

                if !samples.is_empty() {
                    let app = self.state.lock().await;
                    app.audio_engine.push_backing_audio(&samples);
                }
            }
        }
    }
}

fn detect_driver_type() -> String {
    #[cfg(target_os = "windows")]
    {
        // Check for ASIO if the feature is enabled
        #[cfg(feature = "asio")]
        {
            if cpal::host_from_id(cpal::HostId::Asio).is_ok() {
                return "ASIO".to_string();
            }
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
