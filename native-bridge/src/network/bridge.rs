//! Audio-Network Bridge
//!
//! Connects the NetworkManager to the AudioEngine, handling:
//! - Incoming audio from network → AudioEngine remote user buffers
//! - Outgoing audio from AudioEngine → Network transmission
//! - Peer lifecycle (add/remove remote users)
//! - Control message forwarding (track state, effects, etc.)
//! - Transport/metronome state synchronization

use super::{NetworkEvent, NetworkManager, NetworkMode};
use crate::audio::AudioBridgeHandle;
use crate::network::codec::{OpusCodec, OpusConfig};
use crate::network::osp::{OspMessageType, TrackStateMessage, TransportAction};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

/// Transport events for metronome/playback synchronization
#[derive(Debug, Clone)]
pub enum TransportEvent {
    /// Clock sync received - beat position, tempo, time signature
    ClockSync {
        beat_position: f64,
        bpm: f32,
        time_sig: (u8, u8),
    },
    /// Transport state changed (play/stop/pause)
    TransportStateChanged {
        action: TransportAction,
        position: f64,
    },
    /// Tempo changed
    TempoChanged { bpm: f32 },
}

/// Audio-Network Bridge configuration
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// Sample rate (must match audio engine)
    pub sample_rate: u32,
    /// Frame size for network transmission (samples per channel)
    pub frame_size: usize,
    /// Number of channels
    pub channels: u8,
    /// How often to send audio (in milliseconds)
    pub send_interval_ms: u64,
    /// Track ID for local audio
    pub local_track_id: u8,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            frame_size: 480, // 10ms at 48kHz
            channels: 2,
            send_interval_ms: 10, // 10ms = 100 packets/sec
            local_track_id: 0,
        }
    }
}

/// Bridge between audio engine and network manager
pub struct AudioNetworkBridge {
    config: BridgeConfig,
    network: Arc<NetworkManager>,
    audio: AudioBridgeHandle,
    running: Arc<std::sync::atomic::AtomicBool>,
    /// Transport event sender for metronome/playback sync
    transport_tx: RwLock<Option<broadcast::Sender<TransportEvent>>>,
    /// Opus codec for encoding local audio before P2P transmission.
    /// The bridge encodes once and sends the encoded data to P2P peers,
    /// avoiding redundant encoding in the P2P layer.
    codec: Arc<OpusCodec>,
}

impl AudioNetworkBridge {
    pub fn new(
        config: BridgeConfig,
        network: Arc<NetworkManager>,
        audio: AudioBridgeHandle,
    ) -> super::Result<Self> {
        let codec = Arc::new(OpusCodec::new(OpusConfig {
            sample_rate: config.sample_rate,
            channels: config.channels,
            frame_size: config.frame_size,
            ..OpusConfig::low_latency()
        })?);

        Ok(Self {
            config,
            network,
            audio,
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            transport_tx: RwLock::new(None),
            codec,
        })
    }

    /// Subscribe to transport events (clock sync, tempo changes, etc.)
    pub fn subscribe_transport(&self) -> broadcast::Receiver<TransportEvent> {
        let mut tx_guard = self.transport_tx.write();
        if tx_guard.is_none() {
            let (tx, _) = broadcast::channel(100);
            *tx_guard = Some(tx);
        }
        if let Some(tx) = tx_guard.as_ref() {
            tx.subscribe()
        } else {
            let (tx, rx) = broadcast::channel(100);
            *tx_guard = Some(tx);
            rx
        }
    }

    /// Get a clone of the transport sender for internal use
    fn get_transport_tx(&self) -> Option<broadcast::Sender<TransportEvent>> {
        self.transport_tx.read().clone()
    }

