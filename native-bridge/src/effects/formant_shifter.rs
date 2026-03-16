//! Formant Shifter - changes vocal character without changing pitch
//!
//! Uses a vocoder-style approach with analysis/synthesis filterbanks.

use super::dsp::{crossfade, Biquad, BiquadType};
use super::types::FormantShifterSettings;
use super::AudioEffect;

const NUM_BANDS: usize = 16;

pub struct FormantShifter {
    settings: FormantShifterSettings,
    sample_rate: u32,
    enabled: bool,

    // Analysis filterbank
    analysis_filters_l: Vec<Biquad>,
    analysis_filters_r: Vec<Biquad>,

    // Synthesis filterbank (shifted)
    synthesis_filters_l: Vec<Biquad>,
    synthesis_filters_r: Vec<Biquad>,

    // Envelope followers for each band
    envelopes: Vec<f32>,
    envelope_attack: f32,
    envelope_release: f32,

    // Band center frequencies
    center_freqs: Vec<f32>,
}

impl FormantShifter {
    pub fn new(sample_rate: u32) -> Self {
        let mut formant = Self {
            settings: FormantShifterSettings::default(),
            sample_rate,
            enabled: false,
            analysis_filters_l: Vec::with_capacity(NUM_BANDS),
            analysis_filters_r: Vec::with_capacity(NUM_BANDS),
            synthesis_filters_l: Vec::with_capacity(NUM_BANDS),
            synthesis_filters_r: Vec::with_capacity(NUM_BANDS),
            envelopes: vec![0.0; NUM_BANDS],
            envelope_attack: 0.0,
            envelope_release: 0.0,
            center_freqs: Vec::with_capacity(NUM_BANDS),
        };

        formant.init_filterbanks(sample_rate);
        formant
    }

    fn init_filterbanks(&mut self, sample_rate: u32) {
        self.analysis_filters_l.clear();
        self.analysis_filters_r.clear();
        self.synthesis_filters_l.clear();
        self.synthesis_filters_r.clear();
        self.center_freqs.clear();

        let sr = sample_rate as f32;

        // Logarithmically spaced bands from 100Hz to 8kHz
        let min_freq = 100.0f32;
        let max_freq = 8000.0f32;

        for i in 0..NUM_BANDS {
            let t = i as f32 / (NUM_BANDS - 1) as f32;
            let freq = min_freq * (max_freq / min_freq).powf(t);
            self.center_freqs.push(freq);

            // Analysis filters (bandpass)
            let q = 4.0; // Moderate Q for overlapping bands
            let mut analysis_l = Biquad::new();
            analysis_l.configure(BiquadType::Bandpass, freq, q, 0.0, sr);
            let mut analysis_r = Biquad::new();
            analysis_r.configure(BiquadType::Bandpass, freq, q, 0.0, sr);

            self.analysis_filters_l.push(analysis_l);
            self.analysis_filters_r.push(analysis_r);

            // Synthesis filters (will be retuned on shift change)
            let mut synth_l = Biquad::new();
            synth_l.configure(BiquadType::Bandpass, freq, q, 0.0, sr);
            let mut synth_r = Biquad::new();
            synth_r.configure(BiquadType::Bandpass, freq, q, 0.0, sr);

            self.synthesis_filters_l.push(synth_l);
            self.synthesis_filters_r.push(synth_r);
        }

        // Envelope follower coefficients
        self.envelope_attack = (-1.0 / (0.005 * sr)).exp(); // 5ms attack
        self.envelope_release = (-1.0 / (0.050 * sr)).exp(); // 50ms release
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        self.init_filterbanks(rate);
    }

    pub fn update_settings(&mut self, settings: FormantShifterSettings) {
        self.enabled = settings.enabled;

        // Update synthesis filters with shifted frequencies
        let shift_semitones = settings.shift;
        let shift_ratio = 2.0f32.powf(shift_semitones / 12.0);

        // Gender shift affects formants differently
        let gender_factor = 1.0 + (settings.gender / 100.0) * 0.3; // ±30% shift

        let sr = self.sample_rate as f32;
        let q = 4.0;

        for i in 0..NUM_BANDS {
            let analysis_freq = self.center_freqs[i];
            let shifted_freq = (analysis_freq * shift_ratio * gender_factor).clamp(20.0, 20000.0);

            self.synthesis_filters_l[i].configure(BiquadType::Bandpass, shifted_freq, q, 0.0, sr);
            self.synthesis_filters_r[i].configure(BiquadType::Bandpass, shifted_freq, q, 0.0, sr);
        }

        self.settings = settings;
    }
}

impl AudioEffect for FormantShifter {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let mix = self.settings.mix / 100.0;
        let attack = self.envelope_attack;
        let release = self.envelope_release;

        for frame in samples.chunks_mut(2) {
            let left = frame[0];
            let right = if frame.len() > 1 { frame[1] } else { left };

            let mut out_l = 0.0f32;
            let mut out_r = 0.0f32;

            for i in 0..NUM_BANDS {
                // Analysis: get envelope of each band
                let band_l = self.analysis_filters_l[i].process(left);
                let band_r = self.analysis_filters_r[i].process(right);

                // Envelope follower
                let amplitude = (band_l * band_l + band_r * band_r).sqrt();
                let coef = if amplitude > self.envelopes[i] {
                    attack
                } else {
                    release
                };
                self.envelopes[i] = self.envelopes[i] * coef + amplitude * (1.0 - coef);

                // Synthesis: apply envelope to shifted bands
                // Use noise or the original signal filtered through synthesis bank
                let synth_l = self.synthesis_filters_l[i].process(left);
                let synth_r = self.synthesis_filters_r[i].process(right);

                // Apply envelope
                let gain = self.envelopes[i] * 2.0; // Makeup gain
                out_l += synth_l * gain;
                out_r += synth_r * gain;
            }

            // Normalize output (vocoder tends to be quiet)
            out_l *= 1.5 / (NUM_BANDS as f32).sqrt();
            out_r *= 1.5 / (NUM_BANDS as f32).sqrt();

            // Mix
            frame[0] = crossfade(left, out_l, mix);
            if frame.len() > 1 {
                frame[1] = crossfade(right, out_r, mix);
            }
        }
    }

    fn reset(&mut self) {
        for filter in &mut self.analysis_filters_l {
            filter.reset();
        }
        for filter in &mut self.analysis_filters_r {
            filter.reset();
        }
        for filter in &mut self.synthesis_filters_l {
            filter.reset();
        }
        for filter in &mut self.synthesis_filters_r {
            filter.reset();
        }
        self.envelopes.fill(0.0);
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
