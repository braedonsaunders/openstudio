//! Bitcrusher - lo-fi bit reduction and sample rate decimation

use super::types::BitcrusherSettings;
use super::AudioEffect;

pub struct Bitcrusher {
    settings: BitcrusherSettings,
    sample_rate: f32,
    // Sample-and-hold state for decimation
    hold_left: f32,
    hold_right: f32,
    hold_counter: f32,
}

impl Bitcrusher {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: BitcrusherSettings::default(),
            sample_rate: sample_rate as f32,
            hold_left: 0.0,
            hold_right: 0.0,
            hold_counter: 0.0,
        }
    }

    pub fn update_settings(&mut self, settings: BitcrusherSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }

    /// Quantize a sample to a given bit depth
    #[inline]
    fn quantize(&self, sample: f32, bit_depth: f32) -> f32 {
        // Number of quantization levels
        let levels = 2.0_f32.powf(bit_depth);
        let half_levels = levels / 2.0;

        // Quantize to discrete levels
        let quantized = (sample * half_levels).round() / half_levels;

        // Add dither if enabled (simple triangular dither)
        if self.settings.dither {
            // Simple RPDF dither
            let dither_amount = 1.0 / half_levels;
            quantized + dither_amount * 0.5 // Fixed small dither
        } else {
            quantized
        }
    }
}

impl AudioEffect for Bitcrusher {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let bit_depth = self.settings.bit_depth.clamp(1.0, 16.0);
        let target_rate = self.settings.sample_rate.clamp(500.0, self.sample_rate);
        let decimation_factor = self.sample_rate / target_rate;
        let mix = self.settings.mix / 100.0;

        for frame in samples.chunks_mut(2) {
            // Sample rate decimation (sample-and-hold)
            self.hold_counter += 1.0;
            if self.hold_counter >= decimation_factor {
                self.hold_counter -= decimation_factor;
                self.hold_left = frame[0];
                if frame.len() > 1 {
                    self.hold_right = frame[1];
                }
            }

            // Bit crushing
            let crushed_left = self.quantize(self.hold_left, bit_depth);
            let crushed_right = if frame.len() > 1 {
                self.quantize(self.hold_right, bit_depth)
            } else {
                crushed_left
            };

            // Apply mix
            frame[0] = frame[0] * (1.0 - mix) + crushed_left * mix;
            if frame.len() > 1 {
                frame[1] = frame[1] * (1.0 - mix) + crushed_right * mix;
            }
        }
    }

    fn reset(&mut self) {
        self.hold_left = 0.0;
        self.hold_right = 0.0;
        self.hold_counter = 0.0;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