    /// Start the bridge
    ///
    /// Spawns background threads for:
    /// - Processing incoming network events (audio, peers, control)
    /// - Sending outgoing audio to the network
    ///
    /// Uses AudioBridgeHandle which is thread-safe (Send+Sync).
    pub fn start(&self, event_rx: broadcast::Receiver<NetworkEvent>) {
        self.running
            .store(true, std::sync::atomic::Ordering::SeqCst);
        info!("Starting audio-network bridge");

        // Initialize transport channel if not already done
        {
            let mut tx_guard = self.transport_tx.write();
            if tx_guard.is_none() {
                let (tx, _) = broadcast::channel(100);
                *tx_guard = Some(tx);
            }
        }

        // Spawn incoming event processor on dedicated thread
        // AudioBridgeHandle is Send+Sync so it can be safely moved to another thread
        let audio = self.audio.clone();
        let running = self.running.clone();
        let transport_tx = self.get_transport_tx();
        if let Err(err) = std::thread::Builder::new()
            .name("audio-bridge-events".to_string())
            .spawn(move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build();

                match runtime {
                    Ok(rt) => {
                        rt.block_on(Self::event_loop(audio, event_rx, running, transport_tx));
                    }
                    Err(build_err) => {
                        error!("Failed to create event loop runtime: {}", build_err);
                    }
                }
            })
        {
            error!("Failed to spawn event processor thread: {}", err);
        }

        // Spawn outgoing audio sender on dedicated thread
        let audio = self.audio.clone();
        let network = self.network.clone();
        let codec = self.codec.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        if let Err(err) = std::thread::Builder::new()
            .name("audio-bridge-sender".to_string())
            .spawn(move || {
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build();

                match runtime {
                    Ok(rt) => {
                        rt.block_on(Self::audio_send_loop(
                            audio, network, codec, config, running,
                        ));
                    }
                    Err(build_err) => {
                        error!("Failed to create audio sender runtime: {}", build_err);
                    }
                }
            })
        {
            error!("Failed to spawn audio sender thread: {}", err);
        }

