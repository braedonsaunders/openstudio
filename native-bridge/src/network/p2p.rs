//! P2P Networking Layer
//!
//! UDP-based peer-to-peer audio streaming inspired by AOO.
//! Handles NAT traversal, direct connections, and mesh topology.

#![allow(dead_code)]

use super::{
    clock::*, codec::*, jitter::*, osp::*, peer::*, NetworkError, NetworkStats, Result, RoomConfig,
};
use dashmap::DashMap;
use parking_lot::RwLock;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU16, Ordering as AtomicOrdering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket as TokioUdpSocket;
use tokio::sync::broadcast;
use tracing::{info, warn};

fn default_bind_addr() -> SocketAddr {
    let fallback = SocketAddr::from(([0, 0, 0, 0], 0));

    match std::env::var("OPENSTUDIO_P2P_BIND_ADDR") {
        Ok(value) => match value.parse::<SocketAddr>() {
            Ok(addr) => addr,
            Err(error) => {
                warn!(
                    "Invalid OPENSTUDIO_P2P_BIND_ADDR '{}': {}. Falling back to {}",
                    value, error, fallback
                );
                fallback
            }
        },
        Err(_) => fallback,
    }
}

/// P2P network configuration
#[derive(Debug, Clone)]
pub struct P2PConfig {
    /// Local bind address
    pub bind_addr: SocketAddr,
    /// STUN server for NAT traversal
    pub stun_server: Option<String>,
    /// Maximum peers for mesh topology
    pub max_peers: usize,
    /// Heartbeat interval in ms
    pub heartbeat_interval_ms: u64,
    /// Peer timeout in ms
    pub peer_timeout_ms: u64,
    /// Reliable message retry timeout in ms
    pub reliable_timeout_ms: u64,
    /// Maximum reliable retries
    pub max_retries: u32,
}

impl Default for P2PConfig {
    fn default() -> Self {
        Self {
            bind_addr: default_bind_addr(),
            stun_server: Some("stun:stun.l.google.com:19302".to_string()),
            max_peers: 8,
            heartbeat_interval_ms: 1000,
            peer_timeout_ms: 5000,
            reliable_timeout_ms: 500,
            max_retries: 5,
        }
    }
}

/// Events emitted by the P2P network
#[derive(Debug, Clone)]
pub enum P2PEvent {
    /// Peer connected
    PeerConnected { peer_id: u32, user_name: String },
    /// Peer disconnected
    PeerDisconnected { peer_id: u32, reason: String },
    /// Audio frame received
    AudioReceived {
        peer_id: u32,
        track_id: u8,
        samples: Vec<f32>,
    },
    /// Control message received
    ControlMessage {
        peer_id: u32,
        message_type: OspMessageType,
        payload: Vec<u8>,
    },
    /// Clock sync update
    ClockSync {
        beat_position: f64,
        bpm: f32,
        time_sig: (u8, u8),
    },
    /// Network stats update
    StatsUpdate { stats: NetworkStats },
    /// Room state received
    RoomState { state: RoomStateMessage },
}

struct ReceiveContext<'a> {
    socket: &'a TokioUdpSocket,
    room_config: &'a RoomConfig,
    peers: &'a PeerRegistry,
    codec: &'a OpusCodec,
    clock: &'a ClockSync,
    stats: &'a RwLock<NetworkStats>,
    sequence: &'a AtomicU16,
    session_start: Instant,
    event_tx: Option<&'a broadcast::Sender<P2PEvent>>,
}

/// P2P network manager
pub struct P2PNetwork {
    config: P2PConfig,
    /// UDP socket (wrapped in RwLock for interior mutability)
    socket: RwLock<Option<Arc<TokioUdpSocket>>>,
    peers: Arc<PeerRegistry>,
    clock: Arc<ClockSync>,
    codec: Arc<OpusCodec>,
    /// Our user info
    local_user_id: RwLock<Option<String>>,
    local_user_name: RwLock<Option<String>>,
    local_peer_id: RwLock<u32>,
    /// Room we're in
    room_config: RwLock<Option<RoomConfig>>,
    /// Sequence counter
    sequence: Arc<AtomicU16>,
    /// Session start time for timestamp calculation
    session_start: RwLock<Option<Instant>>,
    /// Event sender
    event_tx: RwLock<Option<broadcast::Sender<P2PEvent>>>,
    /// Our public address (from STUN)
    public_addr: RwLock<Option<SocketAddr>>,
    /// Is running (Arc for sharing with async tasks)
    running: Arc<std::sync::atomic::AtomicBool>,
    /// Audio output buffer (peer_id, track_id) -> samples
    audio_output: DashMap<(u32, u8), Vec<f32>>,
    /// Stats
    stats: Arc<RwLock<NetworkStats>>,
    /// Pending outgoing audio
    outgoing_audio: RwLock<Vec<(u8, Vec<f32>)>>,
}

impl P2PNetwork {
    pub fn new(config: P2PConfig) -> Result<Self> {
        let codec = OpusCodec::low_latency()?;

        Ok(Self {
            config,
            socket: RwLock::new(None),
            peers: Arc::new(PeerRegistry::new()),
            clock: Arc::new(ClockSync::new(ClockConfig::default())),
            codec: Arc::new(codec),
            local_user_id: RwLock::new(None),
            local_user_name: RwLock::new(None),
            local_peer_id: RwLock::new(0),
            room_config: RwLock::new(None),
            sequence: Arc::new(AtomicU16::new(0)),
            session_start: RwLock::new(None),
            event_tx: RwLock::new(None),
            public_addr: RwLock::new(None),
            running: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            audio_output: DashMap::new(),
            stats: Arc::new(RwLock::new(NetworkStats::default())),
            outgoing_audio: RwLock::new(Vec::new()),
        })
    }

    /// Start the P2P network
    pub async fn start(&self) -> Result<broadcast::Receiver<P2PEvent>> {
        let room_config = self.room_config.read().clone().ok_or_else(|| {
            NetworkError::ConnectionFailed("join_room must be called before start".to_string())
        })?;
        let socket = TokioUdpSocket::bind(&self.config.bind_addr).await?;
        info!("P2P network bound to {}", socket.local_addr()?);

        // Try STUN to discover public address
        if let Some(ref stun) = self.config.stun_server {
            if let Ok(public) = self.discover_public_addr(&socket, stun).await {
                info!("Public address: {}", public);
                *self.public_addr.write() = Some(public);
            }
        }

        let socket = Arc::new(socket);
        *self.socket.write() = Some(socket.clone());
        let session_start = Instant::now();
        *self.session_start.write() = Some(session_start);
        self.running
            .store(true, std::sync::atomic::Ordering::SeqCst);

        // Create event channel
        let (tx, rx) = broadcast::channel(1000);
        *self.event_tx.write() = Some(tx.clone());

        // Spawn receive loop
        self.spawn_receive_loop(socket.clone(), tx.clone(), room_config, session_start);

        // Spawn heartbeat loop for peer keepalive
        self.spawn_heartbeat_loop(socket.clone());

        info!("P2P network started with receive and heartbeat loops");

        Ok(rx)
    }

