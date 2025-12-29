//! Effects settings types - matching browser UnifiedEffectsChain

use serde::{Deserialize, Serialize};

/// Complete unified effects chain settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectsSettings {
    pub wah: WahSettings,
    pub overdrive: OverdriveSettings,
    pub distortion: DistortionSettings,
    pub amp: AmpSettings,
    pub cabinet: CabinetSettings,
    pub noise_gate: NoiseGateSettings,
    pub eq: EqSettings,
    pub compressor: CompressorSettings,
    pub chorus: ChorusSettings,
    pub flanger: FlangerSettings,
    pub phaser: PhaserSettings,
    pub delay: DelaySettings,
    pub tremolo: TremoloSettings,
    pub reverb: ReverbSettings,
    pub limiter: LimiterSettings,
}

impl Default for EffectsSettings {
    fn default() -> Self {
        Self {
            wah: WahSettings::default(),
            overdrive: OverdriveSettings::default(),
            distortion: DistortionSettings::default(),
            amp: AmpSettings::default(),
            cabinet: CabinetSettings::default(),
            noise_gate: NoiseGateSettings::default(),
            eq: EqSettings::default(),
            compressor: CompressorSettings::default(),
            chorus: ChorusSettings::default(),
            flanger: FlangerSettings::default(),
            phaser: PhaserSettings::default(),
            delay: DelaySettings::default(),
            tremolo: TremoloSettings::default(),
            reverb: ReverbSettings::default(),
            limiter: LimiterSettings::default(),
        }
    }
}

// === WAH ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WahSettings {
    pub enabled: bool,
    pub mode: WahMode,
    pub frequency: f32,      // 0-1 sweep position
    pub resonance: f32,      // Q factor
    pub attack: f32,         // ms (for envelope mode)
    pub release: f32,        // ms
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WahMode {
    Manual,
    Auto,
    Envelope,
}

impl Default for WahSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: WahMode::Manual,
            frequency: 0.5,
            resonance: 1.0,
            attack: 10.0,
            release: 100.0,
        }
    }
}

// === OVERDRIVE ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverdriveSettings {
    pub enabled: bool,
    pub drive: f32,          // 0-1
    pub tone: f32,           // 0-1
    pub level: f32,          // 0-1
}

impl Default for OverdriveSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            drive: 0.5,
            tone: 0.5,
            level: 0.5,
        }
    }
}

// === DISTORTION ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DistortionSettings {
    pub enabled: bool,
    pub distortion_type: DistortionType,
    pub amount: f32,         // 0-1
    pub tone: f32,           // 0-1
    pub level: f32,          // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DistortionType {
    Classic,
    Hard,
    Fuzz,
    Asymmetric,
    Rectifier,
}

impl Default for DistortionSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            distortion_type: DistortionType::Classic,
            amount: 0.5,
            tone: 0.5,
            level: 0.5,
        }
    }
}

// === AMP ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmpSettings {
    pub enabled: bool,
    pub amp_type: AmpType,
    pub gain: f32,           // 0-1
    pub bass: f32,           // 0-1
    pub mid: f32,            // 0-1
    pub treble: f32,         // 0-1
    pub presence: f32,       // 0-1
    pub master: f32,         // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AmpType {
    Clean,
    Crunch,
    Highgain,
    British,
    American,
    Modern,
}

impl Default for AmpSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            amp_type: AmpType::Clean,
            gain: 0.5,
            bass: 0.5,
            mid: 0.5,
            treble: 0.5,
            presence: 0.5,
            master: 0.5,
        }
    }
}

// === CABINET ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CabinetSettings {
    pub enabled: bool,
    pub cabinet_type: CabinetType,
    pub mic_position: MicPosition,
    pub room_level: f32,     // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CabinetType {
    #[serde(rename = "1x12")]
    C1x12,
    #[serde(rename = "2x12")]
    C2x12,
    #[serde(rename = "4x12")]
    C4x12,
    #[serde(rename = "1x15")]
    C1x15,
    #[serde(rename = "2x10")]
    C2x10,
    Direct,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MicPosition {
    Center,
    Edge,
    Room,
    Blend,
}

impl Default for CabinetSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            cabinet_type: CabinetType::C4x12,
            mic_position: MicPosition::Center,
            room_level: 0.3,
        }
    }
}

// === NOISE GATE ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseGateSettings {
    pub enabled: bool,
    pub threshold: f32,      // dB (-96 to 0)
    pub attack: f32,         // ms
    pub hold: f32,           // ms
    pub release: f32,        // ms
    pub range: f32,          // dB attenuation when closed
}

impl Default for NoiseGateSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold: -40.0,
            attack: 0.1,
            hold: 50.0,
            release: 100.0,
            range: -80.0,
        }
    }
}

// === EQ ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqSettings {
    pub enabled: bool,
    pub bands: Vec<EqBand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqBand {
    pub frequency: f32,      // Hz
    pub gain: f32,           // dB (-24 to +24)
    pub q: f32,              // 0.1 to 10
    pub band_type: EqBandType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EqBandType {
    Lowshelf,
    Peak,
    Highshelf,
}

impl Default for EqSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: vec![
                EqBand { frequency: 80.0, gain: 0.0, q: 0.7, band_type: EqBandType::Lowshelf },
                EqBand { frequency: 240.0, gain: 0.0, q: 1.0, band_type: EqBandType::Peak },
                EqBand { frequency: 750.0, gain: 0.0, q: 1.0, band_type: EqBandType::Peak },
                EqBand { frequency: 2200.0, gain: 0.0, q: 1.0, band_type: EqBandType::Peak },
                EqBand { frequency: 6000.0, gain: 0.0, q: 0.7, band_type: EqBandType::Highshelf },
            ],
        }
    }
}

