//! Multiband Compressor - 3-band dynamics processor

use super::dsp::{db_to_linear, Biquad, BiquadType};
use super::types::MultibandCompressorSettings;
use super::AudioEffect;

/// Per-band compressor state
struct BandCompressor {
    envelope: f32,
    attack_coeff: f32,
    release_coeff: f32,
}

impl BandCompressor {
    fn new() -> Self {
        Self {
            envelope: 0.0,
            attack_coeff: 0.99,
            release_coeff: 0.999,
        }
    }

    fn set_times(&mut self, attack_ms: f32, release_ms: f32, sample_rate: f32) {
        self.attack_coeff = (-1.0 / (attack_ms * 0.001 * sample_rate)).exp();
        self.release_coeff = (-1.0 / (release_ms * 0.001 * sample_rate)).exp();
    }

    fn process(&mut self, input: f32, threshold: f32, ratio: f32, makeup: f32) -> f32 {
        let input_level = input.abs();

        // Convert to dB
        let input_db = if input_level > 0.0 {
            20.0 * input_level.log10()
        } else {
            -100.0
        };

        // Calculate gain reduction
        let over_db = input_db - threshold;
        let reduction_db = if over_db > 0.0 {
            over_db * (1.0 - 1.0 / ratio)
        } else {
            0.0
        };

        // Apply envelope
        let coeff = if reduction_db > self.envelope {
            self.attack_coeff
        } else {
            self.release_coeff
        };
        self.envelope = coeff * self.envelope + (1.0 - coeff) * reduction_db;

        // Apply gain
        let gain = db_to_linear(-self.envelope) * db_to_linear(makeup);
        input * gain
    }

    fn reset(&mut self) {
        self.envelope = 0.0;
    }
}

pub struct MultibandCompressor {
    settings: MultibandCompressorSettings,
    // Crossover filters (Linkwitz-Riley style)
    low_lp_l: Biquad,
    low_lp_r: Biquad,
    low_lp2_l: Biquad,
    low_lp2_r: Biquad,
    low_hp_l: Biquad,
    low_hp_r: Biquad,
    low_hp2_l: Biquad,
    low_hp2_r: Biquad,
    high_lp_l: Biquad,
    high_lp_r: Biquad,
    high_lp2_l: Biquad,
    high_lp2_r: Biquad,
    high_hp_l: Biquad,
    high_hp_r: Biquad,
    high_hp2_l: Biquad,
    high_hp2_r: Biquad,
    // Per-band compressors
    low_comp_l: BandCompressor,
    low_comp_r: BandCompressor,
    mid_comp_l: BandCompressor,
    mid_comp_r: BandCompressor,
    high_comp_l: BandCompressor,
    high_comp_r: BandCompressor,
    sample_rate: f32,
}

impl MultibandCompressor {
    pub fn new(sample_rate: u32) -> Self {
        let mut mbc = Self {
            settings: MultibandCompressorSettings::default(),
            low_lp_l: Biquad::new(),
            low_lp_r: Biquad::new(),
            low_lp2_l: Biquad::new(),
            low_lp2_r: Biquad::new(),
            low_hp_l: Biquad::new(),
            low_hp_r: Biquad::new(),
            low_hp2_l: Biquad::new(),
            low_hp2_r: Biquad::new(),
            high_lp_l: Biquad::new(),
            high_lp_r: Biquad::new(),
            high_lp2_l: Biquad::new(),
            high_lp2_r: Biquad::new(),
            high_hp_l: Biquad::new(),
            high_hp_r: Biquad::new(),
            high_hp2_l: Biquad::new(),
            high_hp2_r: Biquad::new(),
            low_comp_l: BandCompressor::new(),
            low_comp_r: BandCompressor::new(),
            mid_comp_l: BandCompressor::new(),
            mid_comp_r: BandCompressor::new(),
            high_comp_l: BandCompressor::new(),
            high_comp_r: BandCompressor::new(),
            sample_rate: sample_rate as f32,
        };
        mbc.update_filters();
        mbc
    }

    pub fn update_settings(&mut self, settings: MultibandCompressorSettings) {
        self.settings = settings;
        self.update_filters();
        self.update_compressors();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
        self.update_compressors();
    }

    fn update_filters(&mut self) {
        let low_freq = self.settings.low_crossover;
        let high_freq = self.settings.high_crossover;

        // Low crossover (cascaded for steeper slope)
        for filter in [
            &mut self.low_lp_l,
            &mut self.low_lp_r,
            &mut self.low_lp2_l,
            &mut self.low_lp2_r,
        ] {
            filter.configure(BiquadType::Lowpass, low_freq, 0.707, 0.0, self.sample_rate);
        }
        for filter in [
            &mut self.low_hp_l,
            &mut self.low_hp_r,
            &mut self.low_hp2_l,
            &mut self.low_hp2_r,
        ] {
            filter.configure(BiquadType::Highpass, low_freq, 0.707, 0.0, self.sample_rate);
        }

        // High crossover
        for filter in [
            &mut self.high_lp_l,
            &mut self.high_lp_r,
            &mut self.high_lp2_l,
            &mut self.high_lp2_r,
        ] {
            filter.configure(BiquadType::Lowpass, high_freq, 0.707, 0.0, self.sample_rate);
        }
        for filter in [
            &mut self.high_hp_l,
            &mut self.high_hp_r,
            &mut self.high_hp2_l,
            &mut self.high_hp2_r,
        ] {
            filter.configure(
                BiquadType::Highpass,
                high_freq,
                0.707,
                0.0,
                self.sample_rate,
            );
        }
    }

