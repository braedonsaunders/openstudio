//! Overdrive - soft clipping tube-style saturation

use super::dsp::{soft_clip, Biquad, BiquadType};
use super::types::OverdriveSettings;
use super::AudioEffect;

pub struct Overdrive {
    settings: OverdriveSettings,
    // Pre-filter (highpass to remove mud)
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    // Post-filter (tone control)
    tone_filter_l: Biquad,
    tone_filter_r: Biquad,
    sample_rate: f32,
}

impl Overdrive {
    pub fn new(sample_rate: u32) -> Self {
        let mut od = Self {
            settings: OverdriveSettings::default(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            tone_filter_l: Biquad::new(),
            tone_filter_r: Biquad::new(),
            sample_rate: sample_rate as f32,
        };
        od.update_filters();
        od
    }

    pub fn update_settings(&mut self, settings: OverdriveSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Highpass to remove low-end mud before clipping
        self.hp_filter_l
            .configure(BiquadType::Highpass, 80.0, 0.707, 0.0, self.sample_rate);
        self.hp_filter_r
            .configure(BiquadType::Highpass, 80.0, 0.707, 0.0, self.sample_rate);

        // Tone control - lowpass/highshelf hybrid
        // tone 0 = dark (1kHz), tone 1 = bright (8kHz)
        let tone_freq = 1000.0 + self.settings.tone * 7000.0;
        self.tone_filter_l
            .configure(BiquadType::Lowpass, tone_freq, 0.707, 0.0, self.sample_rate);
        self.tone_filter_r
            .configure(BiquadType::Lowpass, tone_freq, 0.707, 0.0, self.sample_rate);
    }
}

impl AudioEffect for Overdrive {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let drive = 1.0 + self.settings.drive * 15.0; // 1x to 16x gain
        let level = self.settings.level;

        for frame in samples.chunks_mut(2) {
            // Pre-filter
            let filtered_l = self.hp_filter_l.process(frame[0]);
            let filtered_r = if frame.len() > 1 {
                self.hp_filter_r.process(frame[1])
            } else {
                filtered_l
            };

            // Apply drive and soft clipping
            // Asymmetric clipping for tube-like character
            let driven_l = filtered_l * drive;
            let driven_r = filtered_r * drive;

            // Soft clip with asymmetry
            let clipped_l = self.asymmetric_clip(driven_l);
            let clipped_r = self.asymmetric_clip(driven_r);

            // Apply tone filter
            let toned_l = self.tone_filter_l.process(clipped_l);
            let toned_r = self.tone_filter_r.process(clipped_r);

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

impl Overdrive {
    /// Asymmetric soft clipping for tube-like character
    #[inline]
    fn asymmetric_clip(&self, x: f32) -> f32 {
        if x >= 0.0 {
            // Positive: softer clipping
            soft_clip(x * 0.9) / 0.9
        } else {
            // Negative: slightly harder clipping
            soft_clip(x * 1.1) / 1.1
        }
    }
}