        info!("Audio-network bridge started");
    }

    /// Event processing loop
    async fn event_loop(
        audio: AudioBridgeHandle,
        mut event_rx: broadcast::Receiver<NetworkEvent>,
        running: Arc<std::sync::atomic::AtomicBool>,
        transport_tx: Option<broadcast::Sender<TransportEvent>>,
    ) {
        while running.load(std::sync::atomic::Ordering::SeqCst) {
            match event_rx.recv().await {
                Ok(event) => {
                    Self::handle_network_event(&audio, event, &transport_tx).await;
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!("Dropped {} network events (receiver lagging)", n);
                }
                Err(broadcast::error::RecvError::Closed) => {
                    info!("Network event channel closed");
                    break;
                }
            }
        }
    }

    /// Stop the bridge
    pub fn stop(&self) {
        self.running
            .store(false, std::sync::atomic::Ordering::SeqCst);
        info!("Audio-network bridge stopped");
    }

    /// Handle incoming network events
    async fn handle_network_event(
        audio: &AudioBridgeHandle,
        event: NetworkEvent,
        transport_tx: &Option<broadcast::Sender<TransportEvent>>,
    ) {
        match event {
            NetworkEvent::AudioReceived {
                user_id,
                track_id,
                samples,
            } => {
                debug!(
                    "Routing {} audio samples from user {} track {} to audio engine",
                    samples.len(),
                    user_id,
                    track_id,
                );
                audio.push_remote_track_audio(&user_id, track_id, &samples);
            }

            NetworkEvent::PeerConnected {
                user_id,
                user_name,
                has_native_bridge: _,
            } => {
                info!("Peer connected: {} ({})", user_name, user_id);
                audio.add_remote_user(&user_id, &user_name);
            }

            NetworkEvent::PeerDisconnected { user_id, reason } => {
                info!("Peer disconnected: {} ({})", user_id, reason);
                audio.remove_remote_user(&user_id);
            }

            NetworkEvent::ControlMessage {
                from_user_id,
                message,
                payload,
            } => {
                Self::handle_control_message(audio, &from_user_id, message, &payload, transport_tx)
                    .await;
            }

            NetworkEvent::StateChanged { mode } => {
                info!("Network mode changed to: {:?}", mode);
            }

            NetworkEvent::ModeSwitched { from, to, reason } => {
                info!(
                    "Network mode switched from {:?} to {:?}: {}",
                    from, to, reason
                );
            }

            NetworkEvent::ClockSync {
                beat_position,
                bpm,
                time_sig,
            } => {
                debug!(
                    "Clock sync: beat={:.2}, bpm={:.1}, time_sig={}/{}",
                    beat_position, bpm, time_sig.0, time_sig.1
                );
                // Forward to transport/metronome via transport channel
                if let Some(tx) = transport_tx {
                    let _ = tx.send(TransportEvent::ClockSync {
                        beat_position,
                        bpm,
                        time_sig,
                    });
                }
            }

            NetworkEvent::RoomState { state } => {
                info!("Received room state with {} users", state.users.len());
                // Add all existing users
                for user in state.users {
                    if !user.user_id.is_empty() {
                        audio.add_remote_user(&user.user_id, &user.user_name);
                    }
                }
            }

            NetworkEvent::StatsUpdate { stats } => {
                debug!(
                    "Network stats: rtt={:.1}ms, jitter={:.1}ms, loss={:.1}%",
                    stats.rtt_ms, stats.jitter_ms, stats.packet_loss_pct
                );
            }

            NetworkEvent::Error { error } => {
                error!("Network error: {}", error);
            }
        }
    }

    /// Handle control messages from peers
    async fn handle_control_message(
        audio: &AudioBridgeHandle,
        from_user_id: &str,
        message_type: OspMessageType,
        payload: &[u8],
        transport_tx: &Option<broadcast::Sender<TransportEvent>>,
    ) {
        match message_type {
            OspMessageType::TrackState => {
                if let Ok(msg) = bincode::deserialize::<TrackStateMessage>(payload) {
                    let volume = msg.volume.unwrap_or(1.0);
                    let pan = msg.pan.unwrap_or(0.0);
                    let muted = msg.is_muted.unwrap_or(false);
                    let solo = msg.is_solo.unwrap_or(false);
                    audio.update_remote_track(
                        from_user_id,
                        msg.track_id,
                        volume,
                        pan,
                        muted,
                        solo,
                        0.0,
                    );
                }
            }

            OspMessageType::EffectParam => {
                debug!("Received effect param from {}: {:?}", from_user_id, payload);
            }

            OspMessageType::Transport => {
                // Parse transport message and forward to transport system
                if let Ok(msg) =
                    bincode::deserialize::<crate::network::osp::TransportMessage>(payload)
                {
                    debug!(
                        "Received transport command from {}: {:?}",
                        from_user_id, msg.action
                    );
                    if let Some(tx) = transport_tx {
                        let _ = tx.send(TransportEvent::TransportStateChanged {
                            action: msg.action,
                            position: msg.position.unwrap_or(0.0),
                        });
                    }
                }
            }

            OspMessageType::TempoChange => {
                // Parse tempo change and forward to metronome
                if let Ok(msg) =
                    bincode::deserialize::<crate::network::osp::TempoChangeMessage>(payload)
                {
                    debug!(
                        "Received tempo change from {}: {} bpm",
                        from_user_id, msg.bpm
                    );
                    if let Some(tx) = transport_tx {
                        let _ = tx.send(TransportEvent::TempoChanged { bpm: msg.bpm });
                    }
                }
            }

            _ => {
                debug!(
                    "Unhandled control message type {:?} from {}",
                    message_type, from_user_id
                );
            }
        }
    }

    /// Audio send loop - gets audio from engine and sends to network.
    ///
    /// Handles dual-path operation:
    /// 1. Opus-encodes audio once at the bridge level
    /// 2. Sends pre-encoded data to P2P peers via NetworkManager (unreliable UDP)
    /// 3. Sends raw PCM to relay when in Relay or Hybrid mode
    ///
    /// This avoids redundant Opus encoding: the bridge encodes once, and P2P
    /// peers receive the encoded data directly without re-encoding.
    async fn audio_send_loop(
        audio: AudioBridgeHandle,
        network: Arc<NetworkManager>,
        codec: Arc<OpusCodec>,
        config: BridgeConfig,
        running: Arc<std::sync::atomic::AtomicBool>,
    ) {
        let mut interval = tokio::time::interval(Duration::from_millis(config.send_interval_ms));
        let samples_per_frame = config.frame_size * config.channels as usize;
        let mut frame_buffers: HashMap<String, Vec<f32>> = HashMap::new();

        while running.load(std::sync::atomic::Ordering::SeqCst) {
            interval.tick().await;

            // Skip if not connected
            if network.mode() == NetworkMode::Disconnected {
                continue;
            }

            let local_tracks = audio.get_local_track_descriptors();

            if local_tracks.is_empty() {
                let samples = audio.get_browser_stream_audio(samples_per_frame);
                if samples.is_empty() {
                    continue;
                }

                let frame_buffer = frame_buffers
                    .entry("__legacy__".to_string())
                    .or_insert_with(|| Vec::with_capacity(samples_per_frame));
                frame_buffer.extend_from_slice(&samples);

                while frame_buffer.len() >= samples_per_frame {
                    let frame: Vec<f32> = frame_buffer.drain(..samples_per_frame).collect();
                    let sample_count = (frame.len() / config.channels as usize) as u16;

                    match codec.encoder.encode(&frame) {
                        Ok(opus_data) => {
                            network.send_p2p_encoded_audio(
                                config.local_track_id,
                                opus_data,
                                config.channels,
                                sample_count,
                            );
                        }
                        Err(e) => {
                            debug!("Opus encode failed in bridge send loop: {}", e);
                        }
                    }

                    let mode = network.mode();
                    if mode == NetworkMode::Relay || mode == NetworkMode::Hybrid {
                        network.send_relay_audio(config.local_track_id, frame);
                    }
                }

                continue;
            }

            for local_track in local_tracks {
                let samples = audio.get_local_track_network_audio(
                    &local_track.browser_track_id,
                    samples_per_frame,
                );

                if samples.is_empty() {
                    continue;
                }

                let frame_buffer = frame_buffers
                    .entry(local_track.browser_track_id.clone())
                    .or_insert_with(|| Vec::with_capacity(samples_per_frame));
                frame_buffer.extend_from_slice(&samples);

                while frame_buffer.len() >= samples_per_frame {
                    let frame: Vec<f32> = frame_buffer.drain(..samples_per_frame).collect();
                    let sample_count = (frame.len() / config.channels as usize) as u16;

                    match codec.encoder.encode(&frame) {
                        Ok(opus_data) => {
                            network.send_p2p_encoded_audio(
                                local_track.bridge_track_id,
                                opus_data,
                                config.channels,
                                sample_count,
                            );
                        }
                        Err(e) => {
                            debug!("Opus encode failed in bridge send loop: {}", e);
                        }
                    }

                    let mode = network.mode();
                    if mode == NetworkMode::Relay || mode == NetworkMode::Hybrid {
                        network.send_relay_audio(local_track.bridge_track_id, frame);
                    }
                }
            }
        }
    }
}

/// Helper to create and start an audio-network bridge
pub fn create_and_start_bridge(
    network: Arc<NetworkManager>,
    audio: AudioBridgeHandle,
    event_rx: broadcast::Receiver<NetworkEvent>,
) -> super::Result<AudioNetworkBridge> {
    let config = BridgeConfig::default();
    let bridge = AudioNetworkBridge::new(config, network, audio)?;
    bridge.start(event_rx);
    Ok(bridge)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_config_default() {
        let config = BridgeConfig::default();
        assert_eq!(config.sample_rate, 48000);
        assert_eq!(config.frame_size, 480);
        assert_eq!(config.channels, 2);
        assert_eq!(config.send_interval_ms, 10);
    }
}
