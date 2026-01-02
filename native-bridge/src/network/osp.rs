//! OpenStudio Protocol (OSP) Message Types
//!
//! Binary protocol for ultra-low-latency audio and control message transport.
//! Inspired by AOO but extended for DAW collaboration features.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// OSP packet header (8 bytes)
#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
pub struct OspHeader {
    /// Magic bytes: "OSP1"
    pub magic: [u8; 4],
    /// Sequence number for ordering/loss detection
    pub sequence: u16,
    /// Timestamp offset from session start (ms, wraps at 65535)
    pub timestamp: u16,
}

impl OspHeader {
    pub const MAGIC: [u8; 4] = *b"OSP1";
    pub const SIZE: usize = 8;

    pub fn new(sequence: u16, timestamp: u16) -> Self {
        Self {
            magic: Self::MAGIC,
            sequence,
            timestamp,
        }
    }

    pub fn to_bytes(&self) -> [u8; Self::SIZE] {
        let mut bytes = [0u8; Self::SIZE];
        bytes[0..4].copy_from_slice(&self.magic);
        bytes[4..6].copy_from_slice(&self.sequence.to_le_bytes());
        bytes[6..8].copy_from_slice(&self.timestamp.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < Self::SIZE {
            return None;
        }
        let magic: [u8; 4] = bytes[0..4].try_into().ok()?;
        if magic != Self::MAGIC {
            return None;
        }
        let sequence = u16::from_le_bytes([bytes[4], bytes[5]]);
        let timestamp = u16::from_le_bytes([bytes[6], bytes[7]]);
        Some(Self {
            magic,
            sequence,
            timestamp,
        })
    }
}

/// Message type identifiers (2 bytes)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u16)]
pub enum OspMessageType {
    // === REALTIME (0x00xx) - ≤2ms budget, unreliable OK ===
    AudioFrame = 0x0001,
    AudioLevels = 0x0002,
    ClockSync = 0x0003,
    BeatPosition = 0x0004,

    // === CONTROL (0x01xx) - ≤20ms budget, semi-reliable ===
    TrackState = 0x0101,
    EffectParam = 0x0102,
    EffectBypass = 0x0103,
    Transport = 0x0104,
    TempoChange = 0x0105,
    StemMix = 0x0106,
    MonitoringState = 0x0107,

    // === RELIABLE (0x02xx) - guaranteed delivery ===
    UserJoin = 0x0201,
    UserLeave = 0x0202,
    TrackCreate = 0x0203,
    TrackDelete = 0x0204,
    EffectChain = 0x0205,
    Permission = 0x0206,
    ChatMessage = 0x0207,
    PerformanceInfo = 0x0208,
    SongChange = 0x0209,
    LoopState = 0x020A,
    LyriaState = 0x020B,
    RoomState = 0x020C,

    // === SYSTEM (0x03xx) ===
    Ping = 0x0301,
    Pong = 0x0302,
    MasterElection = 0x0303,
    RelaySwitch = 0x0304,
    QualityPreset = 0x0305,
    Handshake = 0x0306,
    HandshakeAck = 0x0307,
    Disconnect = 0x0308,
    Heartbeat = 0x0309,
    ResendRequest = 0x030A,
}

impl OspMessageType {
    /// Whether this message type requires reliable delivery
    pub fn is_reliable(&self) -> bool {
        (*self as u16) >= 0x0200 && (*self as u16) < 0x0300
    }

    /// Whether this message type is realtime (can drop)
    pub fn is_realtime(&self) -> bool {
        (*self as u16) < 0x0100
    }
}

/// Audio frame message (realtime)
#[derive(Debug, Clone)]
pub struct AudioFrameMessage {
    /// User ID (32-bit hash of string ID)
    pub user_id: u32,
    /// Track ID (8-bit, up to 256 tracks per user)
    pub track_id: u8,
    /// Codec: 0 = PCM, 1 = Opus
    pub codec: u8,
    /// Number of channels (1 or 2)
    pub channels: u8,
    /// Number of samples (per channel)
    pub sample_count: u16,
    /// Opus-encoded or raw PCM audio data
    pub data: Vec<u8>,
}

impl AudioFrameMessage {
    pub const HEADER_SIZE: usize = 7;

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(Self::HEADER_SIZE + self.data.len());
        bytes.extend_from_slice(&self.user_id.to_le_bytes());
        bytes.push(self.track_id);
        bytes.push(self.codec);
        bytes.push(self.channels);
        bytes.extend_from_slice(&self.sample_count.to_le_bytes());
        bytes.extend_from_slice(&self.data);
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < Self::HEADER_SIZE {
            return None;
        }
        let user_id = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let track_id = bytes[4];
        let codec = bytes[5];
        let channels = bytes[6];
        let sample_count = u16::from_le_bytes([bytes[7], bytes[8]]);
        let data = bytes[9..].to_vec();
        Some(Self {
            user_id,
            track_id,
            codec,
            channels,
            sample_count,
            data,
        })
    }
}

