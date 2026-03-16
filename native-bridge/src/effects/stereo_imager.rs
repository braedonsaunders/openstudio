//! Stereo Imager - width control and M/S processing

use super::dsp::{Biquad, BiquadType};
use super::types::StereoImagerSettings;
use super::AudioEffect;

pub struct StereoImager {
    settings: StereoImagerSettings,
    // Crossover filter for frequency-dependent width
    lp_filter_l: Biquad,
    lp_filter_r: Biquad,
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    // Mono bass filter
    mono_bass_lp_l: Biquad,
    mono_bass_lp_r: Biquad,
    sample_rate: f32,
}

impl StereoImager {
    pub fn new(sample_rate: u32) -> Self {
        let mut si = Self {
            settings: StereoImagerSettings::default(),
            lp_filter_l: Biquad::new(),
            lp_filter_r: Biquad::new(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            mono_bass_lp_l: Biquad::new(),
            mono_bass_lp_r: Biquad::new(),
            sample_rate: sample_rate as f32,
        };
        si.update_filters();
        si
    }

    pub fn update_settings(&mut self, settings: StereoImagerSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        let crossover = self.settings.crossover;

        // Crossover filters
        self.lp_filter_l
            .configure(BiquadType::Lowpass, crossover, 0.707, 0.0, self.sample_rate);
        self.lp_filter_r
            .configure(BiquadType::Lowpass, crossover, 0.707, 0.0, self.sample_rate);
        self.hp_filter_l.configure(
            BiquadType::Highpass,
            crossover,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.hp_filter_r.configure(
            BiquadType::Highpass,
            crossover,
            0.707,
            0.0,
            self.sample_rate,
        );

        // Mono bass filter
        self.mono_bass_lp_l.configure(
            BiquadType::Lowpass,
            self.settings.mono_bass_freq,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.mono_bass_lp_r.configure(
            BiquadType::Lowpass,
            self.settings.mono_bass_freq,
            0.707,
            0.0,
            self.sample_rate,
        );
    }

    /// Apply width to M/S signals
    #[inline]
    fn apply_width(mid: f32, side: f32, width: f32) -> (f32, f32) {
        // width 0 = mono (no side), width 100 = normal, width 200 = enhanced side
        let width_factor = width / 100.0;
        let new_side = side * width_factor;

        // Convert back to L/R
        let left = mid + new_side;
        let right = mid - new_side;

        (left, right)
    }
}

impl AudioEffect for StereoImager {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let width = self.settings.width;
        let low_width = self.settings.low_width;
        let high_width = self.settings.high_width;
        let center = self.settings.center / 100.0; // -1 to 1

        for frame in samples.chunks_mut(2) {
            if frame.len() < 2 {
                continue; // Need stereo
            }

            let left = frame[0];
            let right = frame[1];

            // Split into low and high bands
            let low_l = self.lp_filter_l.process(left);
            let low_r = self.lp_filter_r.process(right);
            let high_l = self.hp_filter_l.process(left);
            let high_r = self.hp_filter_r.process(right);

            // Apply width to each band
            let low_mid = (low_l + low_r) * 0.5;
            let low_side = (low_l - low_r) * 0.5;
            let (new_low_l, new_low_r) = Self::apply_width(low_mid, low_side, low_width);

            let high_mid = (high_l + high_r) * 0.5;
            let high_side = (high_l - high_r) * 0.5;
            let (new_high_l, new_high_r) = Self::apply_width(high_mid, high_side, high_width);

            // Combine bands
            let mut out_l = new_low_l + new_high_l;
            let mut out_r = new_low_r + new_high_r;

            // Apply overall width
            let overall_mid = (out_l + out_r) * 0.5;
            let overall_side = (out_l - out_r) * 0.5;
            let (out_l2, out_r2) = Self::apply_width(overall_mid, overall_side, width);
            out_l = out_l2;
            out_r = out_r2;

            // Apply center (pan) adjustment
            if center != 0.0 {
                let pan_l = (1.0 - center).max(0.0);
                let pan_r = (1.0 + center).max(0.0);
                out_l *= pan_l;
                out_r *= pan_r;
            }

            // Mono bass if enabled
            if self.settings.mono_bass {
                let bass_l = self.mono_bass_lp_l.process(out_l);
                let bass_r = self.mono_bass_lp_r.process(out_r);
                let mono_bass = (bass_l + bass_r) * 0.5;

                // Replace bass with mono version
                out_l = out_l - bass_l + mono_bass;
                out_r = out_r - bass_r + mono_bass;
            }

            frame[0] = out_l;
            frame[1] = out_r;
        }
    }

    fn reset(&mut self) {
        self.lp_filter_l.reset();
        self.lp_filter_r.reset();
        self.hp_filter_l.reset();
        self.hp_filter_r.reset();
        self.mono_bass_lp_l.reset();
        self.mono_bass_lp_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
