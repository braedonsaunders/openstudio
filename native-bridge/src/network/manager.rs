//! Network Manager
//!
//! Orchestrates P2P and relay connections, automatically switching based on
//! room size and network conditions.

use super::{
    clock::*, codec::*, osp::*, p2p::*, peer::*, relay::*, NetworkError, NetworkStats, Result,
    RoomConfig,
};
use parking_lot::RwLock;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, mpsc};
use tracing::{info, warn};

/// Network mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum NetworkMode {
    /// Not connected
    #[default]
    Disconnected,
    /// Direct P2P mesh (2-4 users)
    P2P,
    /// Cloudflare MoQ relay (5+ users)
    Relay,
    /// Hybrid: P2P for nearby peers, relay for others
    Hybrid,
}

/// Network configuration
#[derive(Debug, Clone)]
pub struct NetworkConfig {
    /// P2P configuration
    pub p2p: P2PConfig,
    /// MoQ relay configuration
    pub moq: MoqConfig,
    /// Maximum users for P2P mode
    pub p2p_max_users: usize,
    /// Auto-switch to relay when exceeding P2P max
    pub auto_switch: bool,
    /// Preferred mode (if auto_switch is false)
    pub preferred_mode: NetworkMode,
    /// Our sample rate
    pub sample_rate: u32,
    /// Frame size in samples
    pub frame_size: usize,
    /// Channels
    pub channels: u8,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            p2p: P2PConfig::default(),
            moq: MoqConfig::default(),
            p2p_max_users: 4,
            auto_switch: true,
            preferred_mode: NetworkMode::P2P,
            sample_rate: 48000,
            frame_size: 480,
            channels: 2,
        }
    }
}

/// Events from the network manager
#[derive(Debug, Clone)]
pub enum NetworkEvent {
    /// Connection state changed
    StateChanged { mode: NetworkMode },
    /// Peer connected
    PeerConnected {
        user_id: String,
        user_name: String,
        has_native_bridge: bool,
    },
    /// Peer disconnected
    PeerDisconnected { user_id: String, reason: String },
    /// Audio received from peer
    AudioReceived {
        user_id: String,
        track_id: u8,
        samples: Vec<f32>,
    },
    /// Control message received
    ControlMessage {
        from_user_id: String,
        message: OspMessageType,
        payload: Vec<u8>,
    },
    /// Clock sync update
    ClockSync {
        beat_position: f64,
        bpm: f32,
        time_sig: (u8, u8),
    },
    /// Room state received
    RoomState { state: RoomStateMessage },
    /// Network stats update
    StatsUpdate { stats: NetworkStats },
    /// Error occurred
    Error { error: String },
    /// Mode switched (P2P <-> Relay)
    ModeSwitched {
        from: NetworkMode,
        to: NetworkMode,
        reason: String,
    },
}

/// Outgoing message to send
#[derive(Debug)]
pub enum OutgoingMessage {
    /// Audio frame
    Audio { track_id: u8, samples: Vec<f32> },
    /// Control message
    Control {
        message_type: OspMessageType,
        payload: Vec<u8>,
    },
    /// Clock sync (master only)
    ClockSync {
        beat_position: f64,
        bpm: f32,
        time_sig: (u8, u8),
    },
    /// Pre-encoded audio for direct P2P transmission.
    /// Bypasses mode-based routing and Opus encoding in the P2P layer,
    /// since the bridge has already Opus-encoded the audio.
    P2PEncodedAudio {
        track_id: u8,
        opus_data: Vec<u8>,
        channels: u8,
        sample_count: u16,
    },
    /// Audio for relay only. Used by the bridge for dual-path operation
    /// where P2P audio is sent separately via P2PEncodedAudio.
    RelayAudio { track_id: u8, samples: Vec<f32> },
}

/// Network manager state
struct ManagerState {
    mode: NetworkMode,
    room_config: Option<RoomConfig>,
    user_id: Option<String>,
    user_name: Option<String>,
    is_master: bool,
    connected_at: Option<Instant>,
}