// === COMPRESSOR ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressorSettings {
    pub enabled: bool,
    pub threshold: f32,      // dB (-60 to 0)
    pub ratio: f32,          // 1:1 to 20:1
    pub attack: f32,         // ms
    pub release: f32,        // ms
    pub knee: f32,           // dB (0-40)
    pub makeup_gain: f32,    // dB (-12 to +24)
}

impl Default for CompressorSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            threshold: -24.0,
            ratio: 4.0,
            attack: 10.0,
            release: 100.0,
            knee: 6.0,
            makeup_gain: 0.0,
        }
    }
}

// === CHORUS ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChorusSettings {
    pub enabled: bool,
    pub rate: f32,           // Hz (0.1-10)
    pub depth: f32,          // 0-1
    pub delay: f32,          // ms (2-20)
    pub feedback: f32,       // 0-1
    pub spread: f32,         // stereo spread (0-180 degrees)
    pub mix: f32,            // 0-1
}

impl Default for ChorusSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 1.0,
            depth: 0.5,
            delay: 7.0,
            feedback: 0.2,
            spread: 90.0,
            mix: 0.5,
        }
    }
}

// === FLANGER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlangerSettings {
    pub enabled: bool,
    pub rate: f32,           // Hz (0.05-5)
    pub depth: f32,          // 0-1
    pub delay: f32,          // ms (0.5-10)
    pub feedback: f32,       // -1 to 1
    pub mix: f32,            // 0-1
    pub negative: bool,      // invert feedback
}

impl Default for FlangerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 0.5,
            depth: 0.5,
            delay: 2.0,
            feedback: 0.5,
            mix: 0.5,
            negative: false,
        }
    }
}

// === PHASER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaserSettings {
    pub enabled: bool,
    pub rate: f32,           // Hz
    pub depth: f32,          // 0-1
    pub base_frequency: f32, // Hz
    pub octaves: f32,        // sweep range
    pub stages: u32,         // 2-12 (even numbers)
    pub feedback: f32,       // -1 to 1
    pub q: f32,              // resonance
    pub mix: f32,            // 0-1
}

impl Default for PhaserSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 0.5,
            depth: 0.5,
            base_frequency: 400.0,
            octaves: 2.0,
            stages: 4,
            feedback: 0.3,
            q: 1.0,
            mix: 0.5,
        }
    }
}

// === DELAY ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelaySettings {
    pub enabled: bool,
    pub delay_type: DelayType,
    pub time: f32,           // seconds (0.01-2.0)
    pub feedback: f32,       // 0-1
    pub mix: f32,            // 0-1
    pub tone: f32,           // 0-1 (for analog/tape)
    pub modulation: f32,     // 0-1 (for analog/tape)
    pub ping_pong_spread: f32, // stereo spread (0-1)
    pub tempo_sync: bool,
    pub subdivision: String, // "1/4", "1/8", etc.
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DelayType {
    Digital,
    Analog,
    Tape,
    Pingpong,
    Reverse,
}

impl Default for DelaySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            delay_type: DelayType::Digital,
            time: 0.25,
            feedback: 0.3,
            mix: 0.3,
            tone: 0.5,
            modulation: 0.0,
            ping_pong_spread: 1.0,
            tempo_sync: false,
            subdivision: "1/4".to_string(),
        }
    }
}

// === TREMOLO ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TremoloSettings {
    pub enabled: bool,
    pub rate: f32,           // Hz (0.1-20)
    pub depth: f32,          // 0-1
    pub waveform: TremoloWaveform,
    pub spread: f32,         // stereo (0-1)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TremoloWaveform {
    Sine,
    Triangle,
    Square,
    Sawtooth,
}

impl Default for TremoloSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 5.0,
            depth: 0.5,
            waveform: TremoloWaveform::Sine,
            spread: 0.0,
        }
    }
}

// === REVERB ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReverbSettings {
    pub enabled: bool,
    pub reverb_type: ReverbType,
    pub decay: f32,          // seconds (0.1-10)
    pub pre_delay: f32,      // ms (0-100)
    pub low_cut: f32,        // Hz
    pub high_cut: f32,       // Hz
    pub mix: f32,            // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReverbType {
    Room,
    Hall,
    Plate,
    Spring,
    Ambient,
}

impl Default for ReverbSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            reverb_type: ReverbType::Room,
            decay: 1.5,
            pre_delay: 20.0,
            low_cut: 100.0,
            high_cut: 8000.0,
            mix: 0.3,
        }
    }
}

// === LIMITER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LimiterSettings {
    pub enabled: bool,
    pub threshold: f32,      // dB (-12 to 0)
    pub release: f32,        // ms
    pub ceiling: f32,        // dB (-3 to 0)
}

impl Default for LimiterSettings {
    fn default() -> Self {
        Self {
            enabled: true,  // Limiter always on by default for safety
            threshold: -1.0,
            release: 50.0,
            ceiling: -0.3,
        }
    }
}

// === METERING ===
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectsMetering {
    pub noise_gate_open: bool,
    pub compressor_reduction: f32,  // dB
    pub limiter_reduction: f32,     // dB
}