/// Audio levels message (realtime, ~50Hz)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioLevelsMessage {
    /// User ID
    pub user_id: u32,
    /// Per-track levels (track_id -> (level_db, peak_db))
    pub track_levels: Vec<(u8, f32, f32)>,
}

/// Master clock sync message (realtime)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClockSyncMessage {
    /// Master's wall clock time (ms since epoch)
    pub master_time: u64,
    /// Current beat position (fractional beats)
    pub beat_position: f64,
    /// Tempo in BPM
    pub bpm: f32,
    /// Time signature numerator
    pub time_sig_num: u8,
    /// Time signature denominator
    pub time_sig_denom: u8,
    /// Sequence number for this sync
    pub sync_sequence: u32,
}

/// Beat position message (realtime)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeatPositionMessage {
    /// Current beat position (fractional)
    pub beat: f64,
    /// Metronome is playing
    pub metronome_active: bool,
}

/// Track state message (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackStateMessage {
    pub user_id: u32,
    pub track_id: u8,
    pub is_muted: Option<bool>,
    pub is_solo: Option<bool>,
    pub is_armed: Option<bool>,
    pub volume: Option<f32>,
    pub pan: Option<f32>,
    pub monitoring_enabled: Option<bool>,
}

/// Single effect parameter change (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectParamMessage {
    pub user_id: u32,
    pub track_id: u8,
    /// Effect type name (e.g., "compressor", "reverb")
    pub effect_type: String,
    /// Parameter name
    pub param_name: String,
    /// New value
    pub value: f32,
}

/// Effect bypass state (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectBypassMessage {
    pub user_id: u32,
    pub track_id: u8,
    pub effect_type: String,
    pub bypassed: bool,
}

/// Transport control message (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportMessage {
    pub action: TransportAction,
    /// Position in seconds (for seek)
    pub position: Option<f64>,
    /// Sync timestamp for coordinated start
    pub sync_timestamp: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransportAction {
    Play,
    Pause,
    Stop,
    Seek,
    Record,
    StopRecord,
}

/// Tempo change message (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempoChangeMessage {
    pub bpm: f32,
    pub source: TempoSource,
    pub key: Option<String>,
    pub scale: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TempoSource {
    Manual,
    Track,
    Analyzer,
    Tap,
}

/// Stem mix state message (control)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemMixMessage {
    pub stem: String,
    pub enabled: bool,
    pub volume: f32,
}

/// User join message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJoinMessage {
    pub user_id: String,
    pub user_name: String,
    pub avatar_url: Option<String>,
    pub instrument: Option<String>,
    pub has_native_bridge: bool,
    /// User's role in the room
    pub role: String,
}

/// User leave message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserLeaveMessage {
    pub user_id: String,
    pub reason: LeaveReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LeaveReason {
    Normal,
    Timeout,
    Kicked,
    NetworkError,
}

/// Track create message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackCreateMessage {
    pub user_id: String,
    pub track_id: String,
    pub track_name: String,
    pub track_type: String,
    pub color: String,
    pub audio_settings: TrackAudioSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackAudioSettings {
    pub input_mode: String,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub channel_count: u8,
}

/// Full effect chain state (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectChainMessage {
    pub user_id: u32,
    pub track_id: u8,
    /// JSON-serialized effects chain
    pub effects_json: String,
}

/// Permission change message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionMessage {
    pub user_id: String,
    pub new_role: String,
    pub permissions: HashMap<String, bool>,
}

/// Chat message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageContent {
    pub user_id: String,
    pub user_name: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: u64,
}

