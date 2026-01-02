//! P2P Networking Layer
//!
//! UDP-based peer-to-peer audio streaming inspired by AOO.
//! Handles NAT traversal, direct connections, and mesh topology.

use super::{
    clock::*, codec::*, jitter::*, osp::*, peer::*, NetworkError, NetworkStats, Result, RoomConfig,
};
use dashmap::DashMap;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::{SocketAddr, UdpSocket};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket as TokioUdpSocket;
use tokio::sync::{broadcast, mpsc};
use tracing::{debug, error, info, warn};

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
            bind_addr: "0.0.0.0:0".parse().unwrap(),
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
    ClockSync { beat_position: f64, bpm: f32 },
    /// Network stats update
    StatsUpdate { stats: NetworkStats },
    /// Room state received
    RoomState { state: RoomStateMessage },
}

/// P2P network manager
pub struct P2PNetwork {
    config: P2PConfig,
    socket: Option<Arc<TokioUdpSocket>>,
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
    sequence: RwLock<u16>,
    /// Session start time for timestamp calculation
    session_start: RwLock<Option<Instant>>,
    /// Event sender
    event_tx: RwLock<Option<broadcast::Sender<P2PEvent>>>,
    /// Our public address (from STUN)
    public_addr: RwLock<Option<SocketAddr>>,
    /// Is running
    running: RwLock<bool>,
    /// Audio output buffer (peer_id, track_id) -> samples
    audio_output: DashMap<(u32, u8), Vec<f32>>,
    /// Stats
    stats: RwLock<NetworkStats>,
    /// Pending outgoing audio
    outgoing_audio: RwLock<Vec<(u8, Vec<f32>)>>,
}

impl P2PNetwork {
    pub fn new(config: P2PConfig) -> Result<Self> {
        let codec = OpusCodec::low_latency()?;

        Ok(Self {
            config,
            socket: None,
            peers: Arc::new(PeerRegistry::new()),
            clock: Arc::new(ClockSync::new(ClockConfig::default())),
            codec: Arc::new(codec),
            local_user_id: RwLock::new(None),
            local_user_name: RwLock::new(None),
            local_peer_id: RwLock::new(0),
            room_config: RwLock::new(None),
            sequence: RwLock::new(0),
            session_start: RwLock::new(None),
            event_tx: RwLock::new(None),
            public_addr: RwLock::new(None),
            running: RwLock::new(false),
            audio_output: DashMap::new(),
            stats: RwLock::new(NetworkStats::default()),
            outgoing_audio: RwLock::new(Vec::new()),
        })
    }

    /// Start the P2P network
    pub async fn start(&self) -> Result<broadcast::Receiver<P2PEvent>> {
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
        *self.session_start.write() = Some(Instant::now());
        *self.running.write() = true;

        // Create event channel
        let (tx, rx) = broadcast::channel(1000);
        *self.event_tx.write() = Some(tx);

        // Store socket
        // Note: In real implementation, spawn receive/send loops here
        // For now, we'll handle this in the manager

        Ok(rx)
    }

    /// Stop the P2P network
    pub async fn stop(&self) {
        *self.running.write() = false;
        // Disconnect all peers
        for peer in self.peers.all() {
            peer.set_state(PeerState::Closed);
        }
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
        let secret = x25519_dalek::StaticSecret::random_from_rng(&mut rand::thread_rng());
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
        let socket = self
            .socket
            .as_ref()
            .ok_or_else(|| NetworkError::ConnectionFailed("Socket not initialized".to_string()))?;

        let addr = peer.direct_addr().ok_or_else(|| {
            NetworkError::ConnectionFailed("Peer has no direct address".to_string())
        })?;

        let sequence = self.next_sequence();
        let timestamp = self.current_timestamp();

        let packet = OspPacket::new(msg_type, payload.clone(), sequence, timestamp);
        let bytes = packet.to_bytes();

        socket.send_to(&bytes, addr).await?;

        // Track reliable messages
        if reliable || msg_type.is_reliable() {
            peer.queue_reliable(sequence, bytes);
        }

        // Update stats
        let mut stats = self.stats.write();
        stats.bytes_sent_per_sec += bytes.len() as u64;

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

        match packet.message_type {
            OspMessageType::AudioFrame => {
                // Use sequence and timestamp from packet header for jitter buffer
                self.handle_audio_frame_with_header(
                    packet.sequence,
                    packet.timestamp,
                    &packet.payload,
                )
                .await?;
            }
            OspMessageType::AudioLevels => {
                self.handle_audio_levels(&packet.payload).await?;
            }
            OspMessageType::ClockSync => {
                self.handle_clock_sync(&packet.payload).await?;
            }
            OspMessageType::Ping => {
                self.handle_ping(from, &packet).await?;
            }
            OspMessageType::Pong => {
                self.handle_pong(from, &packet).await?;
            }
            OspMessageType::Handshake => {
                self.handle_handshake(from, &packet.payload).await?;
            }
            OspMessageType::HandshakeAck => {
                self.handle_handshake_ack(from, &packet.payload).await?;
            }
            _ => {
                // Forward control messages as events
                if let Some(tx) = self.event_tx.read().as_ref() {
                    // Find peer by address
                    if let Some(peer) = self.find_peer_by_addr(from) {
                        let _ = tx.send(P2PEvent::ControlMessage {
                            peer_id: peer.id,
                            message_type: packet.message_type,
                            payload: packet.payload,
                        });
                    }
                }
            }
        }

        Ok(())
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
        if let Some(socket) = self.socket.as_ref() {
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
            let clock_state = self.clock.state();
            let peers: Vec<(u32, String, String, bool)> = self
                .peers
                .all()
                .iter()
                .map(|p| {
                    (
                        p.id,
                        p.user_id.clone(),
                        p.user_name.clone(),
                        p.has_native_bridge,
                    )
                })
                .collect();
            let tracks: Vec<(u32, u8, String, bool, f32, f32)> = self
                .peers
                .all()
                .iter()
                .flat_map(|p| {
                    p.all_tracks()
                        .iter()
                        .map(|t| (p.id, t.track_id, t.name.clone(), t.muted, t.volume, t.pan))
                        .collect::<Vec<_>>()
                })
                .collect();

            RoomStateMessage {
                room_id: room.room_id.clone(),
                bpm: clock_state.bpm,
                time_sig_num: clock_state.time_signature.0,
                time_sig_denom: clock_state.time_signature.1,
                beat_position: clock_state.beat_position,
                is_playing: false,
                master_user_id: if self.clock.is_master() {
                    *self.local_peer_id.read()
                } else {
                    0
                },
                peers,
                tracks,
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
        self.peers
            .all()
            .into_iter()
            .find(|p| p.direct_addr() == Some(addr))
    }

    /// Get next sequence number
    fn next_sequence(&self) -> u16 {
        let mut seq = self.sequence.write();
        let current = *seq;
        *seq = seq.wrapping_add(1);
        current
    }

    /// Get current timestamp
    fn current_timestamp(&self) -> u16 {
        let start = self.session_start.read();
        if let Some(start) = *start {
            (start.elapsed().as_millis() % 65536) as u16
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
        *self.running.read()
    }
}
