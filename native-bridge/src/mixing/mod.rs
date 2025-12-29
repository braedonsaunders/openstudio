//! Audio mixing module - handles multi-track mixing

mod mixer;
mod track;

pub use mixer::{Mixer, BackingTrackState, StemState};
pub use track::{Track, TrackState, RemoteUser};

use serde::{Deserialize, Serialize};

/// Master effects chain settings (simplified for master bus)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterEffectsSettings {
    pub enabled: bool,
    pub eq: crate::effects::EqSettings,
    pub compressor: crate::effects::CompressorSettings,
    pub reverb: crate::effects::ReverbSettings,
    pub limiter: crate::effects::LimiterSettings,
}

impl Default for MasterEffectsSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            eq: Default::default(),
            compressor: Default::default(),
            reverb: Default::default(),
            limiter: crate::effects::LimiterSettings {
                enabled: true,
                threshold: -1.0,
                release: 50.0,
                ceiling: -0.3,
            },
        }
    }
}
