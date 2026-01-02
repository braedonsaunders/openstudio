//! Peer Management
//!
//! Represents a connected peer in the P2P network or relay.

use super::{JitterBuffer, JitterConfig, ClockSync};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

/// Peer connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeerState {
    /// Initial state, handshake in progress
    Connecting,
    /// Handshake complete, ready for data
    Connected,
    /// Temporarily unreachable
    Disconnected,
    /// Permanently removed
    Closed,
}

/// Peer quality tier based on latency
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QualityTier {
    /// <20ms RTT - excellent for tight jamming
    Excellent,
    /// 20-50ms RTT - good for most purposes
    Good,
    /// 50-100ms RTT - noticeable but usable
    Fair,
    /// >100ms RTT - difficult for real-time
    Poor,
}

impl QualityTier {
    pub fn from_rtt_ms(rtt: f32) -> Self {
        if rtt < 20.0 {
            QualityTier::Excellent
        } else if rtt < 50.0 {
            QualityTier::Good
        } else if rtt < 100.0 {
            QualityTier::Fair
        } else {
            QualityTier::Poor
        }
    }
}

/// Peer track information
#[derive(Debug, Clone)]
pub struct PeerTrack {
    pub track_id: u8,
    pub track_name: String,
    pub is_muted: bool,
    pub is_solo: bool,
    pub volume: f32,
    pub jitter_buffer: Arc<JitterBuffer>,
}

impl PeerTrack {
    pub fn new(track_id: u8, track_name: String, jitter_config: JitterConfig) -> Self {
        Self {
            track_id,
            track_name,
            is_muted: false,
            is_solo: false,
            volume: 1.0,
            jitter_buffer: Arc::new(JitterBuffer::new(jitter_config)),
        }
    }
}

/// A connected peer
pub struct Peer {
    /// Unique peer ID (hash of user_id)
    pub id: u32,
    /// User ID string
    pub user_id: String,
    /// Display name
    pub user_name: String,
    /// Current state
    state: RwLock<PeerState>,
    /// Direct address for P2P (None if relay-only)
    pub direct_addr: RwLock<Option<SocketAddr>>,
    /// Whether this peer has native bridge
    pub has_native_bridge: bool,
    /// User's role in the room
    pub role: RwLock<String>,
    /// Peer's tracks
    tracks: RwLock<HashMap<u8, PeerTrack>>,
    /// Round-trip time in ms
    rtt_ms: RwLock<f32>,
    /// Jitter in ms
    jitter_ms: RwLock<f32>,
    /// Packet loss percentage
    packet_loss: RwLock<f32>,
    /// Last activity time
    last_activity: RwLock<Instant>,
    /// Pending reliable messages (sequence -> message bytes)
    pending_reliable: RwLock<HashMap<u16, (Vec<u8>, Instant)>>,
    /// Last acknowledged sequence
    last_ack_sequence: RwLock<u16>,
    /// Sequence counter for sending
    send_sequence: RwLock<u16>,
    /// Clock sync samples for this peer
    clock_samples: RwLock<Vec<(u64, u64, u64, u64)>>,
    /// Compensation delay in samples
    compensation_delay: RwLock<usize>,
    /// Whether this peer is the master clock
    is_master: RwLock<bool>,
    /// Avatar URL
    pub avatar_url: RwLock<Option<String>>,
    /// Instrument
    pub instrument: RwLock<Option<String>>,
}

impl Peer {
    pub fn new(
        id: u32,
        user_id: String,
        user_name: String,
        has_native_bridge: bool,
        role: String,
    ) -> Self {
        Self {
            id,
            user_id,
            user_name,
            state: RwLock::new(PeerState::Connecting),
            direct_addr: RwLock::new(None),
            has_native_bridge,
            role: RwLock::new(role),
            tracks: RwLock::new(HashMap::new()),
            rtt_ms: RwLock::new(0.0),
            jitter_ms: RwLock::new(0.0),
            packet_loss: RwLock::new(0.0),
            last_activity: RwLock::new(Instant::now()),
            pending_reliable: RwLock::new(HashMap::new()),
            last_ack_sequence: RwLock::new(0),
            send_sequence: RwLock::new(0),
            clock_samples: RwLock::new(Vec::new()),
            compensation_delay: RwLock::new(0),
            is_master: RwLock::new(false),
            avatar_url: RwLock::new(None),
            instrument: RwLock::new(None),
        }
    }

    /// Get current state
    pub fn state(&self) -> PeerState {
        *self.state.read()
    }

