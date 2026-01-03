//! Limiter - brickwall limiter for output protection

use super::dsp::db_to_linear;
use super::types::LimiterSettings;
use super::AudioEffect;

pub struct Limiter {
    settings: LimiterSettings,
    gain: f32,
    sample_rate: f32,
    reduction_db: f32, // For metering
}

impl Limiter {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: LimiterSettings::default(),
            gain: 1.0,
            sample_rate: sample_rate as f32,
            reduction_db: 0.0,
        }
    }

    pub fn update_settings(&mut self, settings: LimiterSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }

    /// Get current gain reduction in dB (for metering)
    pub fn get_reduction(&self) -> f32 {
        self.reduction_db
    }
}

impl AudioEffect for Limiter {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        // Limiter is always active for safety, even if "disabled"
        let threshold_linear = db_to_linear(self.settings.threshold);
        let ceiling_linear = db_to_linear(self.settings.ceiling);
        let release_samples = self.settings.release * 0.001 * self.sample_rate;
        let release_coeff = if release_samples > 0.0 {
            (-1.0 / release_samples).exp()
        } else {
            0.0
        };

        self.reduction_db = 0.0;

        for frame in samples.chunks_mut(2) {
            // Get peak level
            let peak = if frame.len() > 1 {
                frame[0].abs().max(frame[1].abs())
            } else {
                frame[0].abs()
            };

            // Calculate required gain
            let target_gain = if peak > threshold_linear {
                threshold_linear / peak
            } else {
                1.0
            };

            // Apply release envelope (attack is instant)
            if target_gain < self.gain {
                self.gain = target_gain; // Instant attack
            } else {
                // Release
                self.gain = release_coeff * self.gain + (1.0 - release_coeff) * target_gain;
            }

            // Track max reduction
            if self.gain < 1.0 {
                let reduction = -20.0 * self.gain.log10();
                self.reduction_db = self.reduction_db.max(reduction);
            }

            // Apply gain and ceiling
            for sample in frame.iter_mut() {
                *sample *= self.gain;
                // Hard clip at ceiling as final safety
                *sample = sample.clamp(-ceiling_linear, ceiling_linear);
            }
        }
    }

    fn reset(&mut self) {
        self.gain = 1.0;
        self.reduction_db = 0.0;
    }

    fn is_enabled(&self) -> bool {
        true // Limiter is always enabled for safety
    }

    fn set_enabled(&mut self, _enabled: bool) {
        // Limiter cannot be disabled
    }
}