/// Performance info message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceInfoMessage {
    pub user_id: String,
    /// Round-trip time in ms
    pub rtt_ms: f32,
    /// Jitter in ms
    pub jitter_ms: f32,
    /// Packet loss percentage
    pub packet_loss: f32,
    /// Audio latency in ms
    pub audio_latency_ms: f32,
    /// Quality score (0-100)
    pub quality_score: u8,
    /// Connection quality tier
    pub quality_tier: String,
}

/// Song change message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SongChangeMessage {
    pub song_id: String,
    pub action: SongAction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SongAction {
    Select,
    Next,
    Previous,
    Create,
    Delete,
}

/// Loop state message (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopStateMessage {
    pub loop_id: String,
    pub action: LoopAction,
    pub position: Option<f64>,
    pub volume: Option<f32>,
    pub muted: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoopAction {
    Create,
    Delete,
    Start,
    Stop,
    Update,
}

/// Lyria AI generation state (reliable)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyriaStateMessage {
    pub session_state: String,
    pub config: Option<LyriaConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyriaConfig {
    pub bpm: f32,
    pub scale: String,
    pub density: f32,
    pub brightness: f32,
    pub drums: f32,
    pub bass: f32,
}

/// Room state snapshot (reliable, sent on join)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStateMessage {
    pub room_id: String,
    pub users: Vec<UserJoinMessage>,
    pub tracks: Vec<TrackCreateMessage>,
    pub tempo: f32,
    pub key: String,
    pub scale: String,
    pub time_signature: (u8, u8),
    pub transport_state: TransportAction,
    pub transport_position: f64,
}

/// Ping message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingMessage {
    pub ping_id: u32,
    pub send_time: u64,
}

/// Pong message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongMessage {
    pub ping_id: u32,
    pub send_time: u64,
    pub recv_time: u64,
}

/// Master election message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterElectionMessage {
    pub candidate_id: String,
    pub priority: u32,
    pub current_master_id: Option<String>,
}

/// Relay switch message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelaySwitchMessage {
    pub new_mode: NetworkModeType,
    pub relay_url: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NetworkModeType {
    P2P,
    Relay,
    Hybrid,
}

/// Quality preset message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityPresetMessage {
    pub preset: String,
    pub opus_bitrate: u32,
    pub opus_frame_size: u32,
    pub jitter_buffer_size: u32,
}

/// Handshake message (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeMessage {
    pub protocol_version: u32,
    pub user_id: String,
    pub user_name: String,
    pub room_id: String,
    pub room_secret_hash: [u8; 32],
    pub public_key: [u8; 32],
    pub has_native_bridge: bool,
}

/// Handshake acknowledgment (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeAckMessage {
    pub success: bool,
    pub error: Option<String>,
    pub assigned_user_id: Option<u32>,
    pub room_state: Option<RoomStateMessage>,
    pub is_master: bool,
}

/// Resend request (system)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResendRequestMessage {
    pub sequences: Vec<u16>,
}

/// Complete OSP message wrapper
#[derive(Debug, Clone)]
pub struct OspPacket {
    pub header: OspHeader,
    pub message_type: OspMessageType,
    pub payload: Vec<u8>,
    pub checksum: u32,
}

impl OspPacket {
    pub const CHECKSUM_SIZE: usize = 4;

    pub fn new(message_type: OspMessageType, payload: Vec<u8>, sequence: u16, timestamp: u16) -> Self {
        let header = OspHeader::new(sequence, timestamp);
        let checksum = Self::compute_checksum(&header.to_bytes(), message_type as u16, &payload);
        Self {
            header,
            message_type,
            payload,
            checksum,
        }
    }

