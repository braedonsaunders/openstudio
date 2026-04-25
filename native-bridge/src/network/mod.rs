//! OpenStudio Protocol (OSP) Networking Layer
//!
//! A high-performance, low-latency audio networking protocol inspired by AOO (Audio over OSC)
//! but extended with rich control messages for DAW collaboration.
//!
//! Key improvements over SonoBus/AOO:
//! - Multi-track support (up to 8 tracks per user)
//! - Full effects parameter synchronization
//! - Master clock with sub-ms beat sync
//! - Automatic P2P <-> relay switching
//! - Cloudflare MoQ integration for scalability

pub mod bridge;
pub mod clock;
pub mod codec;
pub mod jitter;
pub mod manager;
pub mod osp;
pub mod p2p;
pub mod peer;
pub mod relay;

pub use manager::{NetworkConfig, NetworkEvent, NetworkManager, NetworkMode};

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Network-related errors
#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Peer not found: {0}")]
    PeerNotFound(String),

    #[error("Codec error: {0}")]
    CodecError(String),

    #[error("Relay error: {0}")]
    RelayError(String),

    #[error("NAT traversal failed: {0}")]
    NatTraversalFailed(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Room full")]
    RoomFull,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

pub type Result<T> = std::result::Result<T, NetworkError>;

/// Network statistics for monitoring
#[derive(Debug, Clone, Default)]
pub struct NetworkStats {
    /// Round-trip time to peers/relay in ms
    pub rtt_ms: f32,
    /// Jitter (variance in latency) in ms
    pub jitter_ms: f32,
    /// Packet loss percentage (0.0 - 100.0)
    pub packet_loss_pct: f32,
    /// Bytes sent per second
    pub bytes_sent_per_sec: u64,
    /// Bytes received per second
    pub bytes_recv_per_sec: u64,
    /// Audio frames sent
    pub audio_frames_sent: u64,
    /// Audio frames received
    pub audio_frames_recv: u64,
    /// Audio samples received after decode
    pub audio_samples_recv: u64,
    /// Number of connected peers
    pub peer_count: usize,
    /// Current network mode
    pub mode: NetworkMode,
    /// Clock offset from master in ms
    pub clock_offset_ms: f32,
}

/// Per-track receive-side audio telemetry for a connected peer.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerAudioTrackStats {
    /// Native bridge track number used on the wire
    pub track_id: u8,
    /// Human-readable track name
    pub track_name: String,
    /// Current mute state known by the native bridge
    pub muted: bool,
    /// Current solo state known by the native bridge
    pub solo: bool,
    /// Current track gain known by the native bridge
    pub volume: f32,
    /// Buffered PCM samples currently waiting for playback
    pub jitter_buffer_level_samples: usize,
    /// Buffered playback time currently waiting in the jitter buffer
    pub jitter_buffer_level_ms: f32,
    /// Current fill ratio against the configured maximum jitter buffer size
    pub jitter_buffer_fill_ratio: f32,
    /// Current fill ratio against the adaptive target jitter buffer size
    pub jitter_buffer_target_ratio: f32,
    /// Average inter-arrival jitter observed for this track
    pub avg_jitter_ms: f32,
    /// Maximum inter-arrival jitter observed for this track
    pub max_jitter_ms: f32,
    /// Receive-side packet loss estimate for this track
    pub packet_loss_pct: f32,
    /// Number of jitter buffer underruns
    pub underruns: u64,
    /// Number of jitter buffer overruns
    pub overruns: u64,
    /// Number of reordered packets observed
    pub reordered: u64,
    /// Number of generated packet-loss concealment frames
    pub plc_frames: u64,
}

/// Per-peer receive-side audio telemetry exposed to browser clients.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerAudioStats {
    /// Stable numeric peer identifier used by the OSP transport
    pub peer_id: u32,
    /// Application user identifier for the remote peer
    pub user_id: String,
    /// Display name for the remote peer
    pub user_name: String,
    /// Whether the remote peer has native bridge support
    pub has_native_bridge: bool,
    /// Whether audio has been received recently from this peer
    pub audio_active: bool,
    /// Round-trip time to this peer in ms
    pub rtt_ms: f32,
    /// Network jitter estimate for this peer in ms
    pub jitter_ms: f32,
    /// Packet loss percentage estimate for this peer
    pub packet_loss_pct: f32,
    /// Quality score derived from RTT, jitter, and packet loss
    pub quality_score: u8,
    /// Total encoded audio packets received from this peer
    pub audio_packets_received: u64,
    /// Total encoded audio payload bytes received from this peer
    pub audio_bytes_received: u64,
    /// Last OSP packet sequence number received from this peer
    pub last_audio_sequence: u64,
    /// Last sender-side OSP timestamp received from this peer
    pub last_audio_sender_timestamp_ms: u64,
    /// Local receive timestamp for the most recent audio packet
    pub last_audio_arrival_timestamp_ms: u64,
    /// Wall-clock freshness of the most recent received audio packet
    pub ms_since_last_audio: Option<u64>,
    /// Per-track receive jitter buffer state
    pub tracks: Vec<PeerAudioTrackStats>,
}

/// Room configuration
#[derive(Debug, Clone)]
pub struct RoomConfig {
    /// Room identifier
    pub room_id: String,
    /// Room secret for authentication
    pub room_secret: String,
    /// Maximum number of performers (users with native bridge)
    pub max_performers: usize,
    /// Maximum number of listeners (browser-only)
    pub max_listeners: usize,
    /// Sample rate (44100 or 48000)
    pub sample_rate: u32,
    /// Whether room owner requires native bridge
    pub require_native_bridge: bool,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            room_id: String::new(),
            room_secret: String::new(),
            max_performers: 8,
            max_listeners: 50,
            sample_rate: 48000,
            require_native_bridge: false,
        }
    }
}
