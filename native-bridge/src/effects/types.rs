//! Effects settings types - matching browser UnifiedEffectsChain

use serde::{Deserialize, Serialize};

/// Complete unified effects chain settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectsSettings {
    // Base effects (15) - all have defaults so partial updates work
    #[serde(default)]
    pub wah: WahSettings,
    #[serde(default)]
    pub overdrive: OverdriveSettings,
    #[serde(default)]
    pub distortion: DistortionSettings,
    #[serde(default)]
    pub amp: AmpSettings,
    #[serde(default)]
    pub cabinet: CabinetSettings,
    #[serde(default)]
    pub noise_gate: NoiseGateSettings,
    #[serde(default)]
    pub eq: EqSettings,
    #[serde(default)]
    pub compressor: CompressorSettings,
    #[serde(default)]
    pub chorus: ChorusSettings,
    #[serde(default)]
    pub flanger: FlangerSettings,
    #[serde(default)]
    pub phaser: PhaserSettings,
    #[serde(default)]
    pub delay: DelaySettings,
    #[serde(default)]
    pub tremolo: TremoloSettings,
    #[serde(default)]
    pub reverb: ReverbSettings,
    #[serde(default)]
    pub limiter: LimiterSettings,
    // Extended effects (20)
    #[serde(default)]
    pub pitch_correction: PitchCorrectionSettings,
    #[serde(default)]
    pub vocal_doubler: VocalDoublerSettings,
    #[serde(default)]
    pub de_esser: DeEsserSettings,
    #[serde(default)]
    pub formant_shifter: FormantShifterSettings,
    #[serde(default)]
    pub harmonizer: HarmonizerSettings,
    #[serde(default)]
    pub bitcrusher: BitcrusherSettings,
    #[serde(default)]
    pub ring_modulator: RingModulatorSettings,
    #[serde(default)]
    pub frequency_shifter: FrequencyShifterSettings,
    #[serde(default)]
    pub granular_delay: GranularDelaySettings,
    #[serde(default)]
    pub rotary_speaker: RotarySpeakerSettings,
    #[serde(default)]
    pub auto_pan: AutoPanSettings,
    #[serde(default)]
    pub multi_filter: MultiFilterSettings,
    #[serde(default)]
    pub vibrato: VibratoSettings,
    #[serde(default)]
    pub transient_shaper: TransientShaperSettings,
    #[serde(default)]
    pub stereo_imager: StereoImagerSettings,
    #[serde(default)]
    pub exciter: ExciterSettings,
    #[serde(default)]
    pub multiband_compressor: MultibandCompressorSettings,
    #[serde(default)]
    pub stereo_delay: StereoDelaySettings,
    #[serde(default)]
    pub room_simulator: RoomSimulatorSettings,
    #[serde(default)]
    pub shimmer_reverb: ShimmerReverbSettings,
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
            // Extended effects default to disabled
            pitch_correction: PitchCorrectionSettings::default(),
            vocal_doubler: VocalDoublerSettings::default(),
            de_esser: DeEsserSettings::default(),
            formant_shifter: FormantShifterSettings::default(),
            harmonizer: HarmonizerSettings::default(),
            bitcrusher: BitcrusherSettings::default(),
            ring_modulator: RingModulatorSettings::default(),
            frequency_shifter: FrequencyShifterSettings::default(),
            granular_delay: GranularDelaySettings::default(),
            rotary_speaker: RotarySpeakerSettings::default(),
            auto_pan: AutoPanSettings::default(),
            multi_filter: MultiFilterSettings::default(),
            vibrato: VibratoSettings::default(),
            transient_shaper: TransientShaperSettings::default(),
            stereo_imager: StereoImagerSettings::default(),
            exciter: ExciterSettings::default(),
            multiband_compressor: MultibandCompressorSettings::default(),
            stereo_delay: StereoDelaySettings::default(),
            room_simulator: RoomSimulatorSettings::default(),
            shimmer_reverb: ShimmerReverbSettings::default(),
        }
    }
}

// === WAH ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WahSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub mode: WahMode,
    #[serde(default = "default_wah_frequency")]
    pub frequency: f32, // 0-1 sweep position
    #[serde(default = "default_wah_resonance", alias = "q")]
    pub resonance: f32, // Q factor (also accepts "q" from frontend)
    #[serde(default = "default_wah_attack")]
    pub attack: f32,    // ms (for envelope mode)
    #[serde(default = "default_wah_release")]
    pub release: f32,   // ms
}

