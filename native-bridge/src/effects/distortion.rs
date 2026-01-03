//! Distortion - various hard clipping and waveshaping algorithms

use super::dsp::{Biquad, BiquadType, hard_clip, soft_clip};
use super::types::{DistortionSettings, DistortionType};
use super::AudioEffect;

pub struct Distortion {
    settings: DistortionSettings,
    // Pre-filter
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    // Tone control
    tone_filter_l: Biquad,
    tone_filter_r: Biquad,
    sample_rate: f32,
}

impl Distortion {
    pub fn new(sample_rate: u32) -> Self {
        let mut dist = Self {
            settings: DistortionSettings::default(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            tone_filter_l: Biquad::new(),
            tone_filter_r: Biquad::new(),
            sample_rate: sample_rate as f32,
        };
        dist.update_filters();
        dist
    }

    pub fn update_settings(&mut self, settings: DistortionSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Pre highpass
        self.hp_filter_l.configure(
            BiquadType::Highpass,
            60.0,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.hp_filter_r.configure(
            BiquadType::Highpass,
            60.0,
            0.707,
            0.0,
            self.sample_rate,
        );

        // Tone control
        let tone_freq = 800.0 + self.settings.tone * 6000.0;
        self.tone_filter_l.configure(
            BiquadType::Lowpass,
            tone_freq,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.tone_filter_r.configure(
            BiquadType::Lowpass,
            tone_freq,
            0.707,
            0.0,
            self.sample_rate,
        );
    }

    /// Apply distortion waveshaping based on type
    #[inline]
    fn waveshape(&self, x: f32, amount: f32) -> f32 {
        let drive = 1.0 + amount * 30.0;
        let driven = x * drive;

        match self.settings.distortion_type {
            DistortionType::Classic => {
                // Classic tube-like clipping
                soft_clip(driven) / drive.sqrt()
            }
            DistortionType::Hard => {
                // Hard clipping
                hard_clip(driven, 1.0) / drive.sqrt()
            }
            DistortionType::Fuzz => {
                // Fuzz - extreme clipping with octave harmonics
                let sign = driven.signum();
                let abs_val = driven.abs();
                let clipped = if abs_val > 0.3 {
                    0.3 + (abs_val - 0.3).tanh() * 0.7
                } else {
                    abs_val
                };
                sign * clipped
            }
            DistortionType::Asymmetric => {
                // Asymmetric - different clipping for positive/negative
                if driven >= 0.0 {
                    hard_clip(driven, 0.8)
                } else {
                    soft_clip(driven * 1.5) / 1.5
                }
            }
            DistortionType::Rectifier => {
                // Full-wave rectification with clipping
                let rectified = driven.abs();
                soft_clip(rectified)
            }
        }
    }
}

impl AudioEffect for Distortion {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let amount = self.settings.amount;
        let level = self.settings.level;

        for frame in samples.chunks_mut(2) {
            // Pre-filter
            let filtered_l = self.hp_filter_l.process(frame[0]);
            let filtered_r = if frame.len() > 1 {
                self.hp_filter_r.process(frame[1])
            } else {
                filtered_l
            };

            // Apply distortion
            let distorted_l = self.waveshape(filtered_l, amount);
            let distorted_r = self.waveshape(filtered_r, amount);

            // Tone filter
            let toned_l = self.tone_filter_l.process(distorted_l);
            let toned_r = self.tone_filter_r.process(distorted_r);

            // Output level
            frame[0] = toned_l * level;
            if frame.len() > 1 {
                frame[1] = toned_r * level;
            }
        }
    }

    fn reset(&mut self) {
        self.hp_filter_l.reset();
        self.hp_filter_r.reset();
        self.tone_filter_l.reset();
        self.tone_filter_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
