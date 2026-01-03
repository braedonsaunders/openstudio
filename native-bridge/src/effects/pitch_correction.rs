//! Pitch Correction (Auto-Tune style)
//!
//! Real-time pitch detection and correction to scale notes.

use super::dsp::{crossfade, OnePoleLowpass};
use super::pitch::{key_to_offset, snap_to_scale, PitchDetector, PitchShifter, Scale};
use super::types::PitchCorrectionSettings;
use super::AudioEffect;

pub struct PitchCorrection {
    settings: PitchCorrectionSettings,
    sample_rate: u32,
    enabled: bool,

    // Pitch detection (mono sum for detection)
    detector_l: PitchDetector,
    detector_r: PitchDetector,

    // Pitch shifting
    shifter_l: PitchShifter,
    shifter_r: PitchShifter,

    // Smoothing for correction amount
    correction_smoother: OnePoleLowpass,

    // Current detected pitch
    current_pitch: f32,
    target_pitch: f32,

    // Key/scale context
    key_offset: i32,
    scale: Scale,

    // Humanize state
    humanize_lfo_phase: f32,
}

impl PitchCorrection {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: PitchCorrectionSettings::default(),
            sample_rate,
            enabled: false,
            detector_l: PitchDetector::new(sample_rate),
            detector_r: PitchDetector::new(sample_rate),
            shifter_l: PitchShifter::new(sample_rate),
            shifter_r: PitchShifter::new(sample_rate),
            correction_smoother: OnePoleLowpass::new(20.0, sample_rate as f32),
            current_pitch: 0.0,
            target_pitch: 0.0,
            key_offset: 0,
            scale: Scale::Chromatic,
            humanize_lfo_phase: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        self.detector_l.set_sample_rate(rate);
        self.detector_r.set_sample_rate(rate);
        self.shifter_l.set_sample_rate(rate);
        self.shifter_r.set_sample_rate(rate);
        self.correction_smoother = OnePoleLowpass::new(20.0, rate as f32);
    }

    pub fn update_settings(&mut self, settings: PitchCorrectionSettings) {
        self.enabled = settings.enabled;

        // Update key and scale
        self.key_offset = key_to_offset(&settings.key);
        self.scale = match settings.scale {
            super::types::PitchCorrectionScale::Chromatic => Scale::Chromatic,
            super::types::PitchCorrectionScale::Major => Scale::Major,
            super::types::PitchCorrectionScale::Minor => Scale::Minor,
            super::types::PitchCorrectionScale::PentatonicMajor => Scale::PentatonicMajor,
            super::types::PitchCorrectionScale::PentatonicMinor => Scale::PentatonicMinor,
            super::types::PitchCorrectionScale::Blues => Scale::Blues,
            super::types::PitchCorrectionScale::Dorian => Scale::Dorian,
            super::types::PitchCorrectionScale::Mixolydian => Scale::Mixolydian,
            super::types::PitchCorrectionScale::HarmonicMinor => Scale::HarmonicMinor,
        };

        // Update correction speed (affects smoother frequency)
        let speed_hz = 1.0 + (settings.speed / 100.0) * 50.0; // 1-51 Hz
        self.correction_smoother = OnePoleLowpass::new(speed_hz, self.sample_rate as f32);

        self.settings = settings;
    }

    /// Set room context (key/scale from synced analysis)
    pub fn set_room_context(&mut self, key: &str, scale: &str) {
        self.key_offset = key_to_offset(key);
        self.scale = Scale::from_str(scale);
    }
}

impl AudioEffect for PitchCorrection {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let mix = self.settings.mix / 100.0;
        let humanize = self.settings.humanize / 100.0;
        let detune_cents = self.settings.detune;
        let speed = self.settings.speed / 100.0; // 0-1

        // LFO for humanize
        let humanize_rate = 0.5; // 0.5 Hz wobble
        let lfo_inc = humanize_rate / self.sample_rate as f32;

        for frame in samples.chunks_mut(2) {
            let left = frame[0];
            let right = if frame.len() > 1 { frame[1] } else { left };

            // Feed samples to pitch detector (use mono sum)
            let mono = (left + right) * 0.5;
            self.detector_l.push_sample(mono);

            // Detect pitch periodically (every ~10ms worth of samples)
            let (detected_pitch, confidence) = self.detector_l.detect();

            if confidence > 0.5 && detected_pitch > 50.0 && detected_pitch < 1000.0 {
                self.current_pitch = detected_pitch;

                // Find target note in scale
                self.target_pitch = snap_to_scale(detected_pitch, self.key_offset, &self.scale);
            }

            // Calculate pitch shift ratio
            let mut shift_ratio = if self.current_pitch > 0.0 && self.target_pitch > 0.0 {
                self.target_pitch / self.current_pitch
            } else {
                1.0
            };

            // Apply humanize (random micro-variations)
            if humanize > 0.0 {
                let humanize_cents = humanize * 15.0; // Up to 15 cents variation
                let lfo_val = (self.humanize_lfo_phase * std::f32::consts::TAU).sin();
                let variation = humanize_cents * lfo_val;
                shift_ratio *= 2.0f32.powf(variation / 1200.0);
                self.humanize_lfo_phase += lfo_inc;
                if self.humanize_lfo_phase >= 1.0 {
                    self.humanize_lfo_phase -= 1.0;
                }
            }

            // Apply fixed detune
            if detune_cents.abs() > 0.1 {
                shift_ratio *= 2.0f32.powf(detune_cents / 1200.0);
            }

            // Smooth the correction based on speed
            let smoothed_ratio = self.correction_smoother.process(shift_ratio);

            // Blend between instant and smooth based on speed setting
            let final_ratio = crossfade(smoothed_ratio, shift_ratio, speed);

            // Apply pitch shift
            self.shifter_l.set_ratio(final_ratio);
            self.shifter_r.set_ratio(final_ratio);

            let shifted_l = self.shifter_l.process(left);
            let shifted_r = self.shifter_r.process(right);

            // Mix dry/wet
            frame[0] = crossfade(left, shifted_l, mix);
            if frame.len() > 1 {
                frame[1] = crossfade(right, shifted_r, mix);
            }
        }
    }

    fn reset(&mut self) {
        self.detector_l.reset();
        self.detector_r.reset();
        self.shifter_l.reset();
        self.shifter_r.reset();
        self.current_pitch = 0.0;
        self.target_pitch = 0.0;
        self.humanize_lfo_phase = 0.0;
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