fn default_wah_frequency() -> f32 { 0.5 }
fn default_wah_resonance() -> f32 { 1.0 }
fn default_wah_attack() -> f32 { 10.0 }
fn default_wah_release() -> f32 { 100.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum WahMode {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_half")]
    pub drive: f32, // 0-1
    #[serde(default = "default_half")]
    pub tone: f32,  // 0-1
    #[serde(default = "default_half")]
    pub level: f32, // 0-1
}

fn default_half() -> f32 { 0.5 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, alias = "type")]
    pub distortion_type: DistortionType,
    #[serde(default = "default_half")]
    pub amount: f32, // 0-1
    #[serde(default = "default_half")]
    pub tone: f32,   // 0-1
    #[serde(default = "default_half")]
    pub level: f32,  // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DistortionType {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, alias = "type")]
    pub amp_type: AmpType,
    #[serde(default = "default_half")]
    pub gain: f32,     // 0-1
    #[serde(default = "default_half")]
    pub bass: f32,     // 0-1
    #[serde(default = "default_half")]
    pub mid: f32,      // 0-1
    #[serde(default = "default_half")]
    pub treble: f32,   // 0-1
    #[serde(default = "default_half")]
    pub presence: f32, // 0-1
    #[serde(default = "default_half")]
    pub master: f32,   // 0-1
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AmpType {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, alias = "type")]
    pub cabinet_type: CabinetType,
    #[serde(default)]
    pub mic_position: MicPosition,
    #[serde(default = "default_room_level")]
    pub room_level: f32, // 0-1
}

fn default_room_level() -> f32 { 0.3 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum CabinetType {
    #[serde(rename = "1x12")]
    C1x12,
    #[default]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum MicPosition {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_ng_threshold")]
    pub threshold: f32, // dB (-96 to 0)
    #[serde(default = "default_ng_attack")]
    pub attack: f32,    // ms
    #[serde(default = "default_ng_hold")]
    pub hold: f32,      // ms
    #[serde(default = "default_ng_release")]
    pub release: f32,   // ms
    #[serde(default = "default_ng_range")]
    pub range: f32,     // dB attenuation when closed
}

fn default_ng_threshold() -> f32 { -40.0 }
fn default_ng_attack() -> f32 { 0.1 }
fn default_ng_hold() -> f32 { 50.0 }
fn default_ng_release() -> f32 { 100.0 }
fn default_ng_range() -> f32 { -80.0 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub bands: Vec<EqBand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqBand {
    #[serde(default = "default_eq_frequency")]
    pub frequency: f32, // Hz
    #[serde(default)]
    pub gain: f32,      // dB (-24 to +24)
    #[serde(default = "default_eq_q")]
    pub q: f32,         // 0.1 to 10
    #[serde(default, alias = "type")]
    pub band_type: EqBandType,
}

fn default_eq_frequency() -> f32 { 1000.0 }
fn default_eq_q() -> f32 { 1.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum EqBandType {
    Lowshelf,
    #[default]
    Peak,
    Highshelf,
    #[serde(alias = "peaking")]
    Peaking,
}

impl Default for EqSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            bands: vec![
                EqBand {
                    frequency: 80.0,
                    gain: 0.0,
                    q: 0.7,
                    band_type: EqBandType::Lowshelf,
                },
                EqBand {
                    frequency: 240.0,
                    gain: 0.0,
                    q: 1.0,
                    band_type: EqBandType::Peak,
                },
                EqBand {
                    frequency: 750.0,
                    gain: 0.0,
                    q: 1.0,
                    band_type: EqBandType::Peak,
                },
                EqBand {
                    frequency: 2200.0,
                    gain: 0.0,
                    q: 1.0,
                    band_type: EqBandType::Peak,
                },
                EqBand {
                    frequency: 6000.0,
                    gain: 0.0,
                    q: 0.7,
                    band_type: EqBandType::Highshelf,
                },
            ],
        }
    }
}

// === COMPRESSOR ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressorSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_comp_threshold")]
    pub threshold: f32,   // dB (-60 to 0)
    #[serde(default = "default_comp_ratio")]
    pub ratio: f32,       // 1:1 to 20:1
    #[serde(default = "default_comp_attack")]
    pub attack: f32,      // ms
    #[serde(default = "default_comp_release")]
    pub release: f32,     // ms
    #[serde(default = "default_comp_knee")]
    pub knee: f32,        // dB (0-40)
    #[serde(default)]
    pub makeup_gain: f32, // dB (-12 to +24)
}