/// The main network manager
///
/// NetworkManager is designed to be wrapped in Arc and shared across async tasks.
/// Use `NetworkManager::new_shared()` to create an Arc-wrapped instance.
pub struct NetworkManager {
    config: NetworkConfig,
    state: RwLock<ManagerState>,
    /// P2P network (used in P2P/Hybrid mode)
    p2p: Arc<P2PNetwork>,
    /// MoQ relay (used in Relay/Hybrid mode)
    relay: Arc<MoqRelay>,
    /// Combined peer registry
    peers: Arc<PeerRegistry>,
    /// Clock synchronization
    clock: Arc<ClockSync>,
    /// Event sender
    event_tx: RwLock<Option<broadcast::Sender<NetworkEvent>>>,
    /// Outgoing message queue
    outgoing_tx: RwLock<Option<mpsc::UnboundedSender<OutgoingMessage>>>,
    /// Codec
    codec: Arc<OpusCodec>,
    /// Self-reference for spawning async tasks (set after Arc creation)
    self_ref: RwLock<Option<std::sync::Weak<Self>>>,
}

impl NetworkManager {
    /// Create a new NetworkManager. For proper async task support, prefer `new_shared()`.
    pub fn new(config: NetworkConfig) -> Result<Self> {
        let p2p = Arc::new(P2PNetwork::new(config.p2p.clone())?);
        let relay = Arc::new(MoqRelay::new(config.moq.clone())?);
        let peers = Arc::new(PeerRegistry::new());
        let clock = Arc::new(ClockSync::new(ClockConfig::default()));
        let codec = Arc::new(OpusCodec::new(OpusConfig {
            sample_rate: config.sample_rate,
            channels: config.channels,
            frame_size: config.frame_size,
            ..OpusConfig::low_latency()
        })?);

        Ok(Self {
            config,
            state: RwLock::new(ManagerState {
                mode: NetworkMode::Disconnected,
                room_config: None,
                user_id: None,
                user_name: None,
                is_master: false,
                connected_at: None,
            }),
            p2p,
            relay,
            peers,
            clock,
            event_tx: RwLock::new(None),
            outgoing_tx: RwLock::new(None),
            codec,
            self_ref: RwLock::new(None),
        })
    }

    /// Create a new NetworkManager wrapped in Arc with self-reference initialized.
    /// This is the preferred way to create a NetworkManager for production use.
    pub fn new_shared(config: NetworkConfig) -> Result<Arc<Self>> {
        let manager = Arc::new(Self::new(config)?);
        *manager.self_ref.write() = Some(Arc::downgrade(&manager));
        Ok(manager)
    }

    /// Initialize self-reference after wrapping in Arc.
    /// Call this if you created the manager with `new()` instead of `new_shared()`.
    pub fn init_self_ref(self: &Arc<Self>) {
        *self.self_ref.write() = Some(Arc::downgrade(self));
    }

