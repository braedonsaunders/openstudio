//! Phaser effect - cascaded allpass filters with LFO modulation

use super::dsp::{Biquad, BiquadType, Lfo, LfoWaveform};
use super::types::PhaserSettings;
use super::AudioEffect;

const MAX_STAGES: usize = 12;

pub struct Phaser {
    settings: PhaserSettings,
    // Allpass filters for each stage
    allpass_left: Vec<Biquad>,
    allpass_right: Vec<Biquad>,
    lfo: Lfo,
    sample_rate: f32,
}

impl Phaser {
    pub fn new(sample_rate: u32) -> Self {
        let mut allpass_left = Vec::with_capacity(MAX_STAGES);
        let mut allpass_right = Vec::with_capacity(MAX_STAGES);

        for _ in 0..MAX_STAGES {
            allpass_left.push(Biquad::new());
            allpass_right.push(Biquad::new());
        }

        Self {
            settings: PhaserSettings::default(),
            allpass_left,
            allpass_right,
            lfo: Lfo::new(LfoWaveform::Sine),
            sample_rate: sample_rate as f32,
        }
    }

    pub fn update_settings(&mut self, settings: PhaserSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }
}

impl AudioEffect for Phaser {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let rate = self.settings.rate;
        let depth = self.settings.depth;
        let base_freq = self.settings.base_frequency;
        let octaves = self.settings.octaves;
        let stages = (self.settings.stages as usize).min(MAX_STAGES);
        let feedback = self.settings.feedback.clamp(-0.95, 0.95);
        let q = self.settings.q.max(0.1);
        let mix = self.settings.mix;

        // Static feedback state
        static mut FEEDBACK_L: f32 = 0.0;
        static mut FEEDBACK_R: f32 = 0.0;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // LFO modulates the allpass center frequency
            let lfo_val = self.lfo.tick(rate, self.sample_rate);
            let lfo_unipolar = (lfo_val + 1.0) * 0.5 * depth; // 0 to depth

            // Calculate sweep frequency (logarithmic)
            let freq_mult = 2.0_f32.powf(lfo_unipolar * octaves);
            let center_freq = (base_freq * freq_mult).clamp(20.0, self.sample_rate * 0.4);

            // Configure allpass filters for current frequency
            for i in 0..stages {
                // Spread stages across a frequency range
                let stage_offset = (i as f32 / stages as f32 - 0.5) * 0.5;
                let stage_freq = center_freq * 2.0_f32.powf(stage_offset);

                self.allpass_left[i].configure(
                    BiquadType::Allpass,
                    stage_freq,
                    q,
                    0.0,
                    self.sample_rate,
                );
                self.allpass_right[i].configure(
                    BiquadType::Allpass,
                    stage_freq,
                    q,
                    0.0,
                    self.sample_rate,
                );
            }

            // Process through allpass cascade with feedback
            unsafe {
                let mut wet_l = dry_l + FEEDBACK_L * feedback;
                let mut wet_r = dry_r + FEEDBACK_R * feedback;

                for i in 0..stages {
                    wet_l = self.allpass_left[i].process(wet_l);
                    wet_r = self.allpass_right[i].process(wet_r);
                }

                FEEDBACK_L = wet_l;
                FEEDBACK_R = wet_r;

                // Mix dry and wet
                frame[0] = dry_l * (1.0 - mix) + wet_l * mix;
                if frame.len() > 1 {
                    frame[1] = dry_r * (1.0 - mix) + wet_r * mix;
                }
            }
        }
    }

    fn reset(&mut self) {
        for i in 0..MAX_STAGES {
            self.allpass_left[i].reset();
            self.allpass_right[i].reset();
        }
        self.lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