fn default_comp_threshold() -> f32 { -24.0 }
fn default_comp_ratio() -> f32 { 4.0 }
fn default_comp_attack() -> f32 { 10.0 }
fn default_comp_release() -> f32 { 100.0 }
fn default_comp_knee() -> f32 { 6.0 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_one")]
    pub rate: f32,     // Hz (0.1-10)
    #[serde(default = "default_half")]
    pub depth: f32,    // 0-1
    #[serde(default = "default_chorus_delay")]
    pub delay: f32,    // ms (2-20)
    #[serde(default = "default_feedback")]
    pub feedback: f32, // 0-1
    #[serde(default = "default_spread")]
    pub spread: f32,   // stereo spread (0-180 degrees)
    #[serde(default = "default_half")]
    pub mix: f32,      // 0-1
}

fn default_one() -> f32 { 1.0 }
fn default_feedback() -> f32 { 0.2 }
fn default_spread() -> f32 { 90.0 }
fn default_chorus_delay() -> f32 { 7.0 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_half")]
    pub rate: f32,      // Hz (0.05-5)
    #[serde(default = "default_half")]
    pub depth: f32,     // 0-1
    #[serde(default = "default_flanger_delay")]
    pub delay: f32,     // ms (0.5-10)
    #[serde(default = "default_half")]
    pub feedback: f32,  // -1 to 1
    #[serde(default = "default_half")]
    pub mix: f32,       // 0-1
    #[serde(default)]
    pub negative: bool, // invert feedback
}

fn default_flanger_delay() -> f32 { 2.0 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_half")]
    pub rate: f32,           // Hz
    #[serde(default = "default_half")]
    pub depth: f32,          // 0-1
    #[serde(default = "default_phaser_base_freq")]
    pub base_frequency: f32, // Hz
    #[serde(default = "default_phaser_octaves")]
    pub octaves: f32,        // sweep range
    #[serde(default = "default_phaser_stages")]
    pub stages: u32,         // 2-12 (even numbers)
    #[serde(default = "default_phaser_feedback")]
    pub feedback: f32,       // -1 to 1
    #[serde(default = "default_one")]
    pub q: f32,              // resonance
    #[serde(default = "default_half")]
    pub mix: f32,            // 0-1
}

fn default_phaser_base_freq() -> f32 { 400.0 }
fn default_phaser_octaves() -> f32 { 2.0 }
fn default_phaser_stages() -> u32 { 4 }
fn default_phaser_feedback() -> f32 { 0.3 }

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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, alias = "type")]
    pub delay_type: DelayType,
    #[serde(default = "default_delay_time")]
    pub time: f32,             // seconds (0.01-2.0)
    #[serde(default = "default_delay_feedback")]
    pub feedback: f32,         // 0-1
    #[serde(default = "default_delay_feedback")]
    pub mix: f32,              // 0-1
    #[serde(default = "default_half")]
    pub tone: f32,             // 0-1 (for analog/tape)
    #[serde(default)]
    pub modulation: f32,       // 0-1 (for analog/tape)
    #[serde(default = "default_one")]
    pub ping_pong_spread: f32, // stereo spread (0-1)
    #[serde(default)]
    pub tempo_sync: bool,
    #[serde(default = "default_subdivision")]
    pub subdivision: String, // "1/4", "1/8", etc.
}

fn default_delay_time() -> f32 { 0.25 }
fn default_delay_feedback() -> f32 { 0.3 }
fn default_subdivision() -> String { "1/4".to_string() }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DelayType {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_tremolo_rate")]
    pub rate: f32,  // Hz (0.1-20)
    #[serde(default = "default_half")]
    pub depth: f32, // 0-1
    #[serde(default)]
    pub waveform: TremoloWaveform,
    #[serde(default)]
    pub spread: f32, // stereo (0-1)
}

fn default_tremolo_rate() -> f32 { 5.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TremoloWaveform {
    #[default]
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
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, alias = "type")]
    pub reverb_type: ReverbType,
    #[serde(default = "default_reverb_decay")]
    pub decay: f32,     // seconds (0.1-10)
    #[serde(default = "default_reverb_predelay")]
    pub pre_delay: f32, // ms (0-100)
    #[serde(default = "default_reverb_lowcut")]
    pub low_cut: f32,   // Hz
    #[serde(default = "default_reverb_highcut")]
    pub high_cut: f32,  // Hz
    #[serde(default = "default_delay_feedback")]
    pub mix: f32,       // 0-1
}