    /// Spawn the UDP receive loop
    fn spawn_receive_loop(
        &self,
        socket: Arc<TokioUdpSocket>,
        event_tx: broadcast::Sender<P2PEvent>,
        room_config: RoomConfig,
        session_start: Instant,
    ) {
        let running = self.running.clone();
        let peers = self.peers.clone();
        let codec = self.codec.clone();
        let clock = self.clock.clone();
        let sequence = self.sequence.clone();
        let stats = self.stats.clone();

        tokio::spawn(async move {
            let mut buf = [0u8; 2048]; // Max OSP packet size

            while running.load(std::sync::atomic::Ordering::SeqCst) {
                match socket.recv_from(&mut buf).await {
                    Ok((len, from)) => {
                        if len == 0 {
                            continue;
                        }

                        // Parse OSP packet
                        if let Some(packet) = OspPacket::from_bytes(&buf[..len]) {
                            stats.write().bytes_recv_per_sec += len as u64;
                            let context = ReceiveContext {
                                socket: socket.as_ref(),
                                room_config: &room_config,
                                peers: &peers,
                                codec: &codec,
                                clock: &clock,
                                stats: stats.as_ref(),
                                sequence: sequence.as_ref(),
                                session_start,
                                event_tx: Some(&event_tx),
                            };
                            if let Err(e) =
                                Self::process_received_packet(&packet, from, &context).await
                            {
                                warn!("Failed to process packet from {}: {}", from, e);
                            }
                        }
                    }
                    Err(e) => {
                        // Check if we're still running before logging error
                        if running.load(std::sync::atomic::Ordering::SeqCst) {
                            warn!("UDP receive error: {}", e);
                        }
                        // Brief pause on error to avoid tight loop
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                }
            }

            info!("P2P receive loop stopped");
        });
    }

    /// Process a received OSP packet (static to avoid self-reference in async)
    async fn process_received_packet(
        packet: &OspPacket,
        from: SocketAddr,
        context: &ReceiveContext<'_>,
    ) -> Result<()> {
        match packet.message_type {
            OspMessageType::AudioFrame => {
                let frame = AudioFrameMessage::from_bytes(&packet.payload).ok_or_else(|| {
                    NetworkError::Serialization("Invalid audio frame".to_string())
                })?;

                // Decode audio
                let samples = if frame.codec == 1 {
                    context.codec.decoder.decode(&frame.data)?
                } else {
                    // PCM fallback
                    frame
                        .data
                        .chunks(4)
                        .filter_map(|b| {
                            if b.len() == 4 {
                                Some(f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                            } else {
                                None
                            }
                        })
                        .collect()
                };

                {
                    let mut stats = context.stats.write();
                    stats.audio_frames_recv += 1;
                    stats.audio_samples_recv += samples.len() as u64;
                }

                // Find or create peer
                if let Some(peer) = context.peers.get(frame.user_id) {
                    // Ensure track exists
                    if peer.track(frame.track_id).is_none() {
                        peer.add_track(
                            frame.track_id,
                            format!("Track {}", frame.track_id),
                            JitterConfig::live_jamming(),
                        );
                    }

                    // Push to jitter buffer
                    peer.push_audio(
                        frame.track_id,
                        packet.header.sequence,
                        packet.header.timestamp,
                        samples.clone(),
                    );

                    // Update last seen and audio statistics
                    peer.touch();
                    peer.set_audio_active(true);
                    peer.record_audio_received(frame.data.len());

                    // Emit event
                    if let Some(tx) = context.event_tx {
                        let _ = tx.send(P2PEvent::AudioReceived {
                            peer_id: frame.user_id,
                            track_id: frame.track_id,
                            samples,
                        });
                    }
                }
            }

            OspMessageType::AudioLevels => {
                let msg: AudioLevelsMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;

                if let Some(peer) = context.peers.get(msg.user_id) {
                    for (track_id, level, _peak) in msg.track_levels {
                        peer.update_track(track_id, None, None, Some(level));
                    }
                }
            }

            OspMessageType::ClockSync => {
                let msg: ClockSyncMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                context.clock.update_beat_position(
                    msg.beat_position,
                    msg.bpm,
                    (msg.time_sig_num, msg.time_sig_denom),
                );

                if let Some(tx) = context.event_tx {
                    let _ = tx.send(P2PEvent::ClockSync {
                        beat_position: msg.beat_position,
                        bpm: msg.bpm,
                        time_sig: (msg.time_sig_num, msg.time_sig_denom),
                    });
                }
            }

            OspMessageType::Ping => {
                let ping: PingMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                let pong = PongMessage {
                    ping_id: ping.ping_id,
                    send_time: ping.send_time,
                    recv_time: ClockSync::now_ms(),
                };
                let payload = bincode::serialize(&pong)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                let response = OspPacket::new(
                    OspMessageType::Pong,
                    payload,
                    Self::next_sequence_value(context.sequence),
                    Self::timestamp_for(context.session_start),
                );
                context.socket.send_to(&response.to_bytes(), from).await?;
            }

            OspMessageType::Pong => {
                let pong: PongMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                let now = ClockSync::now_ms();
                let rtt = (now - pong.send_time) as f32;

                if let Some(peer) = Self::find_peer_by_addr_in_registry(context.peers, from) {
                    peer.update_rtt(rtt);
                    peer.touch();

                    let sample = ClockSample {
                        t1: pong.send_time,
                        t2: pong.recv_time,
                        t3: pong.recv_time,
                        t4: now,
                    };
                    context.clock.process_sync(sample);
                }
            }

            OspMessageType::Handshake => {
                let handshake: HandshakeMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;

                info!("Received handshake from {} ({})", handshake.user_name, from);

                let expected_hash = blake3::hash(context.room_config.room_secret.as_bytes());
                if handshake.room_secret_hash != *expected_hash.as_bytes() {
                    warn!("Handshake failed: invalid room secret");
                    return Err(NetworkError::AuthenticationFailed(
                        "Invalid room secret".to_string(),
                    ));
                }

                let peer_id = hash_user_id(&handshake.user_id);
                if let Some(existing) = context.peers.get(peer_id) {
                    existing.set_state(PeerState::Connected);
                    existing.set_direct_addr(Some(from));
                } else {
                    let new_peer = Peer::new(
                        peer_id,
                        handshake.user_id.clone(),
                        handshake.user_name.clone(),
                        handshake.has_native_bridge,
                        "performer".to_string(),
                    );
                    new_peer.set_state(PeerState::Connected);
                    new_peer.set_direct_addr(Some(from));
                    let _ = context.peers.add(new_peer);
                }

                let room_state = Self::build_room_state_message(context.peers, context.room_config);
                let ack = HandshakeAckMessage {
                    success: true,
                    error: None,
                    assigned_user_id: Some(peer_id),
                    room_state: Some(room_state),
                    is_master: context.clock.is_master(),
                };
                let ack_payload = bincode::serialize(&ack)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                let response = OspPacket::new(
                    OspMessageType::HandshakeAck,
                    ack_payload,
                    Self::next_sequence_value(context.sequence),
                    Self::timestamp_for(context.session_start),
                );
                context.socket.send_to(&response.to_bytes(), from).await?;

                if let Some(tx) = context.event_tx {
                    let _ = tx.send(P2PEvent::PeerConnected {
                        peer_id,
                        user_name: handshake.user_name,
                    });
                }
            }

            OspMessageType::HandshakeAck => {
                let ack: HandshakeAckMessage = bincode::deserialize(&packet.payload)
                    .map_err(|e| NetworkError::Serialization(e.to_string()))?;
                if !ack.success {
                    return Err(NetworkError::AuthenticationFailed(
                        ack.error.unwrap_or_else(|| "Unknown error".to_string()),
                    ));
                }

                if let Some(peer) = Self::find_peer_by_addr_in_registry(context.peers, from) {
                    peer.set_state(PeerState::Connected);
                    if let Some(tx) = context.event_tx {
                        let _ = tx.send(P2PEvent::PeerConnected {
                            peer_id: peer.id,
                            user_name: peer.user_name.clone(),
                        });
                    }
                }

                if let Some(room_state) = ack.room_state {
                    if let Some(tx) = context.event_tx {
                        let _ = tx.send(P2PEvent::RoomState { state: room_state });
                    }
                }
            }

            _ => {
                // Forward control messages
                if let Some(peer) = Self::find_peer_by_addr_in_registry(context.peers, from) {
                    peer.touch();
                    if let Some(tx) = context.event_tx {
                        let _ = tx.send(P2PEvent::ControlMessage {
                            peer_id: peer.id,
                            message_type: packet.message_type,
                            payload: packet.payload.clone(),
                        });
                    }
                }
            }
        }

        Ok(())
    }

    fn build_room_state_message(peers: &PeerRegistry, room: &RoomConfig) -> RoomStateMessage {
        let users: Vec<UserJoinMessage> = peers
            .all()
            .iter()
            .map(|peer| UserJoinMessage {
                user_id: peer.user_id.clone(),
                user_name: peer.user_name.clone(),
                avatar_url: peer.avatar_url.read().clone(),
                instrument: peer.instrument.read().clone(),
                has_native_bridge: peer.has_native_bridge,
                role: peer.role.read().clone(),
            })
            .collect();

        let tracks: Vec<TrackCreateMessage> = peers
            .all()
            .iter()
            .flat_map(|peer| {
                peer.tracks()
                    .iter()
                    .map(|track| TrackCreateMessage {
                        user_id: peer.user_id.clone(),
                        track_id: track.track_id.to_string(),
                        track_name: track.track_name.clone(),
                        track_type: "audio".to_string(),
                        color: "#4f46e5".to_string(),
                        audio_settings: TrackAudioSettings {
                            input_mode: "mono".to_string(),
                            sample_rate: 48000,
                            buffer_size: 480,
                            channel_count: 2,
                        },
                    })
                    .collect::<Vec<_>>()
            })
            .collect();

        RoomStateMessage {
            room_id: room.room_id.clone(),
            users,
            tracks,
            tempo: 120.0,
            key: "C".to_string(),
            scale: "major".to_string(),
            time_signature: (4, 4),
            transport_state: TransportAction::Stop,
            transport_position: 0.0,
        }
    }

    fn find_peer_by_addr_in_registry(peers: &PeerRegistry, addr: SocketAddr) -> Option<Arc<Peer>> {
        peers
            .all()
            .into_iter()
            .find(|peer| peer.direct_addr() == Some(addr))
    }

    fn next_sequence_value(sequence: &AtomicU16) -> u16 {
        sequence.fetch_add(1, AtomicOrdering::Relaxed)
    }

    fn timestamp_for(session_start: Instant) -> u16 {
        (session_start.elapsed().as_millis() % 65536) as u16
    }

    /// Spawn heartbeat loop for peer keepalive
    fn spawn_heartbeat_loop(&self, socket: Arc<TokioUdpSocket>) {
        let running = self.running.clone();
        let peers = self.peers.clone();
        let heartbeat_interval = Duration::from_millis(self.config.heartbeat_interval_ms);
        let peer_timeout = Duration::from_millis(self.config.peer_timeout_ms);
        let event_tx = self.event_tx.read().clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(heartbeat_interval);
            let mut ping_id: u32 = 0;

            while running.load(std::sync::atomic::Ordering::SeqCst) {
                interval.tick().await;

                // Check for timed-out peers and send pings
                for peer in peers.connected() {
                    if peer.idle_duration() > peer_timeout {
                        warn!("Peer {} timed out", peer.id);
                        peer.set_state(PeerState::Closed);

                        if let Some(ref tx) = event_tx {
                            let _ = tx.send(P2PEvent::PeerDisconnected {
                                peer_id: peer.id,
                                reason: "Timeout".to_string(),
                            });
                        }
                        continue;
                    }

                    // Send ping to connected peers
                    if let Some(addr) = peer.direct_addr() {
                        ping_id = ping_id.wrapping_add(1);
                        let ping = PingMessage {
                            ping_id,
                            send_time: ClockSync::now_ms(),
                        };

                        if let Ok(payload) = bincode::serialize(&ping) {
                            let packet = OspPacket::new(
                                OspMessageType::Ping,
                                payload,
                                0, // Sequence not critical for ping
                                0,
                            );

                            if let Err(e) = socket.send_to(&packet.to_bytes(), addr).await {
                                warn!("Failed to send ping to {}: {}", addr, e);
                            }
                        }
                    }
                }
            }

            info!("P2P heartbeat loop stopped");
        });
    }

