//! WebSocket message types for browser <-> native bridge communication

use crate::audio::{ChannelConfig, DeviceInfo};
use crate::effects::EffectsSettings;
use crate::mixing::PartialTrackState;
use crate::network::PeerAudioStats;
use serde::{Deserialize, Serialize};

/// All messages from browser to native bridge
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BrowserMessage {
    // === Connection ===
    /// Initial handshake
    Hello {
        version: String,
        room_id: Option<String>,
        user_id: Option<String>,
    },

    /// Ping for latency measurement
    Ping { timestamp: u64 },

    // === P2P/Relay Room ===
    /// Join a room with P2P/relay networking
    JoinRoom {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "roomSecret")]
        room_secret: String,
        #[serde(rename = "userName")]
        user_name: String,
        #[serde(rename = "authEndpoint")]
        auth_endpoint: Option<String>,
    },

    /// Leave the current room
    LeaveRoom,

    /// Switch network mode (P2P, Relay, Hybrid)
    SetNetworkMode { mode: String },

    /// Request the current native UDP endpoint for room signaling
    GetNetworkEndpoint,

    /// Request current network transport statistics.
    GetNetworkStats,

    /// Request receive-side per-peer audio telemetry.
    GetPeerAudioStats,

    /// Connect the native P2P transport to a discovered peer endpoint
    ConnectPeer {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "userName")]
        user_name: String,
        address: String,
    },

    // === Device Management ===
    /// Request list of audio devices
    GetDevices,

    /// Set input device
    SetInputDevice { device_id: String },

    /// Set output device
    SetOutputDevice { device_id: String },

    /// Set channel configuration
    SetChannelConfig {
        #[serde(flatten)]
        config: ChannelConfig,
    },

    // === Audio Control ===
    /// Start audio capture and playback
    StartAudio,

    /// Stop audio
    StopAudio,

    /// Set buffer size
    SetBufferSize { size: u32 },

    /// Set sample rate
    SetSampleRate { rate: u32 },

    // === Track State ===
    /// Update track arm/mute/solo/volume (partial - only sent fields are updated)
    UpdateTrackState {
        #[serde(rename = "trackId")]
        track_id: String,
        #[serde(flatten)]
        state: PartialTrackState,
    },

    /// Register or update a local native bridge track
    SyncLocalTrack {
        #[serde(rename = "trackId")]
        track_id: String,
        #[serde(rename = "bridgeTrackId")]
        bridge_track_id: u8,
        #[serde(rename = "trackName")]
        track_name: String,
        #[serde(rename = "channelConfig")]
        channel_config: ChannelConfig,
    },

    /// Remove a local native bridge track
    RemoveLocalTrack {
        #[serde(rename = "trackId")]
        track_id: String,
    },

    /// Update track effects
    UpdateEffects {
        #[serde(rename = "trackId")]
        track_id: String,
        effects: Box<EffectsSettings>,
    },

    /// Set monitoring
    SetMonitoring { enabled: bool, volume: f32 },

    // === Room Context (for pitch/tempo-sync effects) ===
    /// Update room musical context (key, scale, BPM)
    SetRoomContext {
        key: Option<String>,        // C, C#, D, etc.
        scale: Option<String>,      // major, minor, chromatic, etc.
        bpm: Option<f32>,           // Tempo in BPM
        time_sig_num: Option<u8>,   // Time signature numerator
        time_sig_denom: Option<u8>, // Time signature denominator
    },

    // === Remote Users ===
    /// Add remote user stream (metadata - actual audio comes via WebRTC)
    AddRemoteUser { user_id: String, user_name: String },

    /// Remove remote user
    RemoveRemoteUser { user_id: String },

    /// Update remote user settings
    UpdateRemoteUser {
        user_id: String,
        volume: f32,
        pan: f32,
        muted: bool,
        compensation_delay_ms: f32,
    },

    /// Register or update a remote native bridge track
    SyncRemoteTrack {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "trackId")]
        track_id: String,
        #[serde(rename = "bridgeTrackId")]
        bridge_track_id: u8,
        #[serde(rename = "trackName")]
        track_name: String,
        volume: f32,
        pan: f32,
        muted: bool,
        solo: bool,
    },

    /// Remove a remote native bridge track
    RemoveRemoteTrack {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "trackId")]
        track_id: String,
        #[serde(rename = "bridgeTrackId")]
        bridge_track_id: Option<u8>,
    },

    // === Backing Track ===
    /// Load backing track (sends URL, native fetches and decodes)
    LoadBackingTrack { url: String, duration: f32 },

    /// Play backing track
    PlayBackingTrack { sync_timestamp: u64, offset: f32 },

    /// Stop backing track
    StopBackingTrack,

    /// Seek backing track
    SeekBackingTrack { time: f32 },

    /// Set backing track volume
    SetBackingTrackVolume { volume: f32 },

    /// Set stem state
    SetStemState {
        stem: String,
        enabled: bool,
        volume: f32,
    },

    // === Master ===
    /// Set master volume
    SetMasterVolume { volume: f32 },

    /// Enable/disable master effects
    SetMasterEffectsEnabled { enabled: bool },

    /// Update master effects settings
    UpdateMasterEffects {
        eq: Option<crate::effects::EqSettings>,
        compressor: Option<crate::effects::CompressorSettings>,
        reverb: Option<crate::effects::ReverbSettings>,
        limiter: Option<crate::effects::LimiterSettings>,
    },
}