fn default_reverb_decay() -> f32 { 1.5 }
fn default_reverb_predelay() -> f32 { 20.0 }
fn default_reverb_lowcut() -> f32 { 100.0 }
fn default_reverb_highcut() -> f32 { 8000.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ReverbType {
    #[default]
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
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_limiter_threshold")]
    pub threshold: f32, // dB (-12 to 0)
    #[serde(default = "default_limiter_release")]
    pub release: f32,   // ms
    #[serde(default = "default_limiter_ceiling")]
    pub ceiling: f32,   // dB (-3 to 0)
}

fn default_true() -> bool { true }
fn default_limiter_threshold() -> f32 { -1.0 }
fn default_limiter_release() -> f32 { 50.0 }
fn default_limiter_ceiling() -> f32 { -0.3 }

impl Default for LimiterSettings {
    fn default() -> Self {
        Self {
            enabled: true, // Limiter always on by default for safety
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
    pub compressor_reduction: f32, // dB
    pub limiter_reduction: f32,    // dB
}

// ============================================================================
// EXTENDED EFFECTS (20 additional effects)
// ============================================================================

// === PITCH CORRECTION / AUTO-TUNE ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchCorrectionSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_key")]
    pub key: String, // C, C#, D, etc.
    #[serde(default)]
    pub scale: PitchCorrectionScale,
    #[serde(default = "default_fifty")]
    pub speed: f32,    // 0-100 (correction speed)
    #[serde(default = "default_thirty")]
    pub humanize: f32, // 0-100 (natural variation)
    #[serde(default = "default_true")]
    pub formant_preserve: bool,
    #[serde(default)]
    pub detune: f32, // -100 to +100 cents
    #[serde(default = "default_hundred")]
    pub mix: f32,    // 0-100
}

fn default_key() -> String { "C".to_string() }
fn default_fifty() -> f32 { 50.0 }
fn default_thirty() -> f32 { 30.0 }
fn default_hundred() -> f32 { 100.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PitchCorrectionScale {
    #[default]
    Chromatic,
    Major,
    Minor,
    PentatonicMajor,
    PentatonicMinor,
    Blues,
    Dorian,
    Mixolydian,
    HarmonicMinor,
}

impl Default for PitchCorrectionSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            key: "C".to_string(),
            scale: PitchCorrectionScale::Chromatic,
            speed: 50.0,
            humanize: 30.0,
            formant_preserve: true,
            detune: 0.0,
            mix: 100.0,
        }
    }
}

// === VOCAL DOUBLER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VocalDoublerSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_vd_detune")]
    pub detune: f32, // 0-50 cents
    #[serde(default = "default_vd_delay")]
    pub delay: f32,  // 0-50 ms
    #[serde(default = "default_vd_spread")]
    pub spread: f32, // 0-100 (stereo width)
    #[serde(default = "default_thirty")]
    pub depth: f32,  // 0-100 (modulation depth)
    #[serde(default = "default_fifty")]
    pub mix: f32,    // 0-100
    #[serde(default = "default_vd_voices")]
    pub voices: u8,  // 1-4
}

fn default_vd_detune() -> f32 { 15.0 }
fn default_vd_delay() -> f32 { 20.0 }
fn default_vd_spread() -> f32 { 80.0 }
fn default_vd_voices() -> u8 { 2 }

impl Default for VocalDoublerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            detune: 15.0,
            delay: 20.0,
            spread: 80.0,
            depth: 30.0,
            mix: 50.0,
            voices: 2,
        }
    }
}

// === DE-ESSER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeEsserSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_deesser_freq")]
    pub frequency: f32, // 2000-10000 Hz
    #[serde(default = "default_deesser_threshold")]
    pub threshold: f32, // -60 to 0 dB
    #[serde(default = "default_deesser_reduction")]
    pub reduction: f32, // 0-24 dB
    #[serde(default = "default_deesser_range")]
    pub range: f32,     // 0-24 dB
    #[serde(default = "default_half")]
    pub attack: f32,    // 0.1-10 ms
    #[serde(default = "default_fifty")]
    pub release: f32,   // 10-500 ms
    #[serde(default)]
    pub mode: DeEsserMode,
    #[serde(default)]
    pub listen_mode: bool,
}

fn default_deesser_freq() -> f32 { 6000.0 }
fn default_deesser_threshold() -> f32 { -30.0 }
fn default_deesser_reduction() -> f32 { 6.0 }
fn default_deesser_range() -> f32 { 12.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DeEsserMode {
    #[default]
    Split,
    Wideband,
}

impl Default for DeEsserSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: 6000.0,
            threshold: -30.0,
            reduction: 6.0,
            range: 12.0,
            attack: 0.5,
            release: 50.0,
            mode: DeEsserMode::Split,
            listen_mode: false,
        }
    }
}