    /// Set state
    pub fn set_state(&self, state: PeerState) {
        *self.state.write() = state;
    }

    /// Update activity timestamp
    pub fn touch(&self) {
        *self.last_activity.write() = Instant::now();
    }

    /// Get time since last activity
    pub fn idle_duration(&self) -> std::time::Duration {
        self.last_activity.read().elapsed()
    }

    /// Get RTT
    pub fn rtt_ms(&self) -> f32 {
        *self.rtt_ms.read()
    }

    /// Update RTT (exponential moving average)
    pub fn update_rtt(&self, rtt: f32) {
        let mut current = self.rtt_ms.write();
        *current = *current * 0.8 + rtt * 0.2;
    }

    /// Get jitter
    pub fn jitter_ms(&self) -> f32 {
        *self.jitter_ms.read()
    }

    /// Update jitter
    pub fn update_jitter(&self, jitter: f32) {
        let mut current = self.jitter_ms.write();
        *current = *current * 0.9 + jitter * 0.1;
    }

    /// Get packet loss
    pub fn packet_loss(&self) -> f32 {
        *self.packet_loss.read()
    }

    /// Update packet loss
    pub fn update_packet_loss(&self, loss: f32) {
        let mut current = self.packet_loss.write();
        *current = *current * 0.95 + loss * 0.05;
    }

    /// Get quality tier
    pub fn quality_tier(&self) -> QualityTier {
        QualityTier::from_rtt_ms(self.rtt_ms())
    }

    /// Get quality score (0-100)
    pub fn quality_score(&self) -> u8 {
        let rtt_score = (100.0 - self.rtt_ms()).max(0.0).min(100.0);
        let jitter_penalty = self.jitter_ms() * 2.0;
        let loss_penalty = self.packet_loss() * 5.0;

        ((rtt_score - jitter_penalty - loss_penalty).max(0.0).min(100.0)) as u8
    }

    /// Add a track
    pub fn add_track(&self, track_id: u8, track_name: String, jitter_config: JitterConfig) {
        let mut tracks = self.tracks.write();
        tracks.insert(track_id, PeerTrack::new(track_id, track_name, jitter_config));
    }

    /// Remove a track
    pub fn remove_track(&self, track_id: u8) {
        let mut tracks = self.tracks.write();
        tracks.remove(&track_id);
    }

    /// Get track
    pub fn track(&self, track_id: u8) -> Option<PeerTrack> {
        self.tracks.read().get(&track_id).cloned()
    }

    /// Get all tracks
    pub fn tracks(&self) -> Vec<PeerTrack> {
        self.tracks.read().values().cloned().collect()
    }

    /// Update track state
    pub fn update_track(&self, track_id: u8, muted: Option<bool>, solo: Option<bool>, volume: Option<f32>) {
        if let Some(track) = self.tracks.write().get_mut(&track_id) {
            if let Some(m) = muted {
                track.is_muted = m;
            }
            if let Some(s) = solo {
                track.is_solo = s;
            }
            if let Some(v) = volume {
                track.volume = v;
            }
        }
    }

    /// Push audio to a track's jitter buffer
    pub fn push_audio(&self, track_id: u8, sequence: u16, timestamp: u16, samples: Vec<f32>) {
        if let Some(track) = self.tracks.read().get(&track_id) {
            track.jitter_buffer.push(sequence, timestamp, samples);
        }
    }

    /// Pop audio from a track's jitter buffer
    pub fn pop_audio(&self, track_id: u8) -> Option<Vec<f32>> {
        if let Some(track) = self.tracks.read().get(&track_id) {
            track.jitter_buffer.pop()
        } else {
            None
        }
    }

    /// Get next send sequence number
    pub fn next_sequence(&self) -> u16 {
        let mut seq = self.send_sequence.write();
        let current = *seq;
        *seq = seq.wrapping_add(1);
        current
    }

    /// Queue a reliable message for acknowledgment tracking
    pub fn queue_reliable(&self, sequence: u16, data: Vec<u8>) {
        let mut pending = self.pending_reliable.write();
        pending.insert(sequence, (data, Instant::now()));
    }

    /// Acknowledge a reliable message
    pub fn acknowledge(&self, sequence: u16) {
        let mut pending = self.pending_reliable.write();
        pending.remove(&sequence);
        let mut last_ack = self.last_ack_sequence.write();
        *last_ack = sequence;
    }