    /// Stop the P2P network
    pub async fn stop(&self) {
        self.running
            .store(false, std::sync::atomic::Ordering::SeqCst);
        // Disconnect all peers
        for peer in self.peers.all() {
            peer.set_state(PeerState::Closed);
        }
        // Clear socket
        *self.socket.write() = None;
        info!("P2P network stopped");
    }

    /// Join a room
    pub async fn join_room(
        &self,
        room_config: RoomConfig,
        user_id: String,
        user_name: String,
    ) -> Result<()> {
        let peer_id = hash_user_id(&user_id);
        *self.local_user_id.write() = Some(user_id.clone());
        *self.local_user_name.write() = Some(user_name.clone());
        *self.local_peer_id.write() = peer_id;
        *self.room_config.write() = Some(room_config);

        info!("Joining room as {} (peer_id: {})", user_name, peer_id);

        Ok(())
    }

    /// Connect to a specific peer
    pub async fn connect_peer(
        &self,
        addr: SocketAddr,
        user_id: String,
        user_name: String,
    ) -> Result<Arc<Peer>> {
        let peer_id = hash_user_id(&user_id);

        // Check if already connected
        if let Some(existing) = self.peers.get(peer_id) {
            if existing.state() == PeerState::Connected {
                return Ok(existing);
            }
        }

        // Create new peer
        let peer = Peer::new(
            peer_id,
            user_id.clone(),
            user_name.clone(),
            true, // Assume has native bridge for P2P
            "performer".to_string(),
        );
        peer.set_direct_addr(Some(addr));

        let peer = self.peers.add(peer);

        // Send handshake
        self.send_handshake(&peer).await?;

        Ok(peer)
    }

