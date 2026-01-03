//! Tremolo effect - amplitude modulation via LFO

use super::dsp::{Lfo, LfoWaveform};
use super::types::{TremoloSettings, TremoloWaveform};
use super::AudioEffect;

pub struct Tremolo {
    settings: TremoloSettings,
    lfo_left: Lfo,
    lfo_right: Lfo,
    sample_rate: f32,
}

impl Tremolo {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: TremoloSettings::default(),
            lfo_left: Lfo::new(LfoWaveform::Sine),
            lfo_right: Lfo::new(LfoWaveform::Sine),
            sample_rate: sample_rate as f32,
        }
    }

    pub fn update_settings(&mut self, settings: TremoloSettings) {
        let waveform = match settings.waveform {
            TremoloWaveform::Sine => LfoWaveform::Sine,
            TremoloWaveform::Triangle => LfoWaveform::Triangle,
            TremoloWaveform::Square => LfoWaveform::Square,
            TremoloWaveform::Sawtooth => LfoWaveform::Sawtooth,
        };
        self.lfo_left.set_waveform(waveform);
        self.lfo_right.set_waveform(waveform);

        // Set stereo phase offset based on spread
        let phase_offset = settings.spread * 0.25; // 0-90 degrees
        self.lfo_right.set_phase(phase_offset);

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }
}

impl AudioEffect for Tremolo {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let rate = self.settings.rate;
        let depth = self.settings.depth;

        for frame in samples.chunks_mut(2) {
            // Get LFO values (bipolar -1 to 1)
            let mod_left = self.lfo_left.tick(rate, self.sample_rate);
            let mod_right = self.lfo_right.tick(rate, self.sample_rate);

            // Convert to gain (unipolar with depth control)
            // depth=0: no modulation (gain=1)
            // depth=1: full modulation (gain=0 to 1)
            let gain_left = 1.0 - depth * 0.5 * (1.0 - mod_left);
            let gain_right = 1.0 - depth * 0.5 * (1.0 - mod_right);

            frame[0] *= gain_left;
            if frame.len() > 1 {
                frame[1] *= gain_right;
            }
        }
    }

    fn reset(&mut self) {
        self.lfo_left.reset();
        self.lfo_right.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