    fn update_compressors(&mut self) {
        let low = &self.settings.low_band;
        let mid = &self.settings.mid_band;
        let high = &self.settings.high_band;

        self.low_comp_l
            .set_times(low.attack, low.release, self.sample_rate);
        self.low_comp_r
            .set_times(low.attack, low.release, self.sample_rate);
        self.mid_comp_l
            .set_times(mid.attack, mid.release, self.sample_rate);
        self.mid_comp_r
            .set_times(mid.attack, mid.release, self.sample_rate);
        self.high_comp_l
            .set_times(high.attack, high.release, self.sample_rate);
        self.high_comp_r
            .set_times(high.attack, high.release, self.sample_rate);
    }
}

impl AudioEffect for MultibandCompressor {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let low = &self.settings.low_band;
        let mid = &self.settings.mid_band;
        let high = &self.settings.high_band;
        let output_gain = db_to_linear(self.settings.output_gain);

        for frame in samples.chunks_mut(2) {
            let in_l = frame[0];
            let in_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Split into bands (cascaded filters for LR4 slope)
            let low_l = self.low_lp2_l.process(self.low_lp_l.process(in_l));
            let low_r = self.low_lp2_r.process(self.low_lp_r.process(in_r));

            let mid_temp_l = self.low_hp2_l.process(self.low_hp_l.process(in_l));
            let mid_temp_r = self.low_hp2_r.process(self.low_hp_r.process(in_r));
            let mid_l = self.high_lp2_l.process(self.high_lp_l.process(mid_temp_l));
            let mid_r = self.high_lp2_r.process(self.high_lp_r.process(mid_temp_r));

            let high_l = self.high_hp2_l.process(self.high_hp_l.process(in_l));
            let high_r = self.high_hp2_r.process(self.high_hp_r.process(in_r));

            // Compress each band
            let mut out_low_l = low_l;
            let mut out_low_r = low_r;
            let mut out_mid_l = mid_l;
            let mut out_mid_r = mid_r;
            let mut out_high_l = high_l;
            let mut out_high_r = high_r;

            if low.enabled && !low.mute {
                out_low_l = self
                    .low_comp_l
                    .process(low_l, low.threshold, low.ratio, low.makeup);
                out_low_r = self
                    .low_comp_r
                    .process(low_r, low.threshold, low.ratio, low.makeup);
            }
            if mid.enabled && !mid.mute {
                out_mid_l = self
                    .mid_comp_l
                    .process(mid_l, mid.threshold, mid.ratio, mid.makeup);
                out_mid_r = self
                    .mid_comp_r
                    .process(mid_r, mid.threshold, mid.ratio, mid.makeup);
            }
            if high.enabled && !high.mute {
                out_high_l =
                    self.high_comp_l
                        .process(high_l, high.threshold, high.ratio, high.makeup);
                out_high_r =
                    self.high_comp_r
                        .process(high_r, high.threshold, high.ratio, high.makeup);
            }

            // Handle solo
            let solo_active = low.solo || mid.solo || high.solo;
            if solo_active {
                out_low_l = if low.solo { out_low_l } else { 0.0 };
                out_low_r = if low.solo { out_low_r } else { 0.0 };
                out_mid_l = if mid.solo { out_mid_l } else { 0.0 };
                out_mid_r = if mid.solo { out_mid_r } else { 0.0 };
                out_high_l = if high.solo { out_high_l } else { 0.0 };
                out_high_r = if high.solo { out_high_r } else { 0.0 };
            }

            // Sum bands
            frame[0] = (out_low_l + out_mid_l + out_high_l) * output_gain;
            if frame.len() > 1 {
                frame[1] = (out_low_r + out_mid_r + out_high_r) * output_gain;
            }
        }
    }

    fn reset(&mut self) {
        self.low_lp_l.reset();
        self.low_lp_r.reset();
        self.low_lp2_l.reset();
        self.low_lp2_r.reset();
        self.low_hp_l.reset();
        self.low_hp_r.reset();
        self.low_hp2_l.reset();
        self.low_hp2_r.reset();
        self.high_lp_l.reset();
        self.high_lp_r.reset();
        self.high_lp2_l.reset();
        self.high_lp2_r.reset();
        self.high_hp_l.reset();
        self.high_hp_r.reset();
        self.high_hp2_l.reset();
        self.high_hp2_r.reset();
        self.low_comp_l.reset();
        self.low_comp_r.reset();
        self.mid_comp_l.reset();
        self.mid_comp_r.reset();
        self.high_comp_l.reset();
        self.high_comp_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