    /// Send handshake to peer
    async fn send_handshake(&self, peer: &Peer) -> Result<()> {
        let local_id = self.local_user_id.read().clone().unwrap_or_default();
        let local_name = self.local_user_name.read().clone().unwrap_or_default();
        let room = self.room_config.read().clone().unwrap_or_default();

        let mut secret_hash = [0u8; 32];
        let hash = blake3::hash(room.room_secret.as_bytes());
        secret_hash.copy_from_slice(hash.as_bytes());

        // Generate ephemeral key pair for this session
        let secret = x25519_dalek::EphemeralSecret::random_from_rng(rand::thread_rng());
        let public = x25519_dalek::PublicKey::from(&secret);

        let handshake = HandshakeMessage {
            protocol_version: 1,
            user_id: local_id,
            user_name: local_name,
            room_id: room.room_id,
            room_secret_hash: secret_hash,
            public_key: *public.as_bytes(),
            has_native_bridge: true,
        };

        let payload = bincode::serialize(&handshake)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        self.send_packet(peer, OspMessageType::Handshake, payload, true)
            .await
    }

    /// Send a packet to a peer
    async fn send_packet(
        &self,
        peer: &Peer,
        msg_type: OspMessageType,
        payload: Vec<u8>,
        reliable: bool,
    ) -> Result<()> {
        let socket =
            self.socket.read().clone().ok_or_else(|| {
                NetworkError::ConnectionFailed("Socket not initialized".to_string())
            })?;

        let addr = peer.direct_addr().ok_or_else(|| {
            NetworkError::ConnectionFailed("Peer has no direct address".to_string())
        })?;

        let sequence = self.next_sequence();
        let timestamp = self.current_timestamp();

        let packet = OspPacket::new(msg_type, payload.clone(), sequence, timestamp);
        let bytes = packet.to_bytes();
        let bytes_len = bytes.len();

        socket.send_to(&bytes, addr).await?;

        // Track reliable messages
        if reliable || msg_type.is_reliable() {
            peer.queue_reliable(sequence, bytes);
        }

        // Update stats
        let mut stats = self.stats.write();
        stats.bytes_sent_per_sec += bytes_len as u64;
        if msg_type == OspMessageType::AudioFrame {
            stats.audio_frames_sent += 1;
        }

        Ok(())
    }

    /// Broadcast a control message to all connected peers
    pub async fn broadcast_control(
        &self,
        msg_type: OspMessageType,
        payload: Vec<u8>,
    ) -> Result<()> {
        for peer in self.peers.connected() {
            if let Err(e) = self
                .send_packet(&peer, msg_type, payload.clone(), msg_type.is_reliable())
                .await
            {
                warn!("Failed to broadcast control to peer {}: {}", peer.id, e);
            }
        }
        Ok(())
    }

    /// Send audio frame to all connected peers
    pub async fn send_audio(&self, track_id: u8, samples: &[f32]) -> Result<()> {
        // Encode with Opus
        let encoded = self.codec.encoder.encode(samples)?;

        let local_id = *self.local_peer_id.read();
        let frame = AudioFrameMessage {
            user_id: local_id,
            track_id,
            codec: 1, // Opus
            channels: self.codec.config.channels,
            sample_count: (samples.len() / self.codec.config.channels as usize) as u16,
            data: encoded,
        };

        let payload = frame.to_bytes();

        // Send to all connected peers
        for peer in self.peers.connected() {
            if let Err(e) = self
                .send_packet(&peer, OspMessageType::AudioFrame, payload.clone(), false)
                .await
            {
                warn!("Failed to send audio to peer {}: {}", peer.id, e);
            }
        }

        Ok(())
    }

    /// Broadcast pre-encoded audio data to all connected peers via UDP.
    /// Uses unreliable delivery (no retransmission) since real-time audio
    /// tolerates packet loss better than retransmission latency.
    /// The caller provides already Opus-encoded data to avoid redundant encoding
    /// when the bridge has already encoded for other paths (e.g., browser WebSocket).
    pub async fn broadcast_encoded_audio(
        &self,
        track_id: u8,
        opus_data: &[u8],
        channels: u8,
        sample_count: u16,
    ) -> Result<()> {
        let local_id = *self.local_peer_id.read();
        let frame = AudioFrameMessage {
            user_id: local_id,
            track_id,
            codec: 1, // Opus
            channels,
            sample_count,
            data: opus_data.to_vec(),
        };

        let payload = frame.to_bytes();

        // Broadcast to all connected peers via unreliable UDP (audio is realtime,
        // retransmission would add latency worse than the occasional lost packet)
        for peer in self.peers.connected() {
            if let Err(e) = self
                .send_packet(&peer, OspMessageType::AudioFrame, payload.clone(), false)
                .await
            {
                warn!(
                    "Failed to broadcast encoded audio to peer {}: {}",
                    peer.id, e
                );
            }
        }

        Ok(())
    }

    /// Queue audio for sending (called from audio thread)
    pub fn queue_audio(&self, track_id: u8, samples: Vec<f32>) {
        let mut outgoing = self.outgoing_audio.write();
        outgoing.push((track_id, samples));
    }

    /// Process queued outgoing audio (called from network thread)
    pub async fn process_outgoing_audio(&self) -> Result<()> {
        let audio: Vec<_> = {
            let mut outgoing = self.outgoing_audio.write();
            std::mem::take(&mut *outgoing)
        };

        for (track_id, samples) in audio {
            self.send_audio(track_id, &samples).await?;
        }

        Ok(())
    }

    /// Handle received packet
    pub async fn handle_packet(&self, from: SocketAddr, data: &[u8]) -> Result<()> {
        let packet = OspPacket::from_bytes(data)
            .ok_or_else(|| NetworkError::Serialization("Invalid packet".to_string()))?;
        let socket =
            self.socket.read().as_ref().cloned().ok_or_else(|| {
                NetworkError::ConnectionFailed("Socket not initialized".to_string())
            })?;
        let room_config = self.room_config.read().clone().ok_or_else(|| {
            NetworkError::ConnectionFailed(
                "join_room must be called before handling packets".to_string(),
            )
        })?;
        let session_start = self.session_start.read().as_ref().copied().ok_or_else(|| {
            NetworkError::ConnectionFailed("Session start time not initialized".to_string())
        })?;
        let event_tx = self.event_tx.read().clone();
        let context = ReceiveContext {
            socket: socket.as_ref(),
            room_config: &room_config,
            peers: &self.peers,
            codec: &self.codec,
            clock: &self.clock,
            stats: self.stats.as_ref(),
            sequence: self.sequence.as_ref(),
            session_start,
            event_tx: event_tx.as_ref(),
        };

        Self::process_received_packet(&packet, from, &context).await
    }

