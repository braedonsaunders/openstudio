//! Audio-Network Bridge
//!
//! Connects the NetworkManager to the AudioEngine, handling:
//! - Incoming audio from network → AudioEngine remote user buffers
//! - Outgoing audio from AudioEngine → Network transmission
//! - Peer lifecycle (add/remove remote users)
//! - Control message forwarding (track state, effects, etc.)

use super::{NetworkEvent, NetworkManager, NetworkMode};
use crate::audio::AudioEngine;
use crate::network::osp::{OspMessageType, TrackStateMessage};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

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
    audio: Arc<AudioEngine>,
    running: Arc<std::sync::atomic::AtomicBool>,
}

impl AudioNetworkBridge {
    pub fn new(
        config: BridgeConfig,
        network: Arc<NetworkManager>,
        audio: Arc<AudioEngine>,
    ) -> Self {
        Self {
            config,
            network,
            audio,
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Start the bridge
    ///
    /// Spawns background tasks for:
    /// - Processing incoming network events (audio, peers, control)
    /// - Sending outgoing audio to the network
    pub fn start(&self, mut event_rx: broadcast::Receiver<NetworkEvent>) {
        self.running
            .store(true, std::sync::atomic::Ordering::SeqCst);
        info!("Starting audio-network bridge");

        // Spawn incoming event processor
        let audio = self.audio.clone();
        let running = self.running.clone();
        tokio::spawn(async move {
            while running.load(std::sync::atomic::Ordering::SeqCst) {
                match event_rx.recv().await {
                    Ok(event) => {
                        Self::handle_network_event(&audio, event).await;
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
        });

        // Spawn outgoing audio sender
        let audio = self.audio.clone();
        let network = self.network.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        tokio::spawn(async move {
            Self::audio_send_loop(audio, network, config, running).await;
        });

        info!("Audio-network bridge started");
    }

    /// Stop the bridge
    pub fn stop(&self) {
        self.running
            .store(false, std::sync::atomic::Ordering::SeqCst);
        info!("Audio-network bridge stopped");
    }

    /// Handle incoming network events
    async fn handle_network_event(audio: &AudioEngine, event: NetworkEvent) {
        match event {
            NetworkEvent::AudioReceived {
                user_id,
                track_id: _,
                samples,
            } => {
                // Push audio to the remote user's buffer in the audio engine
                audio.push_remote_audio(&user_id, &samples);
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
                Self::handle_control_message(audio, &from_user_id, message, &payload).await;
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
                // TODO: Forward to transport/metronome
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
        audio: &AudioEngine,
        from_user_id: &str,
        message_type: OspMessageType,
        payload: &[u8],
    ) {
        match message_type {
            OspMessageType::TrackState => {
                if let Ok(msg) = bincode::deserialize::<TrackStateMessage>(payload) {
                    // Update remote user settings based on their track state
                    let volume = msg.volume.unwrap_or(1.0);
                    let pan = msg.pan.unwrap_or(0.0);
                    let muted = msg.is_muted.unwrap_or(false);
                    audio.update_remote_user(from_user_id, volume, pan, muted, 0.0);
                }
            }

            OspMessageType::EffectParam => {
                // TODO: Could apply effects to remote user's audio
                debug!("Received effect param from {}: {:?}", from_user_id, payload);
            }

            OspMessageType::Transport => {
                // TODO: Forward to transport system
                debug!("Received transport command from {}", from_user_id);
            }

            OspMessageType::TempoChange => {
                // TODO: Forward to tempo/metronome
                debug!("Received tempo change from {}", from_user_id);
            }

            _ => {
                debug!(
                    "Unhandled control message type {:?} from {}",
                    message_type, from_user_id
                );
            }
        }
    }

    /// Audio send loop - gets audio from engine and sends to network
    async fn audio_send_loop(
        audio: Arc<AudioEngine>,
        network: Arc<NetworkManager>,
        config: BridgeConfig,
        running: Arc<std::sync::atomic::AtomicBool>,
    ) {
        let mut interval = tokio::time::interval(Duration::from_millis(config.send_interval_ms));
        let samples_per_frame = config.frame_size * config.channels as usize;
        let mut frame_buffer = Vec::with_capacity(samples_per_frame);

        while running.load(std::sync::atomic::Ordering::SeqCst) {
            interval.tick().await;

            // Skip if not connected
            if network.mode() == NetworkMode::Disconnected {
                continue;
            }

            // Get audio from the engine's browser stream buffer
            // This is the processed audio that would normally go to WebRTC
            let samples = audio.get_browser_stream_audio(samples_per_frame);

            if samples.is_empty() {
                continue;
            }

            // Accumulate until we have a full frame
            frame_buffer.extend_from_slice(&samples);

            // Send complete frames
            while frame_buffer.len() >= samples_per_frame {
                let frame: Vec<f32> = frame_buffer.drain(..samples_per_frame).collect();
                network.send_audio(config.local_track_id, frame);
            }
        }
    }
}

/// Helper to create and start an audio-network bridge
pub fn create_and_start_bridge(
    network: Arc<NetworkManager>,
    audio: Arc<AudioEngine>,
    event_rx: broadcast::Receiver<NetworkEvent>,
) -> AudioNetworkBridge {
    let config = BridgeConfig::default();
    let bridge = AudioNetworkBridge::new(config, network, audio);
    bridge.start(event_rx);
    bridge
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
