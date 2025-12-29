//! WebSocket message types for browser <-> native bridge communication

use crate::audio::{ChannelConfig, DeviceInfo};
use crate::effects::EffectsSettings;
use crate::mixing::TrackState;
use serde::{Deserialize, Serialize};

/// All messages from browser to native bridge
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
    /// Update track arm/mute/solo/volume
    UpdateTrackState {
        track_id: String,
        #[serde(flatten)]
        state: TrackState,
    },

    /// Update track effects
    UpdateEffects {
        track_id: String,
        effects: EffectsSettings,
    },

    /// Set monitoring
    SetMonitoring { enabled: bool, volume: f32 },

    // === Remote Users ===
    /// Add remote user stream (metadata - actual audio comes via WebRTC)
    AddRemoteUser { user_id: String, user_name: String },

    /// Remove remote user
    RemoveRemoteUser { user_id: String },

    /// Update remote user settings
    UpdateRemoteUser {
        user_id: String,
        volume: f32,
        muted: bool,
        compensation_delay_ms: f32,
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

    // === Audio Data ===
    /// Audio data from WebRTC (remote users) - binary format
    /// Not sent as JSON, handled separately
    #[serde(skip)]
    AudioData { user_id: String, samples: Vec<f32> },
}

/// All messages from native bridge to browser
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum NativeMessage {
    // === Connection ===
    /// Handshake response
    #[serde(rename = "welcome")]
    Welcome {
        version: String,
        driver_type: String,
    },

    /// Pong response
    #[serde(rename = "pong")]
    Pong { timestamp: u64, native_time: u64 },

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
        input_device: Option<DeviceInfo>,
        output_device: Option<DeviceInfo>,
        sample_rate: u32,
        buffer_size: u32,
        channel_config: ChannelConfig,
    },

    // === Status ===
    /// Audio engine status
    #[serde(rename = "audioStatus")]
    AudioStatus {
        is_running: bool,
        input_latency_ms: f32,
        output_latency_ms: f32,
        total_latency_ms: f32,
    },

    /// Connection quality update
    #[serde(rename = "connectionQuality")]
    ConnectionQuality {
        quality: String, // "excellent" | "good" | "fair" | "poor"
        jitter_ms: f32,
        packet_loss: f32,
    },

    // === Metering ===
    /// Audio levels (sent at ~50ms intervals)
    #[serde(rename = "levels")]
    Levels {
        input_level: f32,
        input_peak: f32,
        output_level: f32,
        output_peak: f32,
        remote_levels: Vec<(String, f32)>, // (user_id, level)
    },

    /// Effects metering
    #[serde(rename = "effectsMetering")]
    EffectsMetering {
        track_id: String,
        noise_gate_open: bool,
        compressor_reduction: f32,
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

    // === Audio Data ===
    /// Audio data for WebRTC (local capture after effects) - binary format
    /// Not sent as JSON, handled separately
    #[serde(skip)]
    AudioData { samples: Vec<f32> },
}

/// Binary audio message header (for efficient audio streaming)
#[derive(Debug, Clone, Copy)]
#[repr(C, packed)]
pub struct AudioMessageHeader {
    /// Message type: 0 = from browser (remote audio), 1 = to browser (local capture)
    pub msg_type: u8,
    /// Number of samples (stereo frames * 2)
    pub sample_count: u32,
    /// Timestamp for sync
    pub timestamp: u64,
}

impl AudioMessageHeader {
    pub const SIZE: usize = std::mem::size_of::<Self>();

    pub fn to_bytes(&self) -> [u8; Self::SIZE] {
        unsafe { std::mem::transmute_copy(self) }
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() >= Self::SIZE {
            Some(unsafe { std::ptr::read(bytes.as_ptr() as *const Self) })
        } else {
            None
        }
    }
}