// === FORMANT SHIFTER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormantShifterSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub shift: f32,  // -12 to +12 semitones
    #[serde(default)]
    pub gender: f32, // -100 to +100
    #[serde(default = "default_true")]
    pub preserve_pitch: bool,
    #[serde(default = "default_hundred")]
    pub mix: f32, // 0-100
}

impl Default for FormantShifterSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            shift: 0.0,
            gender: 0.0,
            preserve_pitch: true,
            mix: 100.0,
        }
    }
}

// === HARMONIZER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarmonizerSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub harmony_type: HarmonyType,
    #[serde(default = "default_key")]
    pub key: String,
    #[serde(default)]
    pub scale: PitchCorrectionScale,
    #[serde(default = "default_voice1_interval")]
    pub voice1_interval: i8, // -24 to +24 semitones
    #[serde(default = "default_voice_level")]
    pub voice1_level: f32,   // 0-100
    #[serde(default)]
    pub voice2_interval: i8,
    #[serde(default)]
    pub voice2_level: f32,
    #[serde(default)]
    pub voice3_interval: i8,
    #[serde(default)]
    pub voice3_level: f32,
    #[serde(default = "default_true")]
    pub formant_preserve: bool,
    #[serde(default = "default_fifty")]
    pub mix: f32, // 0-100
}

fn default_voice1_interval() -> i8 { 4 }
fn default_voice_level() -> f32 { 70.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub enum HarmonyType {
    #[default]
    Third,
    Fifth,
    Octave,
    PowerChord,
    MajorChord,
    MinorChord,
    Custom,
}

impl Default for HarmonizerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            harmony_type: HarmonyType::Third,
            key: "C".to_string(),
            scale: PitchCorrectionScale::Major,
            voice1_interval: 4,
            voice1_level: 70.0,
            voice2_interval: 0,
            voice2_level: 0.0,
            voice3_interval: 0,
            voice3_level: 0.0,
            formant_preserve: true,
            mix: 50.0,
        }
    }
}

// === BITCRUSHER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitcrusherSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_bc_bits", alias = "bits")]
    pub bit_depth: f32,   // 1-16 bits
    #[serde(default = "default_bc_sr")]
    pub sample_rate: f32, // 500-48000 Hz (downsampling)
    #[serde(default)]
    pub dither: bool,
    #[serde(default = "default_hundred")]
    pub mix: f32, // 0-100
}

fn default_bc_bits() -> f32 { 8.0 }
fn default_bc_sr() -> f32 { 8000.0 }

impl Default for BitcrusherSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            bit_depth: 8.0,
            sample_rate: 8000.0,
            dither: false,
            mix: 100.0,
        }
    }
}

// === RING MODULATOR ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RingModulatorSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_rm_freq")]
    pub frequency: f32, // 20-2000 Hz
    #[serde(default)]
    pub waveform: RingModWaveform,
    #[serde(default)]
    pub lfo_rate: f32,  // 0.1-10 Hz (modulation of carrier)
    #[serde(default)]
    pub lfo_depth: f32, // 0-100
    #[serde(default = "default_hundred")]
    pub mix: f32,       // 0-100
}

fn default_rm_freq() -> f32 { 440.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RingModWaveform {
    #[default]
    Sine,
    Triangle,
    Square,
    Sawtooth,
}

impl Default for RingModulatorSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: 440.0,
            waveform: RingModWaveform::Sine,
            lfo_rate: 0.0,
            lfo_depth: 0.0,
            mix: 100.0,
        }
    }
}

// === FREQUENCY SHIFTER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyShifterSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub shift: f32,     // -2000 to +2000 Hz
    #[serde(default)]
    pub lfo_rate: f32,  // 0.1-10 Hz
    #[serde(default)]
    pub lfo_depth: f32, // 0-100
    #[serde(default)]
    pub feedback: f32,  // 0-100
    #[serde(default = "default_hundred")]
    pub mix: f32,       // 0-100
}

impl Default for FrequencyShifterSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            shift: 0.0,
            lfo_rate: 0.0,
            lfo_depth: 0.0,
            feedback: 0.0,
            mix: 100.0,
        }
    }
}