    /// Get messages that need to be resent (no ack after timeout)
    pub fn get_resend_messages(&self, timeout_ms: u64) -> Vec<(u16, Vec<u8>)> {
        let pending = self.pending_reliable.read();
        let now = Instant::now();

        pending
            .iter()
            .filter(|(_, (_, sent))| now.duration_since(*sent).as_millis() as u64 > timeout_ms)
            .map(|(seq, (data, _))| (*seq, data.clone()))
            .collect()
    }

    /// Get compensation delay
    pub fn compensation_delay(&self) -> usize {
        *self.compensation_delay.read()
    }

    /// Set compensation delay
    pub fn set_compensation_delay(&self, delay: usize) {
        *self.compensation_delay.write() = delay;
    }

    /// Check if this peer is master
    pub fn is_master(&self) -> bool {
        *self.is_master.read()
    }

    /// Set master status
    pub fn set_master(&self, is_master: bool) {
        *self.is_master.write() = is_master;
    }

    /// Get direct address
    pub fn direct_addr(&self) -> Option<SocketAddr> {
        *self.direct_addr.read()
    }

    /// Set direct address
    pub fn set_direct_addr(&self, addr: Option<SocketAddr>) {
        *self.direct_addr.write() = addr;
    }
}

impl std::fmt::Debug for Peer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Peer")
            .field("id", &self.id)
            .field("user_id", &self.user_id)
            .field("user_name", &self.user_name)
            .field("state", &self.state())
            .field("has_native_bridge", &self.has_native_bridge)
            .field("rtt_ms", &self.rtt_ms())
            .field("quality_tier", &self.quality_tier())
            .finish()
    }
}

/// Peer registry for managing all connected peers
pub struct PeerRegistry {
    peers: RwLock<HashMap<u32, Arc<Peer>>>,
    /// User ID to peer ID mapping
    user_to_peer: RwLock<HashMap<String, u32>>,
}

impl PeerRegistry {
    pub fn new() -> Self {
        Self {
            peers: RwLock::new(HashMap::new()),
            user_to_peer: RwLock::new(HashMap::new()),
        }
    }

    /// Add a peer
    pub fn add(&self, peer: Peer) -> Arc<Peer> {
        let id = peer.id;
        let user_id = peer.user_id.clone();
        let peer = Arc::new(peer);

        self.peers.write().insert(id, peer.clone());
        self.user_to_peer.write().insert(user_id, id);

        peer
    }

    /// Remove a peer
    pub fn remove(&self, id: u32) -> Option<Arc<Peer>> {
        let peer = self.peers.write().remove(&id);
        if let Some(ref p) = peer {
            self.user_to_peer.write().remove(&p.user_id);
        }
        peer
    }

    /// Get a peer by ID
    pub fn get(&self, id: u32) -> Option<Arc<Peer>> {
        self.peers.read().get(&id).cloned()
    }

    /// Get a peer by user ID
    pub fn get_by_user_id(&self, user_id: &str) -> Option<Arc<Peer>> {
        let peer_id = *self.user_to_peer.read().get(user_id)?;
        self.get(peer_id)
    }

    /// Get all peers
    pub fn all(&self) -> Vec<Arc<Peer>> {
        self.peers.read().values().cloned().collect()
    }

    /// Get all connected peers
    pub fn connected(&self) -> Vec<Arc<Peer>> {
        self.peers
            .read()
            .values()
            .filter(|p| p.state() == PeerState::Connected)
            .cloned()
            .collect()
    }

    /// Get peer count
    pub fn count(&self) -> usize {
        self.peers.read().len()
    }

    /// Get connected peer count
    pub fn connected_count(&self) -> usize {
        self.peers
            .read()
            .values()
            .filter(|p| p.state() == PeerState::Connected)
            .count()
    }

    /// Find the current master
    pub fn master(&self) -> Option<Arc<Peer>> {
        self.peers
            .read()
            .values()
            .find(|p| p.is_master())
            .cloned()
    }

    /// Get average RTT across all peers
    pub fn average_rtt(&self) -> f32 {
        let peers = self.connected();
        if peers.is_empty() {
            return 0.0;
        }
        peers.iter().map(|p| p.rtt_ms()).sum::<f32>() / peers.len() as f32
    }

    /// Get maximum RTT
    pub fn max_rtt(&self) -> f32 {
        self.connected()
            .iter()
            .map(|p| p.rtt_ms())
            .fold(0.0f32, f32::max)
    }
}

impl Default for PeerRegistry {
    fn default() -> Self {
        Self::new()
    }
}