/// All messages from native bridge to browser
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NativeMessage {
    // === Connection ===
    /// Handshake response
    #[serde(rename = "welcome")]
    Welcome {
        version: String,
        #[serde(rename = "driverType")]
        driver_type: String,
    },

    /// Pong response
    #[serde(rename = "pong")]
    Pong {
        timestamp: u64,
        #[serde(rename = "nativeTime")]
        native_time: u64,
    },

    /// Error message
    #[serde(rename = "error")]
    Error { code: String, message: String },

    // === Device Info ===
    /// List of available devices
    #[serde(rename = "devices")]
    Devices {
        inputs: Vec<DeviceInfo>,
        outputs: Vec<DeviceInfo>,
    },

    /// Current device configuration
    #[serde(rename = "deviceConfig")]
    DeviceConfig {
        #[serde(rename = "inputDevice")]
        input_device: Option<DeviceInfo>,
        #[serde(rename = "outputDevice")]
        output_device: Option<DeviceInfo>,
        #[serde(rename = "sampleRate")]
        sample_rate: u32,
        #[serde(rename = "bufferSize")]
        buffer_size: u32,
        #[serde(rename = "channelConfig")]
        channel_config: ChannelConfig,
    },

    // === Status ===
    /// Audio engine status
    #[serde(rename = "audioStatus")]
    AudioStatus {
        #[serde(rename = "isRunning")]
        is_running: bool,
        #[serde(rename = "inputLatencyMs")]
        input_latency_ms: f32,
        #[serde(rename = "outputLatencyMs")]
        output_latency_ms: f32,
        #[serde(rename = "totalLatencyMs")]
        total_latency_ms: f32,
    },

    /// Connection quality update
    #[serde(rename = "connectionQuality")]
    ConnectionQuality {
        quality: String, // "excellent" | "good" | "fair" | "poor"
        #[serde(rename = "jitterMs")]
        jitter_ms: f32,
        #[serde(rename = "packetLoss")]
        packet_loss: f32,
    },

    /// Stream health status (buffer overflow, connection health)
    #[serde(rename = "streamHealth")]
    StreamHealth {
        #[serde(rename = "bufferOccupancy")]
        buffer_occupancy: f32, // 0.0 - 1.0
        #[serde(rename = "overflowCount")]
        overflow_count: u64,
        #[serde(rename = "overflowSamples")]
        overflow_samples: u64,
        #[serde(rename = "isHealthy")]
        is_healthy: bool,
        #[serde(rename = "msSinceLastRead")]
        ms_since_last_read: u64,
    },

    // === Metering ===
    /// Audio levels (sent at ~50ms intervals)
    #[serde(rename = "levels")]
    Levels {
        #[serde(rename = "inputLevel")]
        input_level: f32,
        #[serde(rename = "inputPeak")]
        input_peak: f32,
        #[serde(rename = "outputLevel")]
        output_level: f32,
        #[serde(rename = "outputPeak")]
        output_peak: f32,
        #[serde(rename = "remoteLevels")]
        remote_levels: Vec<(String, f32)>, // (user_id, level)
    },

    /// Effects metering
    #[serde(rename = "effectsMetering")]
    EffectsMetering {
        #[serde(rename = "trackId")]
        track_id: String,
        #[serde(rename = "noiseGateOpen")]
        noise_gate_open: bool,
        #[serde(rename = "compressorReduction")]
        compressor_reduction: f32,
        #[serde(rename = "limiterReduction")]
        limiter_reduction: f32,
    },

    // === Backing Track ===
    /// Backing track loaded
    #[serde(rename = "backingTrackLoaded")]
    BackingTrackLoaded {
        duration: f32,
        waveform: Vec<f32>, // Normalized peaks for visualization
    },

    /// Backing track playback position
    #[serde(rename = "backingTrackPosition")]
    BackingTrackPosition { time: f32 },

    /// Backing track ended
    #[serde(rename = "backingTrackEnded")]
    BackingTrackEnded,

    // === P2P/Relay Room ===
    /// Room joined successfully
    #[serde(rename = "roomJoined")]
    RoomJoined {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "networkMode")]
        network_mode: String,
        #[serde(rename = "isMaster")]
        is_master: bool,
        #[serde(rename = "localEndpoint")]
        local_endpoint: Option<String>,
        #[serde(rename = "publicEndpoint")]
        public_endpoint: Option<String>,
    },

    /// Native UDP endpoint used for browser-mediated peer discovery
    #[serde(rename = "networkEndpoint")]
    NetworkEndpoint {
        #[serde(rename = "localEndpoint")]
        local_endpoint: Option<String>,
        #[serde(rename = "publicEndpoint")]
        public_endpoint: Option<String>,
    },

    /// Room left
    #[serde(rename = "roomLeft")]
    RoomLeft,

    /// Peer connected to room
    #[serde(rename = "peerConnected")]
    PeerConnected {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "userName")]
        user_name: String,
        #[serde(rename = "hasNativeBridge")]
        has_native_bridge: bool,
    },

    /// Peer disconnected from room
    #[serde(rename = "peerDisconnected")]
    PeerDisconnected {
        #[serde(rename = "userId")]
        user_id: String,
        reason: String,
    },

    /// Network mode changed
    #[serde(rename = "networkModeChanged")]
    NetworkModeChanged { mode: String },

    /// Network stats update
    #[serde(rename = "networkStats")]
    NetworkStats {
        #[serde(rename = "rttMs")]
        rtt_ms: f32,
        #[serde(rename = "jitterMs")]
        jitter_ms: f32,
        #[serde(rename = "packetLossPct")]
        packet_loss_pct: f32,
        #[serde(rename = "peerCount")]
        peer_count: usize,
        #[serde(rename = "bytesSentPerSec")]
        bytes_sent_per_sec: u64,
        #[serde(rename = "bytesRecvPerSec")]
        bytes_recv_per_sec: u64,
        #[serde(rename = "audioFramesSent")]
        audio_frames_sent: u64,
        #[serde(rename = "audioFramesRecv")]
        audio_frames_recv: u64,
        #[serde(rename = "audioSamplesRecv")]
        audio_samples_recv: u64,
    },

    /// Receive-side per-peer audio telemetry.
    #[serde(rename = "peerAudioStats")]
    PeerAudioStats { peers: Vec<PeerAudioStats> },
}

