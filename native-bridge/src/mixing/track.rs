//! Track state and management

use serde::{Deserialize, Serialize};

/// Track state for the local user's track
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackState {
    /// Track is armed for recording
    pub is_armed: bool,
    /// Track is muted
    pub is_muted: bool,
    /// Track is soloed
    pub is_solo: bool,
    /// Track volume (0.0 - 1.0)
    pub volume: f32,
    /// Track pan (-1.0 = full left, 0.0 = center, 1.0 = full right)
    pub pan: f32,
    /// Input gain in dB (-24 to +24)
    pub input_gain_db: f32,
    /// Direct monitoring enabled
    pub monitoring_enabled: bool,
    /// Monitoring volume (0.0 - 1.0)
    pub monitoring_volume: f32,
}

/// Partial track state for updates - only includes fields that were sent
/// Missing fields are None and will NOT overwrite existing values
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartialTrackState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_armed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_muted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_solo: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_gain_db: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitoring_enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monitoring_volume: Option<f32>,
}

impl TrackState {
    pub fn new() -> Self {
        Self {
            is_armed: false,
            is_muted: false,
            is_solo: false,
            volume: 1.0,
            pan: 0.0, // Center
            input_gain_db: 0.0,
            monitoring_enabled: false,
            monitoring_volume: 0.8,
        }
    }

    /// Calculate the input gain as a linear multiplier
    pub fn input_gain_linear(&self) -> f32 {
        10.0_f32.powf(self.input_gain_db / 20.0)
    }

    /// Should audio pass through based on arm/mute/solo state?
    pub fn should_pass_audio(&self, any_solo: bool) -> bool {
        if !self.is_armed {
            return false;
        }
        if self.is_muted {
            return false;
        }
        if any_solo && !self.is_solo {
            return false;
        }
        true
    }

    /// Merge a partial update into this state, only updating fields that are Some
    pub fn merge(&mut self, partial: &PartialTrackState) {
        if let Some(v) = partial.is_armed {
            self.is_armed = v;
        }
        if let Some(v) = partial.is_muted {
            self.is_muted = v;
        }
        if let Some(v) = partial.is_solo {
            self.is_solo = v;
        }
        if let Some(v) = partial.volume {
            self.volume = v;
        }
        if let Some(v) = partial.pan {
            self.pan = v;
        }
        if let Some(v) = partial.input_gain_db {
            self.input_gain_db = v;
        }
        if let Some(v) = partial.monitoring_enabled {
            self.monitoring_enabled = v;
        }
        if let Some(v) = partial.monitoring_volume {
            self.monitoring_volume = v;
        }
    }

    /// Apply pan to stereo samples using constant-power panning
    /// Returns (left_gain, right_gain)
    pub fn pan_gains(&self) -> (f32, f32) {
        // Constant-power pan law: maintains perceived loudness at all pan positions
        let angle = (self.pan + 1.0) * 0.25 * std::f32::consts::PI; // 0 to PI/2
        let left = angle.cos();
        let right = angle.sin();
        (left, right)
    }
}

/// Remote user audio state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUser {
    pub user_id: String,
    pub user_name: String,
    /// Volume (0.0 - 1.0)
    pub volume: f32,
    /// Is muted
    pub is_muted: bool,
    /// Latency compensation delay in ms
    pub compensation_delay_ms: f32,
    /// Current audio level (0.0 - 1.0)
    pub level: f32,
}

impl RemoteUser {
    pub fn new(user_id: String, user_name: String) -> Self {
        Self {
            user_id,
            user_name,
            volume: 1.0,
            is_muted: false,
            compensation_delay_ms: 0.0,
            level: 0.0,
        }
    }
}

/// A local audio track (for multi-track support)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub name: String,
    pub track_type: TrackType,
    pub state: TrackState,
    pub device_id: Option<String>,
    pub channel_config: crate::audio::ChannelConfig,
    pub effects: crate::effects::EffectsSettings,
    pub color: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrackType {
    Audio,
    Midi,
}

impl Track {
    pub fn new(id: String, name: String, track_type: TrackType) -> Self {
        Self {
            id,
            name,
            track_type,
            state: TrackState::new(),
            device_id: None,
            channel_config: crate::audio::ChannelConfig::default(),
            effects: crate::effects::EffectsSettings::default(),
            color: "#3b82f6".to_string(), // Default blue
        }
    }
}