// === GRANULAR DELAY ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GranularDelaySettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_gd_delay")]
    pub delay_time: f32, // 10-2000 ms
    #[serde(default = "default_gd_grain")]
    pub grain_size: f32, // 10-500 ms
    #[serde(default)]
    pub pitch: f32,      // -24 to +24 semitones
    #[serde(default = "default_fifty")]
    pub density: f32,    // 0-100
    #[serde(default = "default_fifty")]
    pub spread: f32,     // stereo spread 0-100
    #[serde(default = "default_thirty")]
    pub feedback: f32,   // 0-100
    #[serde(default = "default_thirty")]
    pub texture: f32,    // randomness 0-100
    #[serde(default = "default_fifty")]
    pub mix: f32,        // 0-100
}

fn default_gd_delay() -> f32 { 250.0 }
fn default_gd_grain() -> f32 { 50.0 }

impl Default for GranularDelaySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            delay_time: 250.0,
            grain_size: 50.0,
            pitch: 0.0,
            density: 50.0,
            spread: 50.0,
            feedback: 30.0,
            texture: 30.0,
            mix: 50.0,
        }
    }
}

// === ROTARY SPEAKER (LESLIE) ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RotarySpeakerSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub speed: RotarySpeed,
    #[serde(default = "default_rs_slow")]
    pub slow_rate: f32,    // 0.5-2 Hz
    #[serde(default = "default_rs_fast")]
    pub fast_rate: f32,    // 5-10 Hz
    #[serde(default = "default_fifty")]
    pub acceleration: f32, // ramp time 0-100
    #[serde(default = "default_rs_horn")]
    pub horn_level: f32,   // 0-100
    #[serde(default = "default_rs_drum")]
    pub drum_level: f32,   // 0-100
    #[serde(default = "default_thirty")]
    pub drive: f32,        // 0-100
    #[serde(default = "default_hundred")]
    pub mix: f32,          // 0-100
}

fn default_rs_slow() -> f32 { 0.8 }
fn default_rs_fast() -> f32 { 6.0 }
fn default_rs_horn() -> f32 { 80.0 }
fn default_rs_drum() -> f32 { 60.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RotarySpeed {
    Stop,
    #[default]
    Slow,
    Fast,
}

impl Default for RotarySpeakerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            speed: RotarySpeed::Slow,
            slow_rate: 0.8,
            fast_rate: 6.0,
            acceleration: 50.0,
            horn_level: 80.0,
            drum_level: 60.0,
            drive: 30.0,
            mix: 100.0,
        }
    }
}

// === AUTO PAN ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoPanSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_one")]
    pub rate: f32,  // 0.1-10 Hz
    #[serde(default = "default_hundred")]
    pub depth: f32, // 0-100
    #[serde(default)]
    pub waveform: AutoPanWaveform,
    #[serde(default)]
    pub phase: f32, // 0-360 degrees
    #[serde(default)]
    pub tempo_sync: bool,
    #[serde(default = "default_subdivision")]
    pub subdivision: String, // "1/4", "1/8", etc.
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum AutoPanWaveform {
    #[default]
    Sine,
    Triangle,
    Square,
    Sawtooth,
}

impl Default for AutoPanSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 1.0,
            depth: 100.0,
            waveform: AutoPanWaveform::Sine,
            phase: 0.0,
            tempo_sync: false,
            subdivision: "1/4".to_string(),
        }
    }
}

// === MULTI-FILTER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiFilterSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub filter_type: MultiFilterType,
    #[serde(default = "default_mf_frequency")]
    pub frequency: f32,        // 20-20000 Hz
    #[serde(default = "default_mf_resonance")]
    pub resonance: f32,        // 0-100
    #[serde(default)]
    pub lfo_rate: f32,         // 0.1-10 Hz
    #[serde(default)]
    pub lfo_depth: f32,        // 0-100
    #[serde(default)]
    pub envelope_amount: f32,  // 0-100
    #[serde(default = "default_mf_attack")]
    pub envelope_attack: f32,  // ms
    #[serde(default = "default_mf_release")]
    pub envelope_release: f32, // ms
}

fn default_mf_frequency() -> f32 { 1000.0 }
fn default_mf_resonance() -> f32 { 30.0 }
fn default_mf_attack() -> f32 { 10.0 }
fn default_mf_release() -> f32 { 100.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum MultiFilterType {
    #[default]
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
    Formant,
}

impl Default for MultiFilterSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            filter_type: MultiFilterType::Lowpass,
            frequency: 1000.0,
            resonance: 30.0,
            lfo_rate: 0.5,
            lfo_depth: 0.0,
            envelope_amount: 0.0,
            envelope_attack: 10.0,
            envelope_release: 100.0,
        }
    }
}