    /// Connect to a room
    pub async fn connect(
        &self,
        room_config: RoomConfig,
        user_id: String,
        user_name: String,
    ) -> Result<broadcast::Receiver<NetworkEvent>> {
        info!(
            "Connecting to room: {} as {}",
            room_config.room_id, user_name
        );

        // Create event channel
        let (event_tx, event_rx) = broadcast::channel(1000);
        *self.event_tx.write() = Some(event_tx.clone());

        // Create outgoing message channel
        let (outgoing_tx, mut outgoing_rx) = mpsc::unbounded_channel();
        *self.outgoing_tx.write() = Some(outgoing_tx);

        // Update state
        {
            let mut state = self.state.write();
            state.room_config = Some(room_config.clone());
            state.user_id = Some(user_id.clone());
            state.user_name = Some(user_name.clone());
            state.connected_at = Some(Instant::now());
        }

        // Determine initial mode
        let initial_mode = if self.config.auto_switch {
            // Start with P2P, switch to relay if needed
            NetworkMode::P2P
        } else {
            self.config.preferred_mode
        };

        // Connect based on mode
        match initial_mode {
            NetworkMode::P2P => {
                self.start_p2p(&room_config, &user_id, &user_name).await?;
            }
            NetworkMode::Relay => {
                self.start_relay(&room_config, &user_id).await?;
            }
            NetworkMode::Hybrid => {
                // Start both
                self.start_p2p(&room_config, &user_id, &user_name).await?;
                self.start_relay(&room_config, &user_id).await?;
            }
            NetworkMode::Disconnected => {}
        }

        self.state.write().mode = initial_mode;

        let _ = event_tx.send(NetworkEvent::StateChanged { mode: initial_mode });

        // Start outgoing message processor
        if let Some(manager) = self.clone_for_task() {
            tokio::spawn(async move {
                while let Some(msg) = outgoing_rx.recv().await {
                    if let Err(e) = manager.send_message(msg).await {
                        warn!("Failed to send message: {}", e);
                    }
                }
            });
        }

        // Start stats update loop
        if let Some(manager) = self.clone_for_task() {
            let stats_tx = event_tx.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_millis(1000));
                loop {
                    interval.tick().await;
                    if manager.mode() == NetworkMode::Disconnected {
                        break;
                    }
                    let stats = manager.stats();
                    let _ = stats_tx.send(NetworkEvent::StatsUpdate { stats });
                }
            });
        }

        // Start auto-switch monitor
        if self.config.auto_switch {
            if let Some(manager) = self.clone_for_task() {
                tokio::spawn(async move {
                    manager.auto_switch_loop().await;
                });
            }
        }

        // Start connection health monitor (handles reconnection and error recovery)
        if let Some(manager) = self.clone_for_task() {
            tokio::spawn(async move {
                manager.connection_health_loop().await;
            });
        }

        Ok(event_rx)
    }

    /// Disconnect from room
    pub async fn disconnect(&self) {
        info!("Disconnecting from room");

        // Stop P2P
        self.p2p.stop().await;

        // Stop relay
        self.relay.disconnect().await;

        // Update state
        {
            let mut state = self.state.write();
            state.mode = NetworkMode::Disconnected;
            state.room_config = None;
            state.connected_at = None;
        }

        // Notify
        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(NetworkEvent::StateChanged {
                mode: NetworkMode::Disconnected,
            });
        }
    }

    /// Send audio frame
    pub fn send_audio(&self, track_id: u8, samples: Vec<f32>) {
        if let Some(tx) = self.outgoing_tx.read().as_ref() {
            let _ = tx.send(OutgoingMessage::Audio { track_id, samples });
        }
    }

    /// Send control message
    pub fn send_control(&self, message_type: OspMessageType, payload: Vec<u8>) {
        if let Some(tx) = self.outgoing_tx.read().as_ref() {
            let _ = tx.send(OutgoingMessage::Control {
                message_type,
                payload,
            });
        }
    }

    /// Send clock sync (master only)
    pub fn send_clock_sync(&self, beat_position: f64, bpm: f32, time_sig: (u8, u8)) {
        if !self.state.read().is_master {
            return;
        }
        if let Some(tx) = self.outgoing_tx.read().as_ref() {
            let _ = tx.send(OutgoingMessage::ClockSync {
                beat_position,
                bpm,
                time_sig,
            });
        }
    }

    /// Send pre-encoded audio frame to P2P peers.
    /// Bypasses the standard outgoing queue's Opus encoding since the
    /// bridge has already encoded the audio. Sent via the outgoing channel
    /// so socket I/O occurs on the correct tokio runtime.
    pub fn send_p2p_encoded_audio(
        &self,
        track_id: u8,
        opus_data: Vec<u8>,
        channels: u8,
        sample_count: u16,
    ) {
        if let Some(tx) = self.outgoing_tx.read().as_ref() {
            let _ = tx.send(OutgoingMessage::P2PEncodedAudio {
                track_id,
                opus_data,
                channels,
                sample_count,
            });
        }
    }

    /// Send audio frame to relay only.
    /// Used by the bridge for dual-path operation where P2P audio
    /// is sent separately via send_p2p_encoded_audio.
    pub fn send_relay_audio(&self, track_id: u8, samples: Vec<f32>) {
        if let Some(tx) = self.outgoing_tx.read().as_ref() {
            let _ = tx.send(OutgoingMessage::RelayAudio { track_id, samples });
        }
    }

    /// Get access to the audio codec for encoding/decoding
    pub fn codec(&self) -> &OpusCodec {
        &self.codec
    }

    /// Get current mode
    pub fn mode(&self) -> NetworkMode {
        self.state.read().mode
    }

    /// Get stats
    pub fn stats(&self) -> NetworkStats {
        let mut stats = match self.mode() {
            NetworkMode::P2P | NetworkMode::Hybrid => self.p2p.stats(),
            NetworkMode::Relay => self.relay.stats(),
            NetworkMode::Disconnected => NetworkStats::default(),
        };
        stats.mode = self.mode();
        stats
    }

    /// Get clock
    pub fn clock(&self) -> &ClockSync {
        &self.clock
    }

    /// Get peers
    pub fn peers(&self) -> &PeerRegistry {
        &self.peers
    }

    /// Get the local P2P UDP endpoint, when the P2P socket is running.
    pub fn p2p_local_addr(&self) -> Result<SocketAddr> {
        self.p2p.local_addr()
    }

    /// Get the STUN-discovered public P2P endpoint, when available.
    pub fn p2p_public_addr(&self) -> Option<SocketAddr> {
        self.p2p.public_addr()
    }

    /// Connect the P2P transport to a peer discovered by the browser signaling layer.
    pub async fn connect_p2p_peer(
        &self,
        addr: SocketAddr,
        user_id: String,
        user_name: String,
    ) -> Result<()> {
        self.p2p.connect_peer(addr, user_id, user_name).await?;
        Ok(())
    }

    /// Check if we're the master
    pub fn is_master(&self) -> bool {
        self.state.read().is_master
    }

    /// Set master status
    pub fn set_master(&self, is_master: bool) {
        self.state.write().is_master = is_master;
        self.clock.set_master(is_master);
    }

    /// Switch to a specific mode
    pub async fn switch_mode(&self, new_mode: NetworkMode) -> Result<()> {
        let current_mode = self.mode();
        if current_mode == new_mode {
            return Ok(());
        }

        // Extract needed data in a block to ensure guard is dropped before any await
        let (room_config, user_id, user_name) = {
            let state = self.state.read();
            let room_config = state
                .room_config
                .clone()
                .ok_or_else(|| NetworkError::ConnectionFailed("Not in room".to_string()))?;
            let user_id = state.user_id.clone().unwrap_or_default();
            let user_name = state.user_name.clone().unwrap_or_default();
            (room_config, user_id, user_name)
        }; // guard dropped here

        info!("Switching mode from {:?} to {:?}", current_mode, new_mode);

        match new_mode {
            NetworkMode::P2P => {
                // Stop relay if running
                if current_mode == NetworkMode::Relay || current_mode == NetworkMode::Hybrid {
                    self.relay.disconnect().await;
                }
                // Start P2P if not running
                if current_mode != NetworkMode::Hybrid {
                    self.start_p2p(&room_config, &user_id, &user_name).await?;
                }
            }
            NetworkMode::Relay => {
                // Stop P2P if running
                if current_mode == NetworkMode::P2P || current_mode == NetworkMode::Hybrid {
                    self.p2p.stop().await;
                }
                // Start relay if not running
                if current_mode != NetworkMode::Hybrid {
                    self.start_relay(&room_config, &user_id).await?;
                }
            }
            NetworkMode::Hybrid => {
                // Start both
                if current_mode == NetworkMode::Disconnected || current_mode == NetworkMode::Relay {
                    self.start_p2p(&room_config, &user_id, &user_name).await?;
                }
                if current_mode == NetworkMode::Disconnected || current_mode == NetworkMode::P2P {
                    self.start_relay(&room_config, &user_id).await?;
                }
            }
            NetworkMode::Disconnected => {
                self.disconnect().await;
            }
        }

        self.state.write().mode = new_mode;

        // Notify
        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(NetworkEvent::ModeSwitched {
                from: current_mode,
                to: new_mode,
                reason: "Manual switch".to_string(),
            });
        }

        Ok(())
    }

    // === Private helpers ===

    async fn start_p2p(
        &self,
        room_config: &RoomConfig,
        user_id: &str,
        user_name: &str,
    ) -> Result<()> {
        self.p2p
            .join_room(
                room_config.clone(),
                user_id.to_string(),
                user_name.to_string(),
            )
            .await?;
        let mut rx = self.p2p.start().await?;

        // Forward P2P events to our event channel
        let event_tx = self.event_tx.read().clone();
        let peers_for_events = self.peers.clone();
        if let Some(tx) = event_tx {
            tokio::spawn(async move {
                while let Ok(event) = rx.recv().await {
                    match event {
                        P2PEvent::PeerConnected { peer_id, user_name } => {
                            let _ = tx.send(NetworkEvent::PeerConnected {
                                user_id: peer_id.to_string(),
                                user_name,
                                has_native_bridge: true,
                            });
                        }
                        P2PEvent::PeerDisconnected { peer_id, reason } => {
                            // Mark peer as audio-inactive on disconnect
                            if let Some(peer) = peers_for_events.get(peer_id) {
                                peer.set_audio_active(false);
                            }
                            let _ = tx.send(NetworkEvent::PeerDisconnected {
                                user_id: peer_id.to_string(),
                                reason,
                            });
                        }
                        P2PEvent::AudioReceived {
                            peer_id,
                            track_id,
                            samples,
                        } => {
                            let _ = tx.send(NetworkEvent::AudioReceived {
                                user_id: peer_id.to_string(),
                                track_id,
                                samples,
                            });
                        }
                        P2PEvent::ClockSync {
                            beat_position,
                            bpm,
                            time_sig,
                        } => {
                            let _ = tx.send(NetworkEvent::ClockSync {
                                beat_position,
                                bpm,
                                time_sig,
                            });
                        }
                        P2PEvent::RoomState { state } => {
                            let _ = tx.send(NetworkEvent::RoomState { state });
                        }
                        _ => {}
                    }
                }
            });
        }

        Ok(())
    }

    async fn start_relay(&self, room_config: &RoomConfig, user_id: &str) -> Result<()> {
        let mut rx = self.relay.connect(&room_config.room_id, user_id).await?;

        // Forward relay events
        let event_tx = self.event_tx.read().clone();
        let relay = self.relay.clone();
        let local_user_id = user_id.to_string();
        if let Some(tx) = event_tx {
            tokio::spawn(async move {
                while let Ok(event) = rx.recv().await {
                    match event {
                        MoqEvent::Connected => {
                            // Already handled
                        }
                        MoqEvent::Disconnected { reason } => {
                            let _ = tx.send(NetworkEvent::Error { error: reason });
                        }
                        MoqEvent::TrackAvailable { track } => {
                            if track.user_id != local_user_id {
                                if let Err(e) =
                                    relay.subscribe_audio(&track.user_id, track.track_num).await
                                {
                                    let _ = tx.send(NetworkEvent::Error {
                                        error: format!(
                                            "Failed to subscribe to relay track {}: {}",
                                            track.to_path(),
                                            e
                                        ),
                                    });
                                }
                            }
                        }
                        MoqEvent::AudioReceived {
                            track,
                            samples,
                            sequence: _,
                        } => {
                            let _ = tx.send(NetworkEvent::AudioReceived {
                                user_id: track.user_id,
                                track_id: track.track_num,
                                samples,
                            });
                        }
                        _ => {}
                    }
                }
            });
        }

        Ok(())
    }

    async fn send_message(&self, msg: OutgoingMessage) -> Result<()> {
        match msg {
            // Pre-encoded audio sent directly to P2P peers (bypass mode-based routing)
            OutgoingMessage::P2PEncodedAudio {
                track_id,
                opus_data,
                channels,
                sample_count,
            } => {
                self.p2p
                    .broadcast_encoded_audio(track_id, &opus_data, channels, sample_count)
                    .await
            }
            // Audio sent directly to relay (bypass mode-based routing)
            OutgoingMessage::RelayAudio { track_id, samples } => {
                self.relay.send_audio(track_id, &samples).await
            }
            // Standard messages routed by current network mode
            other => self.send_mode_routed(other).await,
        }
    }

    /// Route standard outgoing messages based on current network mode.
    /// Handles Audio, Control, and ClockSync messages for P2P, Relay, and Hybrid modes.
    async fn send_mode_routed(&self, msg: OutgoingMessage) -> Result<()> {
        match self.mode() {
            NetworkMode::P2P => {
                match msg {
                    OutgoingMessage::Audio { track_id, samples } => {
                        self.p2p.send_audio(track_id, &samples).await?;
                    }
                    OutgoingMessage::Control {
                        message_type,
                        payload,
                    } => {
                        // Broadcast to all peers using the public broadcast_control method
                        self.p2p.broadcast_control(message_type, payload).await?;
                    }
                    OutgoingMessage::ClockSync {
                        beat_position,
                        bpm,
                        time_sig,
                    } => {
                        let msg = ClockSyncMessage {
                            master_time: ClockSync::now_ms(),
                            beat_position,
                            bpm,
                            time_sig_num: time_sig.0,
                            time_sig_denom: time_sig.1,
                            sync_sequence: 0,
                        };
                        let payload = bincode::serialize(&msg)
                            .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                        // Broadcast clock sync to all peers
                        self.p2p
                            .broadcast_control(OspMessageType::ClockSync, payload)
                            .await?;
                    }
                    // P2PEncodedAudio and RelayAudio are handled in send_message
                    _ => {}
                }
            }
            NetworkMode::Relay => match msg {
                OutgoingMessage::Audio { track_id, samples } => {
                    self.relay.send_audio(track_id, &samples).await?;
                }
                OutgoingMessage::Control {
                    message_type,
                    payload,
                } => {
                    self.relay.send_control(message_type, payload).await?;
                }
                OutgoingMessage::ClockSync {
                    beat_position,
                    bpm,
                    time_sig,
                } => {
                    let msg = ClockSyncMessage {
                        master_time: ClockSync::now_ms(),
                        beat_position,
                        bpm,
                        time_sig_num: time_sig.0,
                        time_sig_denom: time_sig.1,
                        sync_sequence: 0,
                    };
                    let payload = bincode::serialize(&msg)
                        .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                    self.relay
                        .send_control(OspMessageType::ClockSync, payload)
                        .await?;
                }
                // P2PEncodedAudio and RelayAudio are handled in send_message
                _ => {}
            },
            NetworkMode::Hybrid => {
                // Send via both (relay handles fan-out, P2P for low-latency to nearby)
                match msg {
                    OutgoingMessage::Audio {
                        track_id,
                        ref samples,
                    } => {
                        // P2P for nearby peers
                        let _ = self.p2p.send_audio(track_id, samples).await;
                        // Relay for others
                        let _ = self.relay.send_audio(track_id, samples).await;
                    }
                    OutgoingMessage::Control {
                        message_type,
                        ref payload,
                    } => {
                        self.relay
                            .send_control(message_type, payload.clone())
                            .await?;
                    }
                    OutgoingMessage::ClockSync {
                        beat_position,
                        bpm,
                        time_sig,
                    } => {
                        let msg = ClockSyncMessage {
                            master_time: ClockSync::now_ms(),
                            beat_position,
                            bpm,
                            time_sig_num: time_sig.0,
                            time_sig_denom: time_sig.1,
                            sync_sequence: 0,
                        };
                        let payload = bincode::serialize(&msg)
                            .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                        self.relay
                            .send_control(OspMessageType::ClockSync, payload)
                            .await?;
                    }
                    // P2PEncodedAudio and RelayAudio are handled in send_message
                    _ => {}
                }
            }
            NetworkMode::Disconnected => {}
        }

        Ok(())
    }

    async fn auto_switch_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(5));

        loop {
            interval.tick().await;

            let mode = self.mode();
            if mode == NetworkMode::Disconnected {
                break;
            }

            let peer_count = self.peers.connected_count();

            // Check if we need to switch modes
            match mode {
                NetworkMode::P2P if peer_count > self.config.p2p_max_users => {
                    info!(
                        "Peer count ({}) exceeds P2P max ({}), switching to relay",
                        peer_count, self.config.p2p_max_users
                    );
                    if let Err(e) = self.switch_mode(NetworkMode::Relay).await {
                        warn!("Failed to switch to relay: {}", e);
                    }
                }
                NetworkMode::Relay if peer_count <= self.config.p2p_max_users => {
                    info!(
                        "Peer count ({}) below P2P max ({}), switching to P2P",
                        peer_count, self.config.p2p_max_users
                    );
                    if let Err(e) = self.switch_mode(NetworkMode::P2P).await {
                        warn!("Failed to switch to P2P: {}", e);
                    }
                }
                _ => {}
            }
        }
    }

    /// Connection health monitor - handles automatic reconnection
    async fn connection_health_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        let mut consecutive_failures = 0u32;
        let max_backoff_secs = 30u64;

        loop {
            interval.tick().await;

            let mode = self.mode();
            if mode == NetworkMode::Disconnected {
                break;
            }

            // Check relay connection state
            let relay_state = self.relay.state();
            let needs_reconnect = matches!(
                relay_state,
                MoqConnectionState::Disconnected | MoqConnectionState::Failed
            ) && (mode == NetworkMode::Relay || mode == NetworkMode::Hybrid);

            if needs_reconnect {
                warn!(
                    "Relay connection lost (state: {:?}), attempting reconnect...",
                    relay_state
                );

                // Calculate backoff with exponential increase
                let backoff_secs =
                    std::cmp::min(2u64.saturating_pow(consecutive_failures), max_backoff_secs);

                if consecutive_failures > 0 {
                    info!("Waiting {}s before reconnect attempt...", backoff_secs);
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                }

                match self.relay.reconnect().await {
                    Ok(()) => {
                        info!("Relay reconnected successfully");
                        consecutive_failures = 0;

                        // Notify about reconnection
                        if let Some(tx) = self.event_tx.read().as_ref() {
                            let _ = tx.send(NetworkEvent::StateChanged { mode });
                        }
                    }
                    Err(e) => {
                        consecutive_failures += 1;
                        warn!(
                            "Relay reconnection attempt {} failed: {}",
                            consecutive_failures, e
                        );

                        if consecutive_failures >= self.config.moq.max_reconnect_attempts {
                            warn!(
                                "Max reconnection attempts ({}) reached, giving up",
                                self.config.moq.max_reconnect_attempts
                            );
                            if let Some(tx) = self.event_tx.read().as_ref() {
                                let _ = tx.send(NetworkEvent::Error {
                                    error: format!(
                                        "Connection lost after {} reconnection attempts",
                                        consecutive_failures
                                    ),
                                });
                            }
                            // Reset counter to allow future attempts if user initiates
                            consecutive_failures = 0;
                        }
                    }
                }
            } else if relay_state == MoqConnectionState::Connected {
                // Connection is healthy, reset failure counter
                consecutive_failures = 0;
            }

            // Check P2P health (connection quality monitoring)
            if mode == NetworkMode::P2P || mode == NetworkMode::Hybrid {
                let stats = self.p2p.stats();

                // If packet loss is too high, notify
                if stats.packet_loss_pct > 10.0 {
                    warn!("High packet loss detected: {:.1}%", stats.packet_loss_pct);
                    if let Some(tx) = self.event_tx.read().as_ref() {
                        let _ = tx.send(NetworkEvent::StatsUpdate {
                            stats: stats.clone(),
                        });
                    }
                }

                // If RTT is too high for live jamming, consider switching to relay
                if stats.rtt_ms > 100.0 && mode == NetworkMode::P2P && self.config.auto_switch {
                    warn!(
                        "High latency detected ({:.0}ms), considering relay mode",
                        stats.rtt_ms
                    );
                }
            }
        }
    }

    /// Clone reference for async tasks.
    ///
    /// This upgrades the weak self-reference to a strong Arc when the manager is still alive.
    fn clone_for_task(&self) -> Option<Arc<Self>> {
        self.self_ref.read().as_ref()?.upgrade()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddr;
    use tokio::time::{sleep, Duration, Instant};

    fn p2p_test_config() -> NetworkConfig {
        let mut config = NetworkConfig {
            auto_switch: false,
            preferred_mode: NetworkMode::P2P,
            ..Default::default()
        };
        config.p2p.bind_addr = SocketAddr::from(([127, 0, 0, 1], 0));
        config.p2p.stun_server = None;
        config
    }

    #[tokio::test]
    async fn stats_report_p2p_connected_peers() {
        let alice = NetworkManager::new_shared(p2p_test_config())
            .expect("alice network manager should initialize");
        let bob = NetworkManager::new_shared(p2p_test_config())
            .expect("bob network manager should initialize");

        let room = RoomConfig {
            room_id: "manager-stats-room".to_string(),
            room_secret: "manager-stats-secret".to_string(),
            ..Default::default()
        };

        let _alice_events = alice
            .connect(room.clone(), "alice".to_string(), "Alice".to_string())
            .await
            .expect("alice should join the P2P room");
        let _bob_events = bob
            .connect(room, "bob".to_string(), "Bob".to_string())
            .await
            .expect("bob should join the P2P room");

        let alice_endpoint = alice
            .p2p_local_addr()
            .expect("alice should expose a P2P endpoint");
        let bob_endpoint = bob
            .p2p_local_addr()
            .expect("bob should expose a P2P endpoint");

        alice
            .connect_p2p_peer(bob_endpoint, "bob".to_string(), "Bob".to_string())
            .await
            .expect("alice should connect to bob");
        bob.connect_p2p_peer(alice_endpoint, "alice".to_string(), "Alice".to_string())
            .await
            .expect("bob should connect to alice");

        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            if alice.stats().peer_count == 1 && bob.stats().peer_count == 1 {
                break;
            }
            assert!(
                Instant::now() < deadline,
                "P2P peer counts did not propagate to network manager stats"
            );
            sleep(Duration::from_millis(25)).await;
        }

        alice.send_audio(7, vec![0.25; 960]);

        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            let alice_stats = alice.stats();
            let bob_stats = bob.stats();
            if alice_stats.audio_frames_sent > 0 && bob_stats.audio_frames_recv > 0 {
                assert!(bob_stats.audio_samples_recv > 0);
                break;
            }
            assert!(
                Instant::now() < deadline,
                "P2P audio frame stats did not propagate: alice={alice_stats:?}, bob={bob_stats:?}"
            );
            sleep(Duration::from_millis(25)).await;
        }

        alice.disconnect().await;
        bob.disconnect().await;
    }
}
