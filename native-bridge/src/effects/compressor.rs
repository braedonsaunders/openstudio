//! Compressor - dynamics processor with envelope detection

use super::dsp::db_to_linear;
use super::types::CompressorSettings;
use super::AudioEffect;

pub struct Compressor {
    settings: CompressorSettings,
    // Envelope state
    envelope: f32,
    // Attack/release coefficients
    attack_coeff: f32,
    release_coeff: f32,
    sample_rate: f32,
    // Metering
    current_reduction: f32,
}

impl Compressor {
    pub fn new(sample_rate: u32) -> Self {
        let mut comp = Self {
            settings: CompressorSettings::default(),
            envelope: 0.0,
            attack_coeff: 0.0,
            release_coeff: 0.0,
            sample_rate: sample_rate as f32,
            current_reduction: 0.0,
        };
        comp.update_coefficients();
        comp
    }

    pub fn update_settings(&mut self, settings: CompressorSettings) {
        self.settings = settings;
        self.update_coefficients();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_coefficients();
    }

    fn update_coefficients(&mut self) {
        // Time constants: coeff = exp(-1 / (time_ms * sample_rate / 1000))
        self.attack_coeff = (-1.0 / (self.settings.attack * 0.001 * self.sample_rate)).exp();
        self.release_coeff = (-1.0 / (self.settings.release * 0.001 * self.sample_rate)).exp();
    }

    pub fn get_reduction(&self) -> f32 {
        self.current_reduction
    }

    /// Calculate gain reduction using soft-knee compression
    fn compute_gain(&self, input_db: f32) -> f32 {
        let threshold = self.settings.threshold;
        let ratio = self.settings.ratio;
        let knee = self.settings.knee;

        // How far above threshold
        let over_db = input_db - threshold;

        if over_db <= -knee / 2.0 {
            // Below knee - no compression
            0.0
        } else if over_db >= knee / 2.0 {
            // Above knee - full compression
            let slope = 1.0 - 1.0 / ratio;
            -slope * over_db
        } else {
            // In the knee region - interpolate
            let knee_factor = (over_db + knee / 2.0) / knee;
            let slope = 1.0 - 1.0 / ratio;
            -slope * knee_factor * knee_factor * over_db / 2.0
        }
    }
}

impl AudioEffect for Compressor {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let makeup_linear = db_to_linear(self.settings.makeup_gain);
        self.current_reduction = 0.0;

        for frame in samples.chunks_mut(2) {
            // Get peak level
            let input_level = if frame.len() > 1 {
                frame[0].abs().max(frame[1].abs())
            } else {
                frame[0].abs()
            };

            // Convert to dB
            let input_db = if input_level > 0.0 {
                20.0 * input_level.log10()
            } else {
                -100.0
            };

            // Calculate desired gain reduction
            let target_reduction_db = self.compute_gain(input_db);

            // Apply envelope (attack/release)
            let coeff = if target_reduction_db < self.envelope {
                self.attack_coeff // Compressing more
            } else {
                self.release_coeff // Releasing
            };

            self.envelope = coeff * self.envelope + (1.0 - coeff) * target_reduction_db;

            // Convert to linear gain
            let gain = db_to_linear(self.envelope) * makeup_linear;

            // Track max reduction for metering
            self.current_reduction = self.current_reduction.max(-self.envelope);

            // Apply gain
            frame[0] *= gain;
            if frame.len() > 1 {
                frame[1] *= gain;
            }
        }
    }

    fn reset(&mut self) {
        self.envelope = 0.0;
        self.current_reduction = 0.0;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