// === VIBRATO ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VibratoSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_tremolo_rate")]
    pub rate: f32,  // 0.1-10 Hz
    #[serde(default = "default_thirty")]
    pub depth: f32, // 0-100 (cents)
    #[serde(default)]
    pub waveform: VibratoWaveform,
    #[serde(default)]
    pub delay: f32, // onset delay ms
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum VibratoWaveform {
    #[default]
    Sine,
    Triangle,
}

impl Default for VibratoSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            rate: 5.0,
            depth: 30.0,
            waveform: VibratoWaveform::Sine,
            delay: 0.0,
        }
    }
}

// === TRANSIENT SHAPER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransientShaperSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub attack: f32,       // -100 to +100
    #[serde(default)]
    pub sustain: f32,      // -100 to +100
    #[serde(default = "default_comp_attack")]
    pub attack_time: f32,  // ms
    #[serde(default = "default_comp_release")]
    pub release_time: f32, // ms
    #[serde(default)]
    pub output_gain: f32,  // dB
}

impl Default for TransientShaperSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            attack: 0.0,
            sustain: 0.0,
            attack_time: 10.0,
            release_time: 100.0,
            output_gain: 0.0,
        }
    }
}

// === STEREO IMAGER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StereoImagerSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_hundred")]
    pub width: f32,      // 0-200 (100 = normal)
    #[serde(default)]
    pub center: f32,     // pan center -100 to +100
    #[serde(default = "default_hundred")]
    pub low_width: f32,  // bass width 0-200
    #[serde(default = "default_hundred")]
    pub high_width: f32, // treble width 0-200
    #[serde(default = "default_si_crossover")]
    pub crossover: f32,  // Hz
    #[serde(default)]
    pub mono_bass: bool,
    #[serde(default = "default_si_mono_bass")]
    pub mono_bass_freq: f32, // Hz
}

fn default_si_crossover() -> f32 { 300.0 }
fn default_si_mono_bass() -> f32 { 120.0 }

impl Default for StereoImagerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            width: 100.0,
            center: 0.0,
            low_width: 100.0,
            high_width: 100.0,
            crossover: 300.0,
            mono_bass: false,
            mono_bass_freq: 120.0,
        }
    }
}

// === EXCITER ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExciterSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_ex_freq")]
    pub frequency: f32, // crossover Hz
    #[serde(default = "default_thirty")]
    pub amount: f32,    // 0-100
    #[serde(default = "default_fifty")]
    pub color: f32,     // 0-100 (brightness)
    #[serde(default = "default_fifty")]
    pub dynamics: f32,  // 0-100
    #[serde(default = "default_hundred")]
    pub mix: f32,       // 0-100
}

fn default_ex_freq() -> f32 { 3000.0 }

impl Default for ExciterSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            frequency: 3000.0,
            amount: 30.0,
            color: 50.0,
            dynamics: 50.0,
            mix: 100.0,
        }
    }
}

// === MULTIBAND COMPRESSOR ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultibandCompressorSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_mb_low")]
    pub low_crossover: f32,  // Hz
    #[serde(default = "default_mb_high")]
    pub high_crossover: f32, // Hz
    #[serde(default)]
    pub low_band: CompressorBand,
    #[serde(default)]
    pub mid_band: CompressorBand,
    #[serde(default)]
    pub high_band: CompressorBand,
    #[serde(default)]
    pub output_gain: f32, // dB
}

fn default_mb_low() -> f32 { 200.0 }
fn default_mb_high() -> f32 { 2000.0 }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CompressorBand {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_cb_threshold")]
    pub threshold: f32, // dB
    #[serde(default = "default_comp_ratio")]
    pub ratio: f32,
    #[serde(default = "default_comp_attack")]
    pub attack: f32,  // ms
    #[serde(default = "default_comp_release")]
    pub release: f32, // ms
    #[serde(default)]
    pub makeup: f32,  // dB
    #[serde(default)]
    pub solo: bool,
    #[serde(default)]
    pub mute: bool,
}

fn default_cb_threshold() -> f32 { -20.0 }

impl Default for CompressorBand {
    fn default() -> Self {
        Self {
            enabled: true,
            threshold: -20.0,
            ratio: 4.0,
            attack: 10.0,
            release: 100.0,
            makeup: 0.0,
            solo: false,
            mute: false,
        }
    }
}

