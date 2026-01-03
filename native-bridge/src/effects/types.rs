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
    pub enabled: bool,
    pub mode: WahMode,
    pub frequency: f32, // 0-1 sweep position
    pub resonance: f32, // Q factor
    pub attack: f32,    // ms (for envelope mode)
    pub release: f32,   // ms
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
    pub drive: f32, // 0-1
    pub tone: f32,  // 0-1
    pub level: f32, // 0-1
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
    pub amount: f32, // 0-1
    pub tone: f32,   // 0-1
    pub level: f32,  // 0-1
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
    pub gain: f32,     // 0-1
    pub bass: f32,     // 0-1
    pub mid: f32,      // 0-1
    pub treble: f32,   // 0-1
    pub presence: f32, // 0-1
    pub master: f32,   // 0-1
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
    pub room_level: f32, // 0-1
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
    pub threshold: f32, // dB (-96 to 0)
    pub attack: f32,    // ms
    pub hold: f32,      // ms
    pub release: f32,   // ms
    pub range: f32,     // dB attenuation when closed
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
    pub frequency: f32, // Hz
    pub gain: f32,      // dB (-24 to +24)
    pub q: f32,         // 0.1 to 10
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
    pub enabled: bool,
    pub threshold: f32,   // dB (-60 to 0)
    pub ratio: f32,       // 1:1 to 20:1
    pub attack: f32,      // ms
    pub release: f32,     // ms
    pub knee: f32,        // dB (0-40)
    pub makeup_gain: f32, // dB (-12 to +24)
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
    pub rate: f32,     // Hz (0.1-10)
    pub depth: f32,    // 0-1
    pub delay: f32,    // ms (2-20)
    pub feedback: f32, // 0-1
    pub spread: f32,   // stereo spread (0-180 degrees)
    pub mix: f32,      // 0-1
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
    pub rate: f32,      // Hz (0.05-5)
    pub depth: f32,     // 0-1
    pub delay: f32,     // ms (0.5-10)
    pub feedback: f32,  // -1 to 1
    pub mix: f32,       // 0-1
    pub negative: bool, // invert feedback
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
    pub time: f32,             // seconds (0.01-2.0)
    pub feedback: f32,         // 0-1
    pub mix: f32,              // 0-1
    pub tone: f32,             // 0-1 (for analog/tape)
    pub modulation: f32,       // 0-1 (for analog/tape)
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
    pub rate: f32,  // Hz (0.1-20)
    pub depth: f32, // 0-1
    pub waveform: TremoloWaveform,
    pub spread: f32, // stereo (0-1)
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
    pub decay: f32,     // seconds (0.1-10)
    pub pre_delay: f32, // ms (0-100)
    pub low_cut: f32,   // Hz
    pub high_cut: f32,  // Hz
    pub mix: f32,       // 0-1
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
    pub threshold: f32, // dB (-12 to 0)
    pub release: f32,   // ms
    pub ceiling: f32,   // dB (-3 to 0)
}

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
    pub enabled: bool,
    pub key: String, // C, C#, D, etc.
    pub scale: PitchCorrectionScale,
    pub speed: f32,    // 0-100 (correction speed)
    pub humanize: f32, // 0-100 (natural variation)
    pub formant_preserve: bool,
    pub detune: f32, // -100 to +100 cents
    pub mix: f32,    // 0-100
}

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
    pub enabled: bool,
    pub detune: f32, // 0-50 cents
    pub delay: f32,  // 0-50 ms
    pub spread: f32, // 0-100 (stereo width)
    pub depth: f32,  // 0-100 (modulation depth)
    pub mix: f32,    // 0-100
    pub voices: u8,  // 1-4
}

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
    pub enabled: bool,
    pub frequency: f32, // 2000-10000 Hz
    pub threshold: f32, // -60 to 0 dB
    pub reduction: f32, // 0-24 dB
    pub range: f32,     // 0-24 dB
    pub attack: f32,    // 0.1-10 ms
    pub release: f32,   // 10-500 ms
    pub mode: DeEsserMode,
    pub listen_mode: bool,
}

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
    pub enabled: bool,
    pub shift: f32,  // -12 to +12 semitones
    pub gender: f32, // -100 to +100
    pub preserve_pitch: bool,
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
    pub enabled: bool,
    pub harmony_type: HarmonyType,
    pub key: String,
    pub scale: PitchCorrectionScale,
    pub voice1_interval: i8, // -24 to +24 semitones
    pub voice1_level: f32,   // 0-100
    pub voice2_interval: i8,
    pub voice2_level: f32,
    pub voice3_interval: i8,
    pub voice3_level: f32,
    pub formant_preserve: bool,
    pub mix: f32, // 0-100
}

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
    pub enabled: bool,
    pub bit_depth: f32,   // 1-16 bits
    pub sample_rate: f32, // 500-48000 Hz (downsampling)
    pub dither: bool,
    pub mix: f32, // 0-100
}

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
    pub enabled: bool,
    pub frequency: f32, // 20-2000 Hz
    pub waveform: RingModWaveform,
    pub lfo_rate: f32,  // 0.1-10 Hz (modulation of carrier)
    pub lfo_depth: f32, // 0-100
    pub mix: f32,       // 0-100
}

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
    pub enabled: bool,
    pub shift: f32,     // -2000 to +2000 Hz
    pub lfo_rate: f32,  // 0.1-10 Hz
    pub lfo_depth: f32, // 0-100
    pub feedback: f32,  // 0-100
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
    pub enabled: bool,
    pub delay_time: f32, // 10-2000 ms
    pub grain_size: f32, // 10-500 ms
    pub pitch: f32,      // -24 to +24 semitones
    pub density: f32,    // 0-100
    pub spread: f32,     // stereo spread 0-100
    pub feedback: f32,   // 0-100
    pub texture: f32,    // randomness 0-100
    pub mix: f32,        // 0-100
}

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
    pub enabled: bool,
    pub speed: RotarySpeed,
    pub slow_rate: f32,    // 0.5-2 Hz
    pub fast_rate: f32,    // 5-10 Hz
    pub acceleration: f32, // ramp time 0-100
    pub horn_level: f32,   // 0-100
    pub drum_level: f32,   // 0-100
    pub drive: f32,        // 0-100
    pub mix: f32,          // 0-100
}

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
    pub enabled: bool,
    pub rate: f32,  // 0.1-10 Hz
    pub depth: f32, // 0-100
    pub waveform: AutoPanWaveform,
    pub phase: f32, // 0-360 degrees
    pub tempo_sync: bool,
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
    pub enabled: bool,
    pub filter_type: MultiFilterType,
    pub frequency: f32,        // 20-20000 Hz
    pub resonance: f32,        // 0-100
    pub lfo_rate: f32,         // 0.1-10 Hz
    pub lfo_depth: f32,        // 0-100
    pub envelope_amount: f32,  // 0-100
    pub envelope_attack: f32,  // ms
    pub envelope_release: f32, // ms
}

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
    pub enabled: bool,
    pub rate: f32,  // 0.1-10 Hz
    pub depth: f32, // 0-100 (cents)
    pub waveform: VibratoWaveform,
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
    pub enabled: bool,
    pub attack: f32,       // -100 to +100
    pub sustain: f32,      // -100 to +100
    pub attack_time: f32,  // ms
    pub release_time: f32, // ms
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
    pub enabled: bool,
    pub width: f32,      // 0-200 (100 = normal)
    pub center: f32,     // pan center -100 to +100
    pub low_width: f32,  // bass width 0-200
    pub high_width: f32, // treble width 0-200
    pub crossover: f32,  // Hz
    pub mono_bass: bool,
    pub mono_bass_freq: f32, // Hz
}

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
    pub enabled: bool,
    pub frequency: f32, // crossover Hz
    pub amount: f32,    // 0-100
    pub color: f32,     // 0-100 (brightness)
    pub dynamics: f32,  // 0-100
    pub mix: f32,       // 0-100
}

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
    pub enabled: bool,
    pub low_crossover: f32,  // Hz
    pub high_crossover: f32, // Hz
    pub low_band: CompressorBand,
    pub mid_band: CompressorBand,
    pub high_band: CompressorBand,
    pub output_gain: f32, // dB
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressorBand {
    pub enabled: bool,
    pub threshold: f32, // dB
    pub ratio: f32,
    pub attack: f32,  // ms
    pub release: f32, // ms
    pub makeup: f32,  // dB
    pub solo: bool,
    pub mute: bool,
}

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
    pub enabled: bool,
    pub left_time: f32,      // ms
    pub right_time: f32,     // ms
    pub left_feedback: f32,  // 0-100
    pub right_feedback: f32, // 0-100
    pub cross_feedback: f32, // 0-100
    pub low_cut: f32,        // Hz
    pub high_cut: f32,       // Hz
    pub tempo_sync: bool,
    pub left_subdivision: String,
    pub right_subdivision: String,
    pub mix: f32, // 0-100
}

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
    pub enabled: bool,
    pub size: RoomSize,
    pub damping: f32,     // 0-100
    pub early_level: f32, // 0-100
    pub late_level: f32,  // 0-100
    pub decay: f32,       // 0.1-5 seconds
    pub pre_delay: f32,   // 0-100 ms
    pub diffusion: f32,   // 0-100
    pub modulation: f32,  // 0-100
    pub mix: f32,         // 0-100
}

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
    pub enabled: bool,
    pub decay: f32,      // 0.5-10 seconds
    pub shimmer: f32,    // 0-100
    pub pitch: i8,       // 0, 5, 7, 12, 19, 24 semitones
    pub damping: f32,    // 0-100
    pub tone: f32,       // 0-100
    pub modulation: f32, // 0-100
    pub pre_delay: f32,  // 0-100 ms
    pub diffusion: f32,  // 0-100
    pub mix: f32,        // 0-100
}

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
