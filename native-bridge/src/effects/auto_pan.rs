//! Auto Pan - LFO-controlled stereo panning

use super::dsp::{bpm_subdivision_to_hz, Lfo, LfoWaveform};
use super::types::{AutoPanSettings, AutoPanWaveform};
use super::AudioEffect;
use std::f32::consts::PI;

pub struct AutoPan {
    settings: AutoPanSettings,
    sample_rate: f32,
    lfo: Lfo,
    // BPM for tempo sync
    bpm: f32,
}

impl AutoPan {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: AutoPanSettings::default(),
            sample_rate: sample_rate as f32,
            lfo: Lfo::new(LfoWaveform::Sine),
            bpm: 120.0,
        }
    }

    /// Set BPM for tempo-synced panning
    pub fn set_bpm(&mut self, bpm: f32) {
        self.bpm = bpm.max(20.0);
    }

    pub fn update_settings(&mut self, settings: AutoPanSettings) {
        let waveform = match settings.waveform {
            AutoPanWaveform::Sine => LfoWaveform::Sine,
            AutoPanWaveform::Triangle => LfoWaveform::Triangle,
            AutoPanWaveform::Square => LfoWaveform::Square,
            AutoPanWaveform::Sawtooth => LfoWaveform::Sawtooth,
        };
        self.lfo.set_waveform(waveform);

        // Set initial phase
        self.lfo.set_phase(settings.phase / 360.0);

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }
}

impl AudioEffect for AutoPan {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        // Calculate LFO rate - use tempo sync if enabled
        let rate = if self.settings.tempo_sync {
            bpm_subdivision_to_hz(self.bpm, &self.settings.subdivision)
        } else {
            self.settings.rate
        };
        let depth = self.settings.depth / 100.0;

        for frame in samples.chunks_mut(2) {
            // Get LFO value (-1 to 1)
            let lfo_val = self.lfo.tick(rate, self.sample_rate);

            // Convert to pan position (-1 = left, 0 = center, 1 = right)
            let pan = lfo_val * depth;

            // Calculate equal-power pan gains
            // pan = -1: left=1, right=0
            // pan = 0: left=0.707, right=0.707
            // pan = 1: left=0, right=1
            let angle = (pan + 1.0) * PI * 0.25; // 0 to PI/2
            let left_gain = angle.cos();
            let right_gain = angle.sin();

            if frame.len() > 1 {
                // True stereo: cross-fade between channels
                let mono = (frame[0] + frame[1]) * 0.5;
                frame[0] = mono * left_gain + frame[0] * (1.0 - depth);
                frame[1] = mono * right_gain + frame[1] * (1.0 - depth);
            } else {
                // Mono input: just apply amplitude
                frame[0] *= left_gain;
            }
        }
    }

    fn reset(&mut self) {
        self.lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
