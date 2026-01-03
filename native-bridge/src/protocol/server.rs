//! WebSocket server for browser communication

use super::{AudioMessageHeader, BrowserMessage, NativeMessage};
use crate::tui::AppEvent;
use crate::AppState;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

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

            // Notify TUI of browser connection
            {
                let app = self.state.lock().await;
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::ConnectionEvent {
                        event_type: crate::tui::ConnectionEventType::BrowserConnected,
                        peer_id: Some(peer.to_string()),
                    });
                    // Mark as connected (browser connection = basic connectivity)
                    let _ = tx.try_send(AppEvent::NetworkState {
                        connected: true,
                        mode: crate::tui::NetworkMode::Disconnected, // No P2P room yet
                        peer_count: 0,
                        latency_ms: 0.0,
                        packet_loss: 0.0,
                    });
                }
            }

            if let Err(e) = self.handle_connection(stream).await {
                error!("Connection error: {}", e);
            }

            info!("Browser disconnected");

            // Notify TUI of browser disconnection
            {
                let app = self.state.lock().await;
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::ConnectionEvent {
                        event_type: crate::tui::ConnectionEventType::BrowserDisconnected,
                        peer_id: None,
                    });
                    let _ = tx.try_send(AppEvent::NetworkState {
                        connected: false,
                        mode: crate::tui::NetworkMode::Disconnected,
                        peer_count: 0,
                        latency_ms: 0.0,
                        packet_loss: 0.0,
                    });
                }
            }
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
        write
            .send(Message::Text(serde_json::to_string(&welcome)?))
            .await?;

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
                    let effects_metering = app.audio_engine.get_effects_metering();

                    // Send to TUI if channel exists
                    if let Some(ref tx) = app.tui_tx {
                        // Audio levels (mono for now - TODO: stereo from audio engine)
                        let _ = tx.try_send(AppEvent::AudioLevels {
                            input_l: audio_levels.input_level,
                            input_r: audio_levels.input_level,
                            output_l: audio_levels.output_level,
                            output_r: audio_levels.output_level,
                        });

                        // Effects metering (dynamics)
                        let _ = tx.try_send(AppEvent::EffectsMetering {
                            noise_gate_open: effects_metering.noise_gate_open,
                            compressor_reduction: effects_metering.compressor_reduction,
                            limiter_reduction: effects_metering.limiter_reduction,
                        });

                        // Remote user levels
                        if !audio_levels.remote_levels.is_empty() {
                            let _ = tx.try_send(AppEvent::RemoteLevels {
                                levels: audio_levels.remote_levels.clone(),
                            });
                        }

                        // Backing track level
                        let _ = tx.try_send(AppEvent::BackingLevel {
                            level: audio_levels.backing_level,
                        });
                    }

                    let msg = NativeMessage::Levels {
                        input_level: audio_levels.input_level,
                        input_peak: audio_levels.input_peak,
                        output_level: audio_levels.output_level,
                        output_peak: audio_levels.output_peak,
                        remote_levels: audio_levels.remote_levels,
                    };

                    msg
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
                let (buffer_used, buffer_capacity) =
                    app.audio_engine.get_browser_stream_occupancy();
                let is_healthy = app.audio_engine.is_browser_stream_healthy();
                let ms_since_last_read = app.audio_engine.ms_since_last_browser_read();

                // Send stream health to TUI
                if let Some(ref tx) = app.tui_tx {
                    let buffer_occupancy = buffer_used as f32 / buffer_capacity as f32;
                    let _ = tx.try_send(AppEvent::StreamHealth {
                        buffer_occupancy,
                        overflow_count,
                        is_healthy,
                    });

                    // Send network stats if we're in a room
                    if let Some(ref network) = app.network {
                        let stats = network.stats();
                        let _ = tx.try_send(AppEvent::NetworkState {
                            connected: true,
                            mode: match stats.mode {
                                crate::network::NetworkMode::P2P => crate::tui::NetworkMode::P2P,
                                crate::network::NetworkMode::Relay => crate::tui::NetworkMode::Relay,
                                crate::network::NetworkMode::Hybrid => crate::tui::NetworkMode::Hybrid,
                                crate::network::NetworkMode::Disconnected => crate::tui::NetworkMode::Disconnected,
                            },
                            peer_count: stats.peer_count,
                            latency_ms: stats.rtt_ms,
                            packet_loss: stats.packet_loss_pct,
                        });
                        let _ = tx.try_send(AppEvent::NetworkStats {
                            jitter_ms: stats.jitter_ms,
                            clock_offset_ms: stats.clock_offset_ms,
                            bytes_sent_per_sec: stats.bytes_sent_per_sec,
                            bytes_recv_per_sec: stats.bytes_recv_per_sec,
                        });
                    }
                }

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
                let (overflow_count, overflow_samples) =
                    app.audio_engine.get_and_reset_overflow_stats();
                let (buffer_used, buffer_capacity) =
                    app.audio_engine.get_browser_stream_occupancy();
                let buffer_pct = (buffer_used as f64 / buffer_capacity as f64 * 100.0) as u32;
                let healthy = app.audio_engine.is_browser_stream_healthy();
                drop(app);

                if overflow_count > 0 {
                    warn!(
                        "[Server] BUFFER OVERFLOW: {} batches, {} samples dropped",
                        overflow_count, overflow_samples
                    );
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

                let mut binary_data =
                    Vec::with_capacity(AudioMessageHeader::SIZE + audio_accumulator.len() * 4);
                binary_data.extend_from_slice(&header.to_bytes());
                for sample in &audio_accumulator {
                    binary_data.extend_from_slice(&sample.to_le_bytes());
                }

                // Don't break on send failure - just log and continue
                // Audio will be lost but connection stays open
                match write.send(Message::Binary(binary_data)).await {
                    Ok(_) => {}
                    Err(e) => {
                        warn!(
                            "Failed to send audio data: {} (samples: {})",
                            e,
                            audio_accumulator.len()
                        );
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
            let msg = tokio::time::timeout(std::time::Duration::from_millis(2), read.next()).await;

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
                            write
                                .send(Message::Text(serde_json::to_string(&error)?))
                                .await?;
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
                Err(_) => {}          // Timeout - continue loop for level updates
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
            BrowserMessage::Hello {
                version,
                room_id,
                user_id,
            } => {
                info!(
                    "Browser hello: v{}, room={:?}, user={:?}",
                    version, room_id, user_id
                );

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

            BrowserMessage::UpdateTrackState {
                state: track_state, ..
            } => {
                info!("UpdateTrackState received: monitoring_enabled={:?}, is_muted={:?}, volume={:?}",
                      track_state.monitoring_enabled, track_state.is_muted, track_state.volume);
                let app = self.state.lock().await;
                app.audio_engine.update_track_state(track_state);
                None
            }

            BrowserMessage::UpdateEffects { effects, .. } => {
                let app = self.state.lock().await;
                app.audio_engine.update_effects(effects.clone());

                // Send EffectToggled events to TUI
                if let Some(ref tx) = app.tui_tx {
                    // Map effect settings to TUI effect names
                    let effect_states = [
                        ("Wah", effects.wah.enabled),
                        ("Overdrive", effects.overdrive.enabled),
                        ("Distortion", effects.distortion.enabled),
                        ("Amp Sim", effects.amp.enabled),
                        ("Cabinet", effects.cabinet.enabled),
                        ("Noise Gate", effects.noise_gate.enabled),
                        ("Compressor", effects.compressor.enabled),
                        ("De-Esser", effects.de_esser.enabled),
                        ("Transient", effects.transient_shaper.enabled),
                        ("Multiband", effects.multiband_compressor.enabled),
                        ("Exciter", effects.exciter.enabled),
                        ("Limiter", effects.limiter.enabled),
                        ("Chorus", effects.chorus.enabled),
                        ("Flanger", effects.flanger.enabled),
                        ("Phaser", effects.phaser.enabled),
                        ("Tremolo", effects.tremolo.enabled),
                        ("Vibrato", effects.vibrato.enabled),
                        ("Auto Pan", effects.auto_pan.enabled),
                        ("Rotary", effects.rotary_speaker.enabled),
                        ("Ring Mod", effects.ring_modulator.enabled),
                        ("Delay", effects.delay.enabled),
                        ("Stereo Delay", effects.stereo_delay.enabled),
                        ("Granular", effects.granular_delay.enabled),
                        ("Pitch Correct", effects.pitch_correction.enabled),
                        ("Harmonizer", effects.harmonizer.enabled),
                        ("Formant", effects.formant_shifter.enabled),
                        ("Freq Shift", effects.frequency_shifter.enabled),
                        ("Vocal Double", effects.vocal_doubler.enabled),
                        ("EQ", effects.eq.enabled),
                        ("Reverb", effects.reverb.enabled),
                        ("Room Sim", effects.room_simulator.enabled),
                        ("Shimmer", effects.shimmer_reverb.enabled),
                        ("Stereo Img", effects.stereo_imager.enabled),
                        ("Multi Filter", effects.multi_filter.enabled),
                        ("Bitcrusher", effects.bitcrusher.enabled),
                    ];

                    for (name, enabled) in effect_states {
                        let _ = tx.try_send(AppEvent::EffectToggled {
                            name: name.to_string(),
                            enabled,
                        });
                    }
                }

                None
            }

            BrowserMessage::SetMonitoring { enabled, volume } => {
                info!(
                    "SetMonitoring received: enabled={}, volume={}",
                    enabled, volume
                );
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

                // Notify TUI of peer join
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::ConnectionEvent {
                        event_type: crate::tui::ConnectionEventType::PeerJoined,
                        peer_id: Some(user_name.clone()),
                    });
                    // Update user count (get from network if available)
                    if let Some(ref network) = app.network {
                        let stats = network.stats();
                        let _ = tx.try_send(AppEvent::RoomContext {
                            room_id: app.connected_room.clone(),
                            user_count: stats.peer_count + 1, // peers + self
                            key: None,
                            scale: None,
                            bpm: None,
                        });
                    }
                }

                None
            }

            BrowserMessage::RemoveRemoteUser { user_id } => {
                info!("RemoveRemoteUser: {}", user_id);
                let app = self.state.lock().await;
                app.audio_engine.remove_remote_user(&user_id);

                // Notify TUI of peer leave
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::ConnectionEvent {
                        event_type: crate::tui::ConnectionEventType::PeerLeft,
                        peer_id: Some(user_id.clone()),
                    });
                    // Update user count
                    if let Some(ref network) = app.network {
                        let stats = network.stats();
                        let _ = tx.try_send(AppEvent::RoomContext {
                            room_id: app.connected_room.clone(),
                            user_count: stats.peer_count + 1,
                            key: None,
                            scale: None,
                            bpm: None,
                        });
                    }
                }

                None
            }

            BrowserMessage::UpdateRemoteUser {
                user_id,
                volume,
                pan,
                muted,
                compensation_delay_ms,
            } => {
                let app = self.state.lock().await;
                app.audio_engine.update_remote_user(
                    &user_id,
                    volume,
                    pan,
                    muted,
                    compensation_delay_ms,
                );
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

            BrowserMessage::PlayBackingTrack {
                sync_timestamp: _,
                offset,
            } => {
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
            BrowserMessage::SetStemState {
                stem,
                enabled,
                volume,
            } => {
                info!(
                    "SetStemState: {} enabled={} volume={:.2}",
                    stem, enabled, volume
                );
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

            BrowserMessage::UpdateMasterEffects {
                eq,
                compressor,
                reverb,
                limiter,
            } => {
                info!("UpdateMasterEffects");
                // Would update master effects chain here
                let _ = (eq, compressor, reverb, limiter);
                None
            }

            // === P2P/Relay Room ===
            BrowserMessage::JoinRoom {
                room_id,
                room_secret,
                user_name,
            } => {
                info!("JoinRoom: {} as {}", room_id, user_name);
                let mut app = self.state.lock().await;

                // Clone the network Arc to avoid holding a reference while mutating app
                let network = match app.network.clone() {
                    Some(n) => n,
                    None => {
                        return Some(NativeMessage::Error {
                            code: "NETWORK_UNAVAILABLE".to_string(),
                            message: "Network manager not initialized".to_string(),
                        });
                    }
                };

                let room_config = crate::network::RoomConfig {
                    room_id: room_id.clone(),
                    room_secret,
                    ..Default::default()
                };

                let user_id = app
                    .user_id
                    .clone()
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                match network
                    .connect(room_config, user_id.clone(), user_name)
                    .await
                {
                    Ok(event_rx) => {
                        // Start AudioNetworkBridge to connect audio engine with network
                        let audio_handle = app.audio_engine.create_bridge_handle();
                        let bridge = crate::network::bridge::create_and_start_bridge(
                            network.clone(),
                            audio_handle,
                            event_rx,
                        );
                        app.audio_bridge = Some(bridge);

                        let mode = network.mode();
                        let is_master = network.is_master();
                        info!("Audio-network bridge started for room {}", room_id);

                        // Notify TUI of room join
                        if let Some(ref tx) = app.tui_tx {
                            let tui_mode = match mode {
                                crate::network::NetworkMode::P2P => crate::tui::NetworkMode::P2P,
                                crate::network::NetworkMode::Relay => crate::tui::NetworkMode::Relay,
                                crate::network::NetworkMode::Hybrid => crate::tui::NetworkMode::Hybrid,
                            };
                            let _ = tx.try_send(AppEvent::ConnectionEvent {
                                event_type: crate::tui::ConnectionEventType::RoomJoined,
                                peer_id: None,
                            });
                            let _ = tx.try_send(AppEvent::NetworkState {
                                connected: true,
                                mode: tui_mode,
                                peer_count: 1, // Just us initially
                                latency_ms: 0.0,
                                packet_loss: 0.0,
                            });
                            let _ = tx.try_send(AppEvent::RoomContext {
                                room_id: Some(room_id.clone()),
                                user_count: 1,
                                key: None,
                                scale: None,
                                bpm: None,
                            });
                        }

                        Some(NativeMessage::RoomJoined {
                            room_id,
                            network_mode: format!("{:?}", mode),
                            is_master,
                        })
                    }
                    Err(e) => Some(NativeMessage::Error {
                        code: "ROOM_JOIN_ERROR".to_string(),
                        message: e.to_string(),
                    }),
                }
            }

            BrowserMessage::LeaveRoom => {
                info!("LeaveRoom");
                let mut app = self.state.lock().await;

                // Stop the audio-network bridge first
                if let Some(ref bridge) = app.audio_bridge {
                    bridge.stop();
                }
                app.audio_bridge = None;

                // Then disconnect from the network
                if let Some(ref network) = app.network {
                    network.disconnect().await;
                }

                // Notify TUI of room leave
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::ConnectionEvent {
                        event_type: crate::tui::ConnectionEventType::RoomLeft,
                        peer_id: None,
                    });
                    // Keep browser connected, just not in a room
                    let _ = tx.try_send(AppEvent::NetworkState {
                        connected: true,
                        mode: crate::tui::NetworkMode::Disconnected,
                        peer_count: 0,
                        latency_ms: 0.0,
                        packet_loss: 0.0,
                    });
                    let _ = tx.try_send(AppEvent::RoomContext {
                        room_id: None,
                        user_count: 0,
                        key: None,
                        scale: None,
                        bpm: None,
                    });
                }

                Some(NativeMessage::RoomLeft)
            }

            BrowserMessage::SetNetworkMode { mode } => {
                info!("SetNetworkMode: {}", mode);
                let app = self.state.lock().await;

                if let Some(ref network) = app.network {
                    let new_mode = match mode.as_str() {
                        "p2p" | "P2P" => crate::network::NetworkMode::P2P,
                        "relay" | "Relay" => crate::network::NetworkMode::Relay,
                        "hybrid" | "Hybrid" => crate::network::NetworkMode::Hybrid,
                        _ => {
                            return Some(NativeMessage::Error {
                                code: "INVALID_MODE".to_string(),
                                message: format!("Unknown network mode: {}", mode),
                            });
                        }
                    };

                    match network.switch_mode(new_mode).await {
                        Ok(_) => Some(NativeMessage::NetworkModeChanged {
                            mode: format!("{:?}", new_mode),
                        }),
                        Err(e) => Some(NativeMessage::Error {
                            code: "MODE_SWITCH_ERROR".to_string(),
                            message: e.to_string(),
                        }),
                    }
                } else {
                    Some(NativeMessage::Error {
                        code: "NETWORK_UNAVAILABLE".to_string(),
                        message: "Network manager not initialized".to_string(),
                    })
                }
            }

            BrowserMessage::SetRoomContext {
                key,
                scale,
                bpm,
                time_sig_num,
                time_sig_denom,
            } => {
                debug!(
                    "Setting room context: key={:?}, scale={:?}, bpm={:?}",
                    key, scale, bpm
                );

                // Update effects chain with room context
                let app = self.state.lock().await;
                app.audio_engine
                    .set_room_context(key.clone(), scale.clone(), bpm, time_sig_num, time_sig_denom);

                // Send room context to TUI
                if let Some(ref tx) = app.tui_tx {
                    let _ = tx.try_send(AppEvent::RoomContext {
                        room_id: app.connected_room.clone(),
                        user_count: app.network.as_ref().map(|n| n.stats().peer_count + 1).unwrap_or(1),
                        key,
                        scale,
                        bpm,
                    });
                }

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
