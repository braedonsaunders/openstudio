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
    /// Number of connected peers
    pub peer_count: usize,
    /// Current network mode
    pub mode: NetworkMode,
    /// Clock offset from master in ms
    pub clock_offset_ms: f32,
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