impl Default for MultibandCompressorSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            low_crossover: 200.0,
            high_crossover: 2000.0,
            low_band: CompressorBand::default(),
            mid_band: CompressorBand::default(),
            high_band: CompressorBand::default(),
            output_gain: 0.0,
        }
    }
}

// === STEREO DELAY ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StereoDelaySettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_sd_left")]
    pub left_time: f32,      // ms
    #[serde(default = "default_sd_right")]
    pub right_time: f32,     // ms
    #[serde(default = "default_thirty")]
    pub left_feedback: f32,  // 0-100
    #[serde(default = "default_thirty")]
    pub right_feedback: f32, // 0-100
    #[serde(default = "default_sd_cross")]
    pub cross_feedback: f32, // 0-100
    #[serde(default = "default_reverb_lowcut")]
    pub low_cut: f32,        // Hz
    #[serde(default = "default_reverb_highcut")]
    pub high_cut: f32,       // Hz
    #[serde(default)]
    pub tempo_sync: bool,
    #[serde(default = "default_subdivision")]
    pub left_subdivision: String,
    #[serde(default = "default_sd_right_sub")]
    pub right_subdivision: String,
    #[serde(default = "default_thirty")]
    pub mix: f32, // 0-100
}

fn default_sd_left() -> f32 { 250.0 }
fn default_sd_right() -> f32 { 375.0 }
fn default_sd_cross() -> f32 { 10.0 }
fn default_sd_right_sub() -> String { "1/4 dot".to_string() }

impl Default for StereoDelaySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            left_time: 250.0,
            right_time: 375.0,
            left_feedback: 30.0,
            right_feedback: 30.0,
            cross_feedback: 10.0,
            low_cut: 100.0,
            high_cut: 8000.0,
            tempo_sync: false,
            left_subdivision: "1/4".to_string(),
            right_subdivision: "1/4 dot".to_string(),
            mix: 30.0,
        }
    }
}

// === ROOM SIMULATOR ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomSimulatorSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub size: RoomSize,
    #[serde(default = "default_fifty")]
    pub damping: f32,     // 0-100
    #[serde(default = "default_voice_level")]
    pub early_level: f32, // 0-100
    #[serde(default = "default_rs_drum")]
    pub late_level: f32,  // 0-100
    #[serde(default = "default_reverb_decay")]
    pub decay: f32,       // 0.1-5 seconds
    #[serde(default = "default_reverb_predelay")]
    pub pre_delay: f32,   // 0-100 ms
    #[serde(default = "default_voice_level")]
    pub diffusion: f32,   // 0-100
    #[serde(default = "default_room_mod")]
    pub modulation: f32,  // 0-100
    #[serde(default = "default_thirty")]
    pub mix: f32,         // 0-100
}

fn default_room_mod() -> f32 { 20.0 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RoomSize {
    Small,
    #[default]
    Medium,
    Large,
    Hall,
}

impl Default for RoomSimulatorSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            size: RoomSize::Medium,
            damping: 50.0,
            early_level: 70.0,
            late_level: 60.0,
            decay: 1.5,
            pre_delay: 20.0,
            diffusion: 70.0,
            modulation: 20.0,
            mix: 30.0,
        }
    }
}

// === SHIMMER REVERB ===
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShimmerReverbSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_shimmer_decay")]
    pub decay: f32,      // 0.5-10 seconds
    #[serde(default = "default_fifty")]
    pub shimmer: f32,    // 0-100
    #[serde(default = "default_shimmer_pitch")]
    pub pitch: i8,       // 0, 5, 7, 12, 19, 24 semitones
    #[serde(default = "default_fifty")]
    pub damping: f32,    // 0-100
    #[serde(default = "default_fifty")]
    pub tone: f32,       // 0-100
    #[serde(default = "default_thirty")]
    pub modulation: f32, // 0-100
    #[serde(default = "default_thirty")]
    pub pre_delay: f32,  // 0-100 ms
    #[serde(default = "default_shimmer_diffusion")]
    pub diffusion: f32,  // 0-100
    #[serde(default = "default_thirty")]
    pub mix: f32,        // 0-100
}

fn default_shimmer_decay() -> f32 { 3.0 }
fn default_shimmer_pitch() -> i8 { 12 }
fn default_shimmer_diffusion() -> f32 { 80.0 }

impl Default for ShimmerReverbSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            decay: 3.0,
            shimmer: 50.0,
            pitch: 12, // octave up
            damping: 50.0,
            tone: 50.0,
            modulation: 30.0,
            pre_delay: 30.0,
            diffusion: 80.0,
            mix: 30.0,
        }
    }
}
