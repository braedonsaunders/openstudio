//! Network Manager
//!
//! Orchestrates P2P and relay connections, automatically switching based on
//! room size and network conditions.

use super::{
    clock::*, codec::*, osp::*, p2p::*, peer::*, relay::*, NetworkError, NetworkStats, Result,
    RoomConfig,
};
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
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
    /// Stats
    stats: RwLock<NetworkStats>,
    /// Codec
    codec: Arc<OpusCodec>,
}

impl NetworkManager {
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
            stats: RwLock::new(NetworkStats::default()),
            codec,
        })
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
        let manager = self.clone_for_task();
        tokio::spawn(async move {
            while let Some(msg) = outgoing_rx.recv().await {
                if let Err(e) = manager.send_message(msg).await {
                    warn!("Failed to send message: {}", e);
                }
            }
        });

        // Start stats update loop
        let manager = self.clone_for_task();
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

        // Start auto-switch monitor
        if self.config.auto_switch {
            let manager = self.clone_for_task();
            tokio::spawn(async move {
                manager.auto_switch_loop().await;
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
        stats.peer_count = self.peers.connected_count();
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

        let state = self.state.read();
        let room_config = state
            .room_config
            .clone()
            .ok_or_else(|| NetworkError::ConnectionFailed("Not in room".to_string()))?;
        let user_id = state.user_id.clone().unwrap_or_default();
        let user_name = state.user_name.clone().unwrap_or_default();
        drop(state);

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
        let mut rx = self.p2p.start().await?;
        self.p2p
            .join_room(
                room_config.clone(),
                user_id.to_string(),
                user_name.to_string(),
            )
            .await?;

        // Forward P2P events to our event channel
        let event_tx = self.event_tx.read().clone();
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
                        P2PEvent::ClockSync { beat_position, bpm } => {
                            let _ = tx.send(NetworkEvent::ClockSync {
                                beat_position,
                                bpm,
                                time_sig: (4, 4), // TODO: Include in P2PEvent
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
                            // New user's track available - could trigger subscribe
                        }
                        MoqEvent::DataReceived { track, data } => {
                            // Parse and forward
                            if track.track_type == "audio" {
                                if let Ok(samples) = bincode::deserialize::<Vec<f32>>(&data) {
                                    let _ = tx.send(NetworkEvent::AudioReceived {
                                        user_id: track.user_id,
                                        track_id: track.track_num,
                                        samples,
                                    });
                                }
                            }
                        }
                        _ => {}
                    }
                }
            });
        }

        Ok(())
    }

    async fn send_message(&self, msg: OutgoingMessage) -> Result<()> {
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
                        // Broadcast to all peers
                        for peer in self.p2p.peers().connected() {
                            // Note: send_packet is private, need to expose or use different approach
                        }
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
                        // Broadcast clock sync
                    }
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

    /// Clone reference for async tasks
    fn clone_for_task(&self) -> Arc<Self> {
        // Note: This is a simplified approach. In real implementation,
        // you'd want proper Arc wrapping of the NetworkManager itself.
        // For now, this method signature indicates intent.
        unimplemented!("Clone network manager reference for async task")
    }
}

// Note: In real implementation, NetworkManager would be wrapped in Arc
// and cloned for async tasks. For now, the methods above show the structure.
