//! Ring Modulator - carrier frequency multiplication

use super::dsp::{Lfo, LfoWaveform};
use super::types::{RingModWaveform, RingModulatorSettings};
use super::AudioEffect;
use std::f32::consts::TAU;

pub struct RingModulator {
    settings: RingModulatorSettings,
    sample_rate: f32,
    carrier_phase: f32,
    lfo: Lfo,
}

impl RingModulator {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: RingModulatorSettings::default(),
            sample_rate: sample_rate as f32,
            carrier_phase: 0.0,
            lfo: Lfo::new(LfoWaveform::Sine),
        }
    }

    pub fn update_settings(&mut self, settings: RingModulatorSettings) {
        let waveform = match settings.waveform {
            RingModWaveform::Sine => LfoWaveform::Sine,
            RingModWaveform::Triangle => LfoWaveform::Triangle,
            RingModWaveform::Square => LfoWaveform::Square,
            RingModWaveform::Sawtooth => LfoWaveform::Sawtooth,
        };
        self.lfo.set_waveform(waveform);
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }

    /// Generate carrier waveform sample
    #[inline]
    fn carrier(&self, phase: f32) -> f32 {
        match self.settings.waveform {
            RingModWaveform::Sine => (phase * TAU).sin(),
            RingModWaveform::Triangle => {
                let p = phase % 1.0;
                if p < 0.25 {
                    p * 4.0
                } else if p < 0.75 {
                    2.0 - p * 4.0
                } else {
                    p * 4.0 - 4.0
                }
            }
            RingModWaveform::Square => {
                if phase % 1.0 < 0.5 {
                    1.0
                } else {
                    -1.0
                }
            }
            RingModWaveform::Sawtooth => 2.0 * (phase % 1.0) - 1.0,
        }
    }
}

impl AudioEffect for RingModulator {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let base_freq = self.settings.frequency;
        let lfo_rate = self.settings.lfo_rate;
        let lfo_depth = self.settings.lfo_depth / 100.0;
        let mix = self.settings.mix / 100.0;

        for frame in samples.chunks_mut(2) {
            // Get LFO modulation for carrier frequency
            let lfo_val = if lfo_rate > 0.0 {
                self.lfo.tick(lfo_rate, self.sample_rate)
            } else {
                0.0
            };

            // Modulated carrier frequency
            let freq = base_freq * (1.0 + lfo_val * lfo_depth);

            // Generate carrier
            let carrier = self.carrier(self.carrier_phase);

            // Advance carrier phase
            self.carrier_phase = (self.carrier_phase + freq / self.sample_rate) % 1.0;

            // Ring modulation: multiply signal by carrier
            let dry_left = frame[0];
            let mod_left = dry_left * carrier;

            frame[0] = dry_left * (1.0 - mix) + mod_left * mix;

            if frame.len() > 1 {
                let dry_right = frame[1];
                let mod_right = dry_right * carrier;
                frame[1] = dry_right * (1.0 - mix) + mod_right * mix;
            }
        }
    }

    fn reset(&mut self) {
        self.carrier_phase = 0.0;
        self.lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
