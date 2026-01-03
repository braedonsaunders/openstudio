//! Exciter - harmonic enhancement for brightness and presence

use super::dsp::{soft_clip, Biquad, BiquadType};
use super::types::ExciterSettings;
use super::AudioEffect;

pub struct Exciter {
    settings: ExciterSettings,
    // Highpass filter to isolate high frequencies
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    // Post-processing filter for color
    color_filter_l: Biquad,
    color_filter_r: Biquad,
    sample_rate: f32,
}

impl Exciter {
    pub fn new(sample_rate: u32) -> Self {
        let mut exc = Self {
            settings: ExciterSettings::default(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            color_filter_l: Biquad::new(),
            color_filter_r: Biquad::new(),
            sample_rate: sample_rate as f32,
        };
        exc.update_filters();
        exc
    }

    pub fn update_settings(&mut self, settings: ExciterSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Highpass to isolate frequencies to excite
        self.hp_filter_l.configure(
            BiquadType::Highpass,
            self.settings.frequency,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.hp_filter_r.configure(
            BiquadType::Highpass,
            self.settings.frequency,
            0.707,
            0.0,
            self.sample_rate,
        );

        // Color filter - slight boost in presence region
        let color_freq = self.settings.frequency + self.settings.color * 50.0;
        self.color_filter_l.configure(
            BiquadType::HighShelf,
            color_freq,
            0.707,
            self.settings.color * 0.06, // 0-6 dB boost
            self.sample_rate,
        );
        self.color_filter_r.configure(
            BiquadType::HighShelf,
            color_freq,
            0.707,
            self.settings.color * 0.06,
            self.sample_rate,
        );
    }
}

impl AudioEffect for Exciter {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let amount = self.settings.amount / 100.0;
        let dynamics = self.settings.dynamics / 100.0;
        let mix = self.settings.mix / 100.0;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Extract high frequencies
            let high_l = self.hp_filter_l.process(dry_l);
            let high_r = self.hp_filter_r.process(dry_r);

            // Generate harmonics through soft saturation
            // Drive level based on amount
            let drive = 1.0 + amount * 5.0;
            let saturated_l = soft_clip(high_l * drive) / drive;
            let saturated_r = soft_clip(high_r * drive) / drive;

            // Apply color filtering
            let colored_l = self.color_filter_l.process(saturated_l);
            let colored_r = self.color_filter_r.process(saturated_r);

            // Dynamics - mix based on input level
            let level_l = dry_l.abs();
            let level_r = dry_r.abs();
            let dyn_mix_l = if dynamics > 0.0 {
                (level_l * 10.0 * dynamics).clamp(0.0, 1.0)
            } else {
                1.0
            };
            let dyn_mix_r = if dynamics > 0.0 {
                (level_r * 10.0 * dynamics).clamp(0.0, 1.0)
            } else {
                1.0
            };

            // Final mix
            let excited_l = colored_l * amount * dyn_mix_l;
            let excited_r = colored_r * amount * dyn_mix_r;

            frame[0] = dry_l * (1.0 - mix * 0.5) + excited_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix * 0.5) + excited_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        self.hp_filter_l.reset();
        self.hp_filter_r.reset();
        self.color_filter_l.reset();
        self.color_filter_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
