//! Harmonizer - adds harmony voices at musical intervals
//!
//! Creates up to 3 additional voices at scale-correct intervals.

use super::dsp::{crossfade, OnePoleLowpass};
use super::pitch::{key_to_offset, PitchDetector, PitchShifter, Scale};
use super::types::{HarmonizerSettings, HarmonyType, PitchCorrectionScale};
use super::AudioEffect;

/// A single harmony voice
struct HarmonyVoice {
    shifter_l: PitchShifter,
    shifter_r: PitchShifter,
    interval: i8,  // Semitones
    level: f32,    // 0-1
    enabled: bool,
}

impl HarmonyVoice {
    fn new(sample_rate: u32) -> Self {
        Self {
            shifter_l: PitchShifter::new(sample_rate),
            shifter_r: PitchShifter::new(sample_rate),
            interval: 0,
            level: 0.0,
            enabled: false,
        }
    }

    fn set_sample_rate(&mut self, rate: u32) {
        self.shifter_l.set_sample_rate(rate);
        self.shifter_r.set_sample_rate(rate);
    }

    fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        if !self.enabled || self.level < 0.01 {
            return (0.0, 0.0);
        }

        self.shifter_l.set_semitones(self.interval as f32);
        self.shifter_r.set_semitones(self.interval as f32);

        let out_l = self.shifter_l.process(left) * self.level;
        let out_r = self.shifter_r.process(right) * self.level;

        (out_l, out_r)
    }

    fn reset(&mut self) {
        self.shifter_l.reset();
        self.shifter_r.reset();
    }
}

pub struct Harmonizer {
    settings: HarmonizerSettings,
    sample_rate: u32,
    enabled: bool,

    // Three harmony voices
    voice1: HarmonyVoice,
    voice2: HarmonyVoice,
    voice3: HarmonyVoice,

    // Pitch detection for intelligent harmonies
    detector: PitchDetector,
    detected_pitch: f32,

    // Key/scale context
    key_offset: i32,
    scale: Scale,
}

impl Harmonizer {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: HarmonizerSettings::default(),
            sample_rate,
            enabled: false,
            voice1: HarmonyVoice::new(sample_rate),
            voice2: HarmonyVoice::new(sample_rate),
            voice3: HarmonyVoice::new(sample_rate),
            detector: PitchDetector::new(sample_rate),
            detected_pitch: 0.0,
            key_offset: 0,
            scale: Scale::Major,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        self.voice1.set_sample_rate(rate);
        self.voice2.set_sample_rate(rate);
        self.voice3.set_sample_rate(rate);
        self.detector.set_sample_rate(rate);
    }

    pub fn update_settings(&mut self, settings: HarmonizerSettings) {
        self.enabled = settings.enabled;

        // Update key/scale
        self.key_offset = key_to_offset(&settings.key);
        self.scale = match settings.scale {
            PitchCorrectionScale::Major => Scale::Major,
            PitchCorrectionScale::Minor => Scale::Minor,
            PitchCorrectionScale::PentatonicMajor => Scale::PentatonicMajor,
            PitchCorrectionScale::PentatonicMinor => Scale::PentatonicMinor,
            PitchCorrectionScale::Blues => Scale::Blues,
            PitchCorrectionScale::Dorian => Scale::Dorian,
            PitchCorrectionScale::Mixolydian => Scale::Mixolydian,
            PitchCorrectionScale::HarmonicMinor => Scale::HarmonicMinor,
            _ => Scale::Chromatic,
        };

        // Set up voices based on harmony type
        self.setup_harmony_type(&settings.harmony_type);

        // Override with custom intervals if set
        self.voice1.interval = settings.voice1_interval;
        self.voice1.level = settings.voice1_level / 100.0;
        self.voice1.enabled = settings.voice1_level > 0.0;

        self.voice2.interval = settings.voice2_interval;
        self.voice2.level = settings.voice2_level / 100.0;
        self.voice2.enabled = settings.voice2_level > 0.0;

        self.voice3.interval = settings.voice3_interval;
        self.voice3.level = settings.voice3_level / 100.0;
        self.voice3.enabled = settings.voice3_level > 0.0;

        self.settings = settings;
    }

    fn setup_harmony_type(&mut self, harmony_type: &HarmonyType) {
        match harmony_type {
            HarmonyType::Third => {
                self.voice1.interval = 4; // Major third
                self.voice1.level = 0.7;
                self.voice1.enabled = true;
                self.voice2.enabled = false;
                self.voice3.enabled = false;
            }
            HarmonyType::Fifth => {
                self.voice1.interval = 7; // Perfect fifth
                self.voice1.level = 0.7;
                self.voice1.enabled = true;
                self.voice2.enabled = false;
                self.voice3.enabled = false;
            }
            HarmonyType::Octave => {
                self.voice1.interval = 12;
                self.voice1.level = 0.5;
                self.voice1.enabled = true;
                self.voice2.enabled = false;
                self.voice3.enabled = false;
            }
            HarmonyType::PowerChord => {
                self.voice1.interval = 7;
                self.voice1.level = 0.7;
                self.voice1.enabled = true;
                self.voice2.interval = 12;
                self.voice2.level = 0.5;
                self.voice2.enabled = true;
                self.voice3.enabled = false;
            }
            HarmonyType::MajorChord => {
                self.voice1.interval = 4;
                self.voice1.level = 0.6;
                self.voice1.enabled = true;
                self.voice2.interval = 7;
                self.voice2.level = 0.6;
                self.voice2.enabled = true;
                self.voice3.enabled = false;
            }
            HarmonyType::MinorChord => {
                self.voice1.interval = 3;
                self.voice1.level = 0.6;
                self.voice1.enabled = true;
                self.voice2.interval = 7;
                self.voice2.level = 0.6;
                self.voice2.enabled = true;
                self.voice3.enabled = false;
            }
            HarmonyType::Custom => {
                // Custom intervals are set via voice settings
            }
        }
    }

    /// Set room context (key/scale from synced analysis)
    pub fn set_room_context(&mut self, key: &str, scale: &str) {
        self.key_offset = key_to_offset(key);
        self.scale = Scale::from_str(scale);
    }
}

impl AudioEffect for Harmonizer {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let mix = self.settings.mix / 100.0;

        for frame in samples.chunks_mut(2) {
            let left = frame[0];
            let right = if frame.len() > 1 { frame[1] } else { left };

            // Detect pitch for potential scale-aware harmonies
            let mono = (left + right) * 0.5;
            self.detector.push_sample(mono);

            // Process harmony voices
            let (v1_l, v1_r) = self.voice1.process(left, right);
            let (v2_l, v2_r) = self.voice2.process(left, right);
            let (v3_l, v3_r) = self.voice3.process(left, right);

            // Sum harmonies
            let harmony_l = v1_l + v2_l + v3_l;
            let harmony_r = v1_r + v2_r + v3_r;

            // Mix with dry signal
            frame[0] = left + harmony_l * mix;
            if frame.len() > 1 {
                frame[1] = right + harmony_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        self.voice1.reset();
        self.voice2.reset();
        self.voice3.reset();
        self.detector.reset();
        self.detected_pitch = 0.0;
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