    /// Handle incoming audio frame with sequence tracking
    async fn handle_audio_frame_with_header(
        &self,
        header_seq: u16,
        header_ts: u16,
        payload: &[u8],
    ) -> Result<()> {
        let frame = AudioFrameMessage::from_bytes(payload)
            .ok_or_else(|| NetworkError::Serialization("Invalid audio frame".to_string()))?;

        // Decode audio
        let samples = if frame.codec == 1 {
            // Opus
            self.codec.decoder.decode(&frame.data)?
        } else {
            // PCM (convert from bytes)
            frame
                .data
                .chunks(4)
                .filter_map(|b| {
                    if b.len() == 4 {
                        Some(f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                    } else {
                        None
                    }
                })
                .collect()
        };

        {
            let mut stats = self.stats.write();
            stats.audio_frames_recv += 1;
            stats.audio_samples_recv += samples.len() as u64;
        }

        // Find peer and push to jitter buffer
        if let Some(peer) = self.peers.get(frame.user_id) {
            // Ensure track exists
            if peer.track(frame.track_id).is_none() {
                peer.add_track(
                    frame.track_id,
                    format!("Track {}", frame.track_id),
                    JitterConfig::live_jamming(),
                );
            }

            // Push to jitter buffer with sequence from packet header
            peer.push_audio(frame.track_id, header_seq, header_ts, samples.clone());

            // Emit event
            if let Some(tx) = self.event_tx.read().as_ref() {
                let _ = tx.send(P2PEvent::AudioReceived {
                    peer_id: frame.user_id,
                    track_id: frame.track_id,
                    samples,
                });
            }
        }

        Ok(())
    }

    /// Handle incoming audio frame (legacy without header info)
    async fn handle_audio_frame(&self, payload: &[u8]) -> Result<()> {
        // Use 0 for sequence/timestamp when header info not available
        self.handle_audio_frame_with_header(0, 0, payload).await
    }

    /// Handle audio levels message
    async fn handle_audio_levels(&self, payload: &[u8]) -> Result<()> {
        let msg: AudioLevelsMessage = bincode::deserialize(payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        // Update peer track levels
        if let Some(peer) = self.peers.get(msg.user_id) {
            for (track_id, level, _peak) in msg.track_levels {
                peer.update_track(track_id, None, None, Some(level));
            }
        }

        Ok(())
    }

    /// Handle clock sync message
    async fn handle_clock_sync(&self, payload: &[u8]) -> Result<()> {
        let msg: ClockSyncMessage = bincode::deserialize(payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        // Update local clock
        self.clock.update_beat_position(
            msg.beat_position,
            msg.bpm,
            (msg.time_sig_num, msg.time_sig_denom),
        );

        // Emit event
        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(P2PEvent::ClockSync {
                beat_position: msg.beat_position,
                bpm: msg.bpm,
                time_sig: (msg.time_sig_num, msg.time_sig_denom),
            });
        }

        Ok(())
    }

    /// Handle ping
    async fn handle_ping(&self, from: SocketAddr, packet: &OspPacket) -> Result<()> {
        let ping: PingMessage = bincode::deserialize(&packet.payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        let pong = PongMessage {
            ping_id: ping.ping_id,
            send_time: ping.send_time,
            recv_time: ClockSync::now_ms(),
        };

        let payload =
            bincode::serialize(&pong).map_err(|e| NetworkError::Serialization(e.to_string()))?;

        // Send pong directly
        let socket = self.socket.read().as_ref().cloned();
        if let Some(socket) = socket {
            let response = OspPacket::new(
                OspMessageType::Pong,
                payload,
                self.next_sequence(),
                self.current_timestamp(),
            );
            socket.send_to(&response.to_bytes(), from).await?;
        }

        Ok(())
    }

    /// Handle pong
    async fn handle_pong(&self, from: SocketAddr, packet: &OspPacket) -> Result<()> {
        let pong: PongMessage = bincode::deserialize(&packet.payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        let now = ClockSync::now_ms();
        let rtt = (now - pong.send_time) as f32;

        // Update peer RTT
        if let Some(peer) = self.find_peer_by_addr(from) {
            peer.update_rtt(rtt);
            peer.touch();

            // Process clock sync sample
            let sample = ClockSample {
                t1: pong.send_time,
                t2: pong.recv_time,
                t3: pong.recv_time, // Approximate
                t4: now,
            };
            self.clock.process_sync(sample);
        }

        Ok(())
    }

    /// Handle handshake
    async fn handle_handshake(&self, from: SocketAddr, payload: &[u8]) -> Result<()> {
        let handshake: HandshakeMessage = bincode::deserialize(payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        info!("Received handshake from {} ({})", handshake.user_name, from);

        // Verify room secret
        let room = self.room_config.read().clone().unwrap_or_default();
        let expected_hash = blake3::hash(room.room_secret.as_bytes());
        if handshake.room_secret_hash != *expected_hash.as_bytes() {
            warn!("Handshake failed: invalid room secret");
            return Err(NetworkError::AuthenticationFailed(
                "Invalid room secret".to_string(),
            ));
        }

        // Create or update peer
        let peer_id = hash_user_id(&handshake.user_id);
        let peer = if let Some(existing) = self.peers.get(peer_id) {
            existing.set_state(PeerState::Connected);
            existing.set_direct_addr(Some(from));
            existing
        } else {
            let new_peer = Peer::new(
                peer_id,
                handshake.user_id.clone(),
                handshake.user_name.clone(),
                handshake.has_native_bridge,
                "performer".to_string(),
            );
            new_peer.set_state(PeerState::Connected);
            new_peer.set_direct_addr(Some(from));
            self.peers.add(new_peer)
        };

        // Build current room state for new peer
        let room_state = {
            let users: Vec<UserJoinMessage> = self
                .peers
                .all()
                .iter()
                .map(|p| UserJoinMessage {
                    user_id: p.user_id.clone(),
                    user_name: p.user_name.clone(),
                    avatar_url: p.avatar_url.read().clone(),
                    instrument: p.instrument.read().clone(),
                    has_native_bridge: p.has_native_bridge,
                    role: p.role.read().clone(),
                })
                .collect();

            let tracks: Vec<TrackCreateMessage> = self
                .peers
                .all()
                .iter()
                .flat_map(|p| {
                    p.tracks()
                        .iter()
                        .map(|t| TrackCreateMessage {
                            user_id: p.user_id.clone(),
                            track_id: t.track_id.to_string(),
                            track_name: t.track_name.clone(),
                            track_type: "audio".to_string(),
                            color: "#4f46e5".to_string(),
                            audio_settings: TrackAudioSettings {
                                input_mode: "mono".to_string(),
                                sample_rate: 48000,
                                buffer_size: 480,
                                channel_count: 2,
                            },
                        })
                        .collect::<Vec<_>>()
                })
                .collect();

            RoomStateMessage {
                room_id: room.room_id.clone(),
                users,
                tracks,
                tempo: 120.0,
                key: "C".to_string(),
                scale: "major".to_string(),
                time_signature: (4, 4),
                transport_state: TransportAction::Stop,
                transport_position: 0.0,
            }
        };

        // Send handshake ack
        let ack = HandshakeAckMessage {
            success: true,
            error: None,
            assigned_user_id: Some(peer_id),
            room_state: Some(room_state),
            is_master: self.clock.is_master(),
        };

        let ack_payload =
            bincode::serialize(&ack).map_err(|e| NetworkError::Serialization(e.to_string()))?;

        self.send_packet(&peer, OspMessageType::HandshakeAck, ack_payload, true)
            .await?;

        // Emit event
        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(P2PEvent::PeerConnected {
                peer_id,
                user_name: handshake.user_name,
            });
        }

        Ok(())
    }

    /// Handle handshake ack
    async fn handle_handshake_ack(&self, from: SocketAddr, payload: &[u8]) -> Result<()> {
        let ack: HandshakeAckMessage = bincode::deserialize(payload)
            .map_err(|e| NetworkError::Serialization(e.to_string()))?;

        if !ack.success {
            return Err(NetworkError::AuthenticationFailed(
                ack.error.unwrap_or_else(|| "Unknown error".to_string()),
            ));
        }

        // Update peer state
        if let Some(peer) = self.find_peer_by_addr(from) {
            peer.set_state(PeerState::Connected);

            // Emit event
            if let Some(tx) = self.event_tx.read().as_ref() {
                let _ = tx.send(P2PEvent::PeerConnected {
                    peer_id: peer.id,
                    user_name: peer.user_name.clone(),
                });
            }
        }

        // Handle room state if provided
        if let Some(room_state) = ack.room_state {
            if let Some(tx) = self.event_tx.read().as_ref() {
                let _ = tx.send(P2PEvent::RoomState { state: room_state });
            }
        }

        Ok(())
    }

    /// Find peer by address
    fn find_peer_by_addr(&self, addr: SocketAddr) -> Option<Arc<Peer>> {
        Self::find_peer_by_addr_in_registry(&self.peers, addr)
    }

    /// Get next sequence number
    fn next_sequence(&self) -> u16 {
        Self::next_sequence_value(self.sequence.as_ref())
    }

    /// Get current timestamp
    fn current_timestamp(&self) -> u16 {
        let start = self.session_start.read();
        if let Some(start) = *start {
            Self::timestamp_for(start)
        } else {
            0
        }
    }

    /// Discover public address via STUN
    async fn discover_public_addr(
        &self,
        socket: &TokioUdpSocket,
        stun_server: &str,
    ) -> Result<SocketAddr> {
        // Parse STUN server address
        let addr_str = stun_server.trim_start_matches("stun:");
        let stun_addr: SocketAddr =
            tokio::net::lookup_host(addr_str)
                .await?
                .next()
                .ok_or_else(|| {
                    NetworkError::NatTraversalFailed("Could not resolve STUN server".to_string())
                })?;

        // Simple STUN binding request
        // This is a minimal implementation - a real one would use the stun-rs crate properly
        let binding_request = [
            0x00, 0x01, // Binding Request
            0x00, 0x00, // Message Length
            0x21, 0x12, 0xa4, 0x42, // Magic Cookie
            0x00, 0x00, 0x00, 0x00, // Transaction ID (part 1)
            0x00, 0x00, 0x00, 0x01, // Transaction ID (part 2)
            0x00, 0x00, 0x00, 0x02, // Transaction ID (part 3)
        ];

        socket.send_to(&binding_request, stun_addr).await?;

        let mut buf = [0u8; 256];
        let timeout = Duration::from_secs(3);

        match tokio::time::timeout(timeout, socket.recv_from(&mut buf)).await {
            Ok(Ok((len, _))) => {
                // Parse XOR-MAPPED-ADDRESS from response
                // This is simplified - real implementation would parse properly
                if len > 20 {
                    // Find XOR-MAPPED-ADDRESS attribute (type 0x0020)
                    let mut i = 20;
                    while i + 4 < len {
                        let attr_type = u16::from_be_bytes([buf[i], buf[i + 1]]);
                        let attr_len = u16::from_be_bytes([buf[i + 2], buf[i + 3]]) as usize;

                        if attr_type == 0x0020 && attr_len >= 8 {
                            // XOR-MAPPED-ADDRESS found
                            let xor_port = u16::from_be_bytes([buf[i + 6], buf[i + 7]]) ^ 0x2112;
                            let xor_ip = u32::from_be_bytes([
                                buf[i + 8],
                                buf[i + 9],
                                buf[i + 10],
                                buf[i + 11],
                            ]) ^ 0x2112a442;
                            let ip = std::net::Ipv4Addr::from(xor_ip);
                            return Ok(SocketAddr::new(ip.into(), xor_port));
                        }

                        i += 4 + attr_len + (4 - (attr_len % 4)) % 4; // Padding
                    }
                }
                Err(NetworkError::NatTraversalFailed(
                    "Could not parse STUN response".to_string(),
                ))
            }
            Ok(Err(e)) => Err(NetworkError::Io(e)),
            Err(_) => Err(NetworkError::NatTraversalFailed("STUN timeout".to_string())),
        }
    }

    /// Get peers
    pub fn peers(&self) -> &PeerRegistry {
        &self.peers
    }

    /// Get the UDP socket address currently bound by this peer.
    pub fn local_addr(&self) -> Result<SocketAddr> {
        let socket =
            self.socket.read().as_ref().cloned().ok_or_else(|| {
                NetworkError::ConnectionFailed("Socket not initialized".to_string())
            })?;
        socket.local_addr().map_err(NetworkError::Io)
    }

    /// Get the public UDP endpoint discovered through STUN, when available.
    pub fn public_addr(&self) -> Option<SocketAddr> {
        *self.public_addr.read()
    }

    /// Get clock
    pub fn clock(&self) -> &ClockSync {
        &self.clock
    }

    /// Get stats
    pub fn stats(&self) -> NetworkStats {
        let mut stats = self.stats.read().clone();
        stats.peer_count = self.peers.connected_count();
        stats.clock_offset_ms = self.clock.state().offset_ms as f32;
        stats
    }

    /// Is running
    pub fn is_running(&self) -> bool {
        self.running.load(std::sync::atomic::Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::Rng;
    use tokio::task::JoinHandle;
    use tokio::time::{sleep, timeout};

    const TEST_TRACK_ID: u8 = 0;
    const TEST_ROOM_ID: &str = "bridge-audio-test-room";
    const TEST_ROOM_SECRET: &str = "bridge-audio-test-secret";

    #[derive(Clone, Copy)]
    struct NetworkProfile {
        base_delay: Duration,
        jitter: Duration,
        loss_ratio: f32,
    }

    impl NetworkProfile {
        fn sample_delay(self) -> Duration {
            if self.jitter.is_zero() {
                return self.base_delay;
            }

            let jitter_ms = self.jitter.as_millis() as i64;
            let offset_ms = rand::thread_rng().gen_range(-jitter_ms..=jitter_ms);
            let base_ms = self.base_delay.as_millis() as i64;
            Duration::from_millis((base_ms + offset_ms).max(0) as u64)
        }

        fn should_drop(self) -> bool {
            self.loss_ratio > 0.0 && rand::thread_rng().gen_bool(self.loss_ratio as f64)
        }
    }

    struct BidirectionalUdpProxy {
        endpoint_for_a: SocketAddr,
        _endpoint_for_b: SocketAddr,
        _socket_for_a: Arc<TokioUdpSocket>,
        _socket_for_b: Arc<TokioUdpSocket>,
        forward_ab: JoinHandle<()>,
        forward_ba: JoinHandle<()>,
    }

    impl BidirectionalUdpProxy {
        async fn start(
            a_real_addr: SocketAddr,
            b_real_addr: SocketAddr,
            profile: NetworkProfile,
        ) -> std::io::Result<Self> {
            let socket_for_a =
                Arc::new(TokioUdpSocket::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?);
            let socket_for_b =
                Arc::new(TokioUdpSocket::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?);

            let endpoint_for_a = socket_for_a.local_addr()?;
            let endpoint_for_b = socket_for_b.local_addr()?;

            let forward_ab = Self::spawn_forwarder(
                socket_for_a.clone(),
                socket_for_b.clone(),
                b_real_addr,
                profile,
            );
            let forward_ba = Self::spawn_forwarder(
                socket_for_b.clone(),
                socket_for_a.clone(),
                a_real_addr,
                profile,
            );

            Ok(Self {
                endpoint_for_a,
                _endpoint_for_b: endpoint_for_b,
                _socket_for_a: socket_for_a,
                _socket_for_b: socket_for_b,
                forward_ab,
                forward_ba,
            })
        }

        fn spawn_forwarder(
            receive_socket: Arc<TokioUdpSocket>,
            send_socket: Arc<TokioUdpSocket>,
            target_addr: SocketAddr,
            profile: NetworkProfile,
        ) -> JoinHandle<()> {
            tokio::spawn(async move {
                let mut buf = [0u8; 2048];

                loop {
                    match receive_socket.recv_from(&mut buf).await {
                        Ok((len, _)) if len > 0 => {
                            if profile.should_drop() {
                                continue;
                            }

                            let packet = buf[..len].to_vec();
                            let send_socket = send_socket.clone();
                            let delay = profile.sample_delay();
                            tokio::spawn(async move {
                                if !delay.is_zero() {
                                    sleep(delay).await;
                                }
                                let _ = send_socket.send_to(&packet, target_addr).await;
                            });
                        }
                        Ok(_) => {}
                        Err(_) => break,
                    }
                }
            })
        }
    }

    impl Drop for BidirectionalUdpProxy {
        fn drop(&mut self) {
            self.forward_ab.abort();
            self.forward_ba.abort();
        }
    }

    fn test_p2p_config() -> P2PConfig {
        P2PConfig {
            bind_addr: SocketAddr::from(([127, 0, 0, 1], 0)),
            stun_server: None,
            max_peers: 2,
            heartbeat_interval_ms: 50,
            peer_timeout_ms: 2_000,
            reliable_timeout_ms: 100,
            max_retries: 3,
        }
    }

    fn test_room_config() -> RoomConfig {
        RoomConfig {
            room_id: TEST_ROOM_ID.to_string(),
            room_secret: TEST_ROOM_SECRET.to_string(),
            max_performers: 2,
            max_listeners: 0,
            sample_rate: 48_000,
            require_native_bridge: true,
        }
    }

    async fn start_peer(
        user_id: &str,
        user_name: &str,
    ) -> (P2PNetwork, broadcast::Receiver<P2PEvent>) {
        let peer = P2PNetwork::new(test_p2p_config()).expect("create test peer");
        peer.join_room(
            test_room_config(),
            user_id.to_string(),
            user_name.to_string(),
        )
        .await
        .expect("join room before start");
        let event_rx = peer.start().await.expect("start test peer");
        (peer, event_rx)
    }

    async fn wait_for_connected_peer_count(network: &P2PNetwork, expected: usize) {
        timeout(Duration::from_secs(3), async {
            loop {
                if network.peers().connected_count() >= expected {
                    return;
                }
                sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("timed out waiting for peer connection");
    }

    async fn wait_for_peer_rtt(network: &P2PNetwork, peer_id: u32, minimum_rtt_ms: f32) -> f32 {
        timeout(Duration::from_secs(3), async {
            loop {
                if let Some(peer) = network.peers().get(peer_id) {
                    let rtt_ms = peer.rtt_ms();
                    if rtt_ms >= minimum_rtt_ms {
                        return rtt_ms;
                    }
                }
                sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap_or_else(|_| panic!("timed out waiting for RTT >= {:.1}ms", minimum_rtt_ms))
    }

    async fn collect_audio_frames(
        event_rx: &mut broadcast::Receiver<P2PEvent>,
        expected_peer_id: u32,
        expected_track_id: u8,
        expected_frames: usize,
        sent_at: Instant,
        timeout_duration: Duration,
    ) -> (Vec<f32>, Duration) {
        timeout(timeout_duration, async {
            let mut received = Vec::new();
            let mut frames = 0usize;
            let mut first_frame_latency = None;

            loop {
                match event_rx.recv().await {
                    Ok(P2PEvent::AudioReceived {
                        peer_id,
                        track_id,
                        samples,
                    }) if peer_id == expected_peer_id && track_id == expected_track_id => {
                        if first_frame_latency.is_none() {
                            first_frame_latency = Some(sent_at.elapsed());
                        }
                        received.extend(samples);
                        frames += 1;
                        if frames == expected_frames {
                            return (
                                received,
                                first_frame_latency.expect("latency should be recorded"),
                            );
                        }
                    }
                    Ok(_) => {}
                    Err(err) => panic!("event channel error while collecting audio: {}", err),
                }
            }
        })
        .await
        .expect("timed out waiting for audio frames")
    }

    fn build_test_signal(frame_count: usize, frame_len: usize) -> Vec<f32> {
        (0..frame_count * frame_len)
            .map(|i| {
                let phase = i as f32 * 0.041;
                (phase.sin() * 0.35) + ((phase * 0.53).sin() * 0.18)
            })
            .collect()
    }

    fn correlation(a: &[f32], b: &[f32]) -> f32 {
        let mean_a = a.iter().copied().sum::<f32>() / a.len() as f32;
        let mean_b = b.iter().copied().sum::<f32>() / b.len() as f32;

        let mut numerator = 0.0;
        let mut denom_a = 0.0;
        let mut denom_b = 0.0;

        for (sample_a, sample_b) in a.iter().zip(b.iter()) {
            let centered_a = *sample_a - mean_a;
            let centered_b = *sample_b - mean_b;
            numerator += centered_a * centered_b;
            denom_a += centered_a * centered_a;
            denom_b += centered_b * centered_b;
        }

        if denom_a == 0.0 || denom_b == 0.0 {
            return 0.0;
        }

        numerator / (denom_a.sqrt() * denom_b.sqrt())
    }

    fn best_alignment_correlation(reference: &[f32], decoded: &[f32], max_lag: usize) -> f32 {
        let mut best = f32::NEG_INFINITY;

        for lag in -(max_lag as isize)..=(max_lag as isize) {
            let (reference_slice, decoded_slice) = if lag >= 0 {
                let lag = lag as usize;
                let overlap = reference.len().saturating_sub(lag);
                if overlap < 128 {
                    continue;
                }
                (&reference[..overlap], &decoded[lag..lag + overlap])
            } else {
                let lag = (-lag) as usize;
                let overlap = decoded.len().saturating_sub(lag);
                if overlap < 128 {
                    continue;
                }
                (&reference[lag..lag + overlap], &decoded[..overlap])
            };

            best = best.max(correlation(reference_slice, decoded_slice));
        }

        best
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn test_audio_transmission_end_to_end_between_two_peers() {
        let (sender, _sender_rx) = start_peer("bridge-a", "Bridge A").await;
        let (receiver, mut receiver_rx) = start_peer("bridge-b", "Bridge B").await;

        sender
            .connect_peer(
                receiver.local_addr().expect("receiver local addr"),
                "bridge-b".to_string(),
                "Bridge B".to_string(),
            )
            .await
            .expect("connect sender to receiver");

        wait_for_connected_peer_count(&sender, 1).await;
        wait_for_connected_peer_count(&receiver, 1).await;

        let sender_peer_id = hash_user_id("bridge-a");
        let receiver_peer_id = hash_user_id("bridge-b");
        let sender_rtt = wait_for_peer_rtt(&sender, receiver_peer_id, 0.1).await;

        let codec = OpusCodec::low_latency().expect("low-latency codec");
        let frame_len = codec.config.frame_size * codec.config.channels as usize;
        let frame_count = 8usize;
        let signal = build_test_signal(frame_count, frame_len);

        let sent_at = Instant::now();
        for frame in signal.chunks(frame_len) {
            sender
                .send_audio(TEST_TRACK_ID, frame)
                .await
                .expect("send test audio");
            sleep(Duration::from_millis(2)).await;
        }

        let (received, one_way_latency) = collect_audio_frames(
            &mut receiver_rx,
            sender_peer_id,
            TEST_TRACK_ID,
            frame_count,
            sent_at,
            Duration::from_secs(3),
        )
        .await;

        let receiver_peer = receiver
            .peers()
            .get(sender_peer_id)
            .expect("receiver peer registry entry");
        let correlation = best_alignment_correlation(&signal, &received, frame_len);

        assert_eq!(received.len(), signal.len());
        assert!(
            correlation > 0.90,
            "decoded signal correlation too low: {:.3}",
            correlation
        );
        assert!(
            one_way_latency < Duration::from_millis(75),
            "loopback one-way latency too high: {:?}",
            one_way_latency
        );
        assert!(
            sender_rtt < 50.0,
            "loopback RTT unexpectedly high: {:.1}ms",
            sender_rtt
        );
        assert!(
            receiver_peer.audio_packets_received() >= frame_count as u64,
            "receiver only recorded {} audio packets",
            receiver_peer.audio_packets_received()
        );

        eprintln!(
            "loopback audio latency: {:?}, RTT: {:.1}ms, correlation: {:.3}",
            one_way_latency, sender_rtt, correlation
        );

        sender.stop().await;
        receiver.stop().await;
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn test_audio_transmission_with_simulated_network_delay() {
        let (sender, _sender_rx) = start_peer("bridge-a-proxy", "Bridge A Proxy").await;
        let (receiver, mut receiver_rx) = start_peer("bridge-b-proxy", "Bridge B Proxy").await;

        let proxy = BidirectionalUdpProxy::start(
            sender.local_addr().expect("sender local addr"),
            receiver.local_addr().expect("receiver local addr"),
            NetworkProfile {
                base_delay: Duration::from_millis(30),
                jitter: Duration::ZERO,
                loss_ratio: 0.0,
            },
        )
        .await
        .expect("start simulated network proxy");

        sender
            .connect_peer(
                proxy.endpoint_for_a,
                "bridge-b-proxy".to_string(),
                "Bridge B Proxy".to_string(),
            )
            .await
            .expect("connect sender through proxy");

        wait_for_connected_peer_count(&sender, 1).await;
        wait_for_connected_peer_count(&receiver, 1).await;

        let sender_peer_id = hash_user_id("bridge-a-proxy");
        let receiver_peer_id = hash_user_id("bridge-b-proxy");
        let sender_rtt = wait_for_peer_rtt(&sender, receiver_peer_id, 35.0).await;

        let codec = OpusCodec::low_latency().expect("low-latency codec");
        let frame_len = codec.config.frame_size * codec.config.channels as usize;
        let frame_count = 10usize;
        let signal = build_test_signal(frame_count, frame_len);

        let sent_at = Instant::now();
        for frame in signal.chunks(frame_len) {
            sender
                .send_audio(TEST_TRACK_ID, frame)
                .await
                .expect("send proxied audio");
            sleep(Duration::from_millis(4)).await;
        }

        let (received, one_way_latency) = collect_audio_frames(
            &mut receiver_rx,
            sender_peer_id,
            TEST_TRACK_ID,
            frame_count,
            sent_at,
            Duration::from_secs(5),
        )
        .await;

        let correlation = best_alignment_correlation(&signal, &received, frame_len);
        assert_eq!(received.len(), signal.len());
        assert!(
            correlation > 0.85,
            "proxied signal correlation too low: {:.3}",
            correlation
        );
        assert!(
            one_way_latency >= Duration::from_millis(20),
            "simulated network latency too low to reflect injected delay: {:?}",
            one_way_latency
        );
        assert!(
            sender_rtt >= 35.0,
            "simulated network RTT too low: {:.1}ms",
            sender_rtt
        );

        eprintln!(
            "proxied audio latency: {:?}, RTT: {:.1}ms, correlation: {:.3}",
            one_way_latency, sender_rtt, correlation
        );

        drop(proxy);
        sender.stop().await;
        receiver.stop().await;
    }
}