    fn compute_checksum(header: &[u8], msg_type: u16, payload: &[u8]) -> u32 {
        let mut hasher = crc32fast::Hasher::new();
        hasher.update(header);
        hasher.update(&msg_type.to_le_bytes());
        hasher.update(payload);
        hasher.finalize()
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let header_bytes = self.header.to_bytes();
        let msg_type_bytes = (self.message_type as u16).to_le_bytes();
        let payload_len = (self.payload.len() as u16).to_le_bytes();

        let mut bytes = Vec::with_capacity(
            OspHeader::SIZE + 2 + 2 + self.payload.len() + Self::CHECKSUM_SIZE,
        );
        bytes.extend_from_slice(&header_bytes);
        bytes.extend_from_slice(&msg_type_bytes);
        bytes.extend_from_slice(&payload_len);
        bytes.extend_from_slice(&self.payload);
        bytes.extend_from_slice(&self.checksum.to_le_bytes());
        bytes
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < OspHeader::SIZE + 4 + Self::CHECKSUM_SIZE {
            return None;
        }

        let header = OspHeader::from_bytes(&bytes[0..OspHeader::SIZE])?;
        let msg_type_raw = u16::from_le_bytes([bytes[8], bytes[9]]);
        let payload_len = u16::from_le_bytes([bytes[10], bytes[11]]) as usize;

        if bytes.len() < OspHeader::SIZE + 4 + payload_len + Self::CHECKSUM_SIZE {
            return None;
        }

        let payload = bytes[12..12 + payload_len].to_vec();
        let checksum_offset = 12 + payload_len;
        let checksum = u32::from_le_bytes([
            bytes[checksum_offset],
            bytes[checksum_offset + 1],
            bytes[checksum_offset + 2],
            bytes[checksum_offset + 3],
        ]);

        // Verify checksum
        let computed = Self::compute_checksum(&header.to_bytes(), msg_type_raw, &payload);
        if computed != checksum {
            return None;
        }

        // Parse message type
        let message_type = match msg_type_raw {
            0x0001 => OspMessageType::AudioFrame,
            0x0002 => OspMessageType::AudioLevels,
            0x0003 => OspMessageType::ClockSync,
            0x0004 => OspMessageType::BeatPosition,
            0x0101 => OspMessageType::TrackState,
            0x0102 => OspMessageType::EffectParam,
            0x0103 => OspMessageType::EffectBypass,
            0x0104 => OspMessageType::Transport,
            0x0105 => OspMessageType::TempoChange,
            0x0106 => OspMessageType::StemMix,
            0x0107 => OspMessageType::MonitoringState,
            0x0201 => OspMessageType::UserJoin,
            0x0202 => OspMessageType::UserLeave,
            0x0203 => OspMessageType::TrackCreate,
            0x0204 => OspMessageType::TrackDelete,
            0x0205 => OspMessageType::EffectChain,
            0x0206 => OspMessageType::Permission,
            0x0207 => OspMessageType::ChatMessage,
            0x0208 => OspMessageType::PerformanceInfo,
            0x0209 => OspMessageType::SongChange,
            0x020A => OspMessageType::LoopState,
            0x020B => OspMessageType::LyriaState,
            0x020C => OspMessageType::RoomState,
            0x0301 => OspMessageType::Ping,
            0x0302 => OspMessageType::Pong,
            0x0303 => OspMessageType::MasterElection,
            0x0304 => OspMessageType::RelaySwitch,
            0x0305 => OspMessageType::QualityPreset,
            0x0306 => OspMessageType::Handshake,
            0x0307 => OspMessageType::HandshakeAck,
            0x0308 => OspMessageType::Disconnect,
            0x0309 => OspMessageType::Heartbeat,
            0x030A => OspMessageType::ResendRequest,
            _ => return None,
        };

        Some(Self {
            header,
            message_type,
            payload,
            checksum,
        })
    }
}

/// Utility to hash string IDs to u32 for compact transmission
pub fn hash_user_id(user_id: &str) -> u32 {
    let hash = blake3::hash(user_id.as_bytes());
    let bytes = hash.as_bytes();
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_osp_header_roundtrip() {
        let header = OspHeader::new(12345, 6789);
        let bytes = header.to_bytes();
        let parsed = OspHeader::from_bytes(&bytes).unwrap();
        assert_eq!(parsed.sequence, 12345);
        assert_eq!(parsed.timestamp, 6789);
    }

    #[test]
    fn test_osp_packet_roundtrip() {
        let payload = b"test payload".to_vec();
        let packet = OspPacket::new(OspMessageType::Ping, payload.clone(), 100, 200);
        let bytes = packet.to_bytes();
        let parsed = OspPacket::from_bytes(&bytes).unwrap();
        assert_eq!(parsed.header.sequence, 100);
        assert_eq!(parsed.message_type, OspMessageType::Ping);
        assert_eq!(parsed.payload, payload);
    }
}
