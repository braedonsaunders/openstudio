//! Frequency Shifter (Bode-style)
//!
//! Shifts all frequencies by a fixed Hz amount (not ratio).
//! Creates inharmonic, metallic, or otherworldly tones.

use super::dsp::{crossfade, Lfo, LfoWaveform};
use super::types::FrequencyShifterSettings;
use super::AudioEffect;
use std::f32::consts::PI;

/// Hilbert transform using allpass filters
struct HilbertTransform {
    // Allpass chain for 0° path
    ap_0: [f32; 4],
    // Allpass chain for 90° path
    ap_90: [f32; 4],
    // Allpass coefficients (optimized for audio range)
    coef_0: [f32; 4],
    coef_90: [f32; 4],
}

impl HilbertTransform {
    fn new() -> Self {
        // Coefficients for ~15Hz - 15kHz range
        Self {
            ap_0: [0.0; 4],
            ap_90: [0.0; 4],
            coef_0: [0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737],
            coef_90: [0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278],
        }
    }

    fn process(&mut self, input: f32) -> (f32, f32) {
        // Process through allpass chains
        let mut out_0 = input;
        let mut out_90 = input;

        for i in 0..4 {
            let a0 = self.coef_0[i];
            let tmp0 = a0 * (out_0 - self.ap_0[i]) + out_0;
            let new_ap0 = out_0;
            out_0 = tmp0;
            self.ap_0[i] = new_ap0 * a0 + self.ap_0[i] * (1.0 - a0 * a0);

            let a90 = self.coef_90[i];
            let tmp90 = a90 * (out_90 - self.ap_90[i]) + out_90;
            let new_ap90 = out_90;
            out_90 = tmp90;
            self.ap_90[i] = new_ap90 * a90 + self.ap_90[i] * (1.0 - a90 * a90);
        }

        (out_0, out_90)
    }

    fn reset(&mut self) {
        self.ap_0 = [0.0; 4];
        self.ap_90 = [0.0; 4];
    }
}

pub struct FrequencyShifter {
    settings: FrequencyShifterSettings,
    sample_rate: u32,
    enabled: bool,

    // Hilbert transforms for each channel
    hilbert_l: HilbertTransform,
    hilbert_r: HilbertTransform,

    // Oscillator for frequency shifting
    osc_phase: f32,
    shift_hz: f32,

    // LFO for modulation
    lfo: Lfo,
    lfo_rate: f32,

    // Feedback delay
    feedback_buffer_l: Vec<f32>,
    feedback_buffer_r: Vec<f32>,
    feedback_pos: usize,
}

impl FrequencyShifter {
    pub fn new(sample_rate: u32) -> Self {
        let feedback_size = (sample_rate as usize * 100) / 1000; // 100ms feedback

        Self {
            settings: FrequencyShifterSettings::default(),
            sample_rate,
            enabled: false,
            hilbert_l: HilbertTransform::new(),
            hilbert_r: HilbertTransform::new(),
            osc_phase: 0.0,
            shift_hz: 0.0,
            lfo: Lfo::new(LfoWaveform::Sine),
            lfo_rate: 1.0,
            feedback_buffer_l: vec![0.0; feedback_size],
            feedback_buffer_r: vec![0.0; feedback_size],
            feedback_pos: 0,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        let feedback_size = (rate as usize * 100) / 1000;
        self.feedback_buffer_l.resize(feedback_size, 0.0);
        self.feedback_buffer_r.resize(feedback_size, 0.0);
    }

    pub fn update_settings(&mut self, settings: FrequencyShifterSettings) {
        self.enabled = settings.enabled;
        self.shift_hz = settings.shift;
        self.lfo_rate = settings.lfo_rate;
        self.settings = settings;
    }
}

impl AudioEffect for FrequencyShifter {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let sr = self.sample_rate as f32;
        let mix = self.settings.mix / 100.0;
        let lfo_depth = self.settings.lfo_depth / 100.0 * 100.0; // Up to ±100Hz modulation
        let feedback = self.settings.feedback / 100.0 * 0.9; // Max 90% feedback

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { dry_l };

            // Add feedback
            let fb_l = self.feedback_buffer_l[self.feedback_pos];
            let fb_r = self.feedback_buffer_r[self.feedback_pos];

            let in_l = dry_l + fb_l * feedback;
            let in_r = dry_r + fb_r * feedback;

            // Get LFO modulation
            let lfo_val = self.lfo.tick(self.lfo_rate, sr);
            let mod_shift = self.shift_hz + lfo_val * lfo_depth;

            // Hilbert transform to get analytic signal
            let (re_l, im_l) = self.hilbert_l.process(in_l);
            let (re_r, im_r) = self.hilbert_r.process(in_r);

            // Complex multiply with oscillator to shift frequency
            let cos_phase = self.osc_phase.cos();
            let sin_phase = self.osc_phase.sin();

            // Up-shift: multiply by e^(j*2*pi*f*t)
            let shifted_l = re_l * cos_phase - im_l * sin_phase;
            let shifted_r = re_r * cos_phase - im_r * sin_phase;

            // Advance oscillator
            self.osc_phase += 2.0 * PI * mod_shift / sr;
            if self.osc_phase >= 2.0 * PI {
                self.osc_phase -= 2.0 * PI;
            } else if self.osc_phase < 0.0 {
                self.osc_phase += 2.0 * PI;
            }

            // Store in feedback buffer
            self.feedback_buffer_l[self.feedback_pos] = shifted_l;
            self.feedback_buffer_r[self.feedback_pos] = shifted_r;
            self.feedback_pos = (self.feedback_pos + 1) % self.feedback_buffer_l.len();

            // Mix
            frame[0] = crossfade(dry_l, shifted_l, mix);
            if frame.len() > 1 {
                frame[1] = crossfade(dry_r, shifted_r, mix);
            }
        }
    }

    fn reset(&mut self) {
        self.hilbert_l.reset();
        self.hilbert_r.reset();
        self.osc_phase = 0.0;
        self.lfo.reset();
        self.feedback_buffer_l.fill(0.0);
        self.feedback_buffer_r.fill(0.0);
        self.feedback_pos = 0;
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