/// Binary audio message header (for efficient audio streaming)
#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
pub struct AudioMessageHeader {
    /// Message type:
    /// 0 = from browser (remote WebRTC audio)
    /// 1 = to browser (legacy local capture)
    /// 2 = to browser (local capture with track id)
    /// 3 = to browser (decoded remote native peer audio)
    pub msg_type: u8,
    /// Number of samples (stereo frames * 2)
    pub sample_count: u32,
    /// Timestamp for sync
    pub timestamp: u64,
}

impl AudioMessageHeader {
    pub const SIZE: usize = std::mem::size_of::<Self>();

    pub fn to_bytes(self) -> [u8; Self::SIZE] {
        unsafe { std::mem::transmute_copy(&self) }
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() >= Self::SIZE {
            Some(unsafe { std::ptr::read(bytes.as_ptr() as *const Self) })
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::network::{PeerAudioStats, PeerAudioTrackStats};

    use super::{BrowserMessage, NativeMessage};
    use serde_json::json;

    #[test]
    fn browser_network_messages_use_camel_case_contract() {
        let endpoint_msg: BrowserMessage =
            serde_json::from_value(json!({ "type": "getNetworkEndpoint" }))
                .expect("getNetworkEndpoint must deserialize");
        assert!(matches!(endpoint_msg, BrowserMessage::GetNetworkEndpoint));

        let stats_msg: BrowserMessage =
            serde_json::from_value(json!({ "type": "getNetworkStats" }))
                .expect("getNetworkStats must deserialize");
        assert!(matches!(stats_msg, BrowserMessage::GetNetworkStats));

        let peer_audio_stats_msg: BrowserMessage =
            serde_json::from_value(json!({ "type": "getPeerAudioStats" }))
                .expect("getPeerAudioStats must deserialize");
        assert!(matches!(
            peer_audio_stats_msg,
            BrowserMessage::GetPeerAudioStats
        ));

        let peer_msg: BrowserMessage = serde_json::from_value(json!({
            "type": "connectPeer",
            "userId": "user-2",
            "userName": "Dana",
            "address": "127.0.0.1:44000"
        }))
        .expect("connectPeer must deserialize");

        match peer_msg {
            BrowserMessage::ConnectPeer {
                user_id,
                user_name,
                address,
            } => {
                assert_eq!(user_id, "user-2");
                assert_eq!(user_name, "Dana");
                assert_eq!(address, "127.0.0.1:44000");
            }
            other => panic!("unexpected message: {other:?}"),
        }
    }

    #[test]
    fn native_endpoint_messages_serialize_for_browser_contract() {
        let room_joined = serde_json::to_value(NativeMessage::RoomJoined {
            room_id: "room-1".to_string(),
            network_mode: "hybrid".to_string(),
            is_master: false,
            local_endpoint: Some("127.0.0.1:44000".to_string()),
            public_endpoint: Some("203.0.113.10:44000".to_string()),
        })
        .expect("roomJoined must serialize");

        assert_eq!(room_joined["type"], "roomJoined");
        assert_eq!(room_joined["localEndpoint"], "127.0.0.1:44000");
        assert_eq!(room_joined["publicEndpoint"], "203.0.113.10:44000");

        let endpoint = serde_json::to_value(NativeMessage::NetworkEndpoint {
            local_endpoint: Some("127.0.0.1:44001".to_string()),
            public_endpoint: None,
        })
        .expect("networkEndpoint must serialize");

        assert_eq!(endpoint["type"], "networkEndpoint");
        assert_eq!(endpoint["localEndpoint"], "127.0.0.1:44001");
        assert!(endpoint["publicEndpoint"].is_null());

        let stats = serde_json::to_value(NativeMessage::NetworkStats {
            rtt_ms: 2.0,
            jitter_ms: 0.5,
            packet_loss_pct: 0.0,
            peer_count: 1,
            bytes_sent_per_sec: 1000,
            bytes_recv_per_sec: 900,
            audio_frames_sent: 4,
            audio_frames_recv: 3,
            audio_samples_recv: 2880,
        })
        .expect("networkStats must serialize");

        assert_eq!(stats["type"], "networkStats");
        assert_eq!(stats["peerCount"], 1);
        assert_eq!(stats["audioFramesRecv"], 3);

        let peer_audio_stats = serde_json::to_value(NativeMessage::PeerAudioStats {
            peers: vec![PeerAudioStats {
                peer_id: 42,
                user_id: "user-2".to_string(),
                user_name: "Dana".to_string(),
                has_native_bridge: true,
                audio_active: true,
                rtt_ms: 4.0,
                jitter_ms: 0.2,
                packet_loss_pct: 0.0,
                quality_score: 99,
                audio_packets_received: 30,
                audio_bytes_received: 4800,
                last_audio_sequence: 128,
                last_audio_sender_timestamp_ms: 2048,
                last_audio_arrival_timestamp_ms: 1_700_000_000_000,
                ms_since_last_audio: Some(12),
                tracks: vec![PeerAudioTrackStats {
                    track_id: 1,
                    track_name: "Mic".to_string(),
                    muted: false,
                    solo: false,
                    volume: 0.75,
                    jitter_buffer_level_samples: 960,
                    jitter_buffer_level_ms: 10.0,
                    jitter_buffer_fill_ratio: 0.25,
                    jitter_buffer_target_ratio: 2.0,
                    avg_jitter_ms: 0.1,
                    max_jitter_ms: 0.3,
                    packet_loss_pct: 0.0,
                    underruns: 0,
                    overruns: 0,
                    reordered: 0,
                    plc_frames: 0,
                }],
            }],
        })
        .expect("peerAudioStats must serialize");

        assert_eq!(peer_audio_stats["type"], "peerAudioStats");
        assert_eq!(peer_audio_stats["peers"][0]["userId"], "user-2");
        assert_eq!(
            peer_audio_stats["peers"][0]["tracks"][0]["jitterBufferFillRatio"],
            0.25
        );
    }
}
