//! Vocal Doubler - create artificial double-tracking effect

use super::dsp::{DelayLine, Lfo, LfoWaveform};
use super::types::VocalDoublerSettings;
use super::AudioEffect;
use std::f32::consts::PI;

const MAX_VOICES: usize = 4;

pub struct VocalDoubler {
    settings: VocalDoublerSettings,
    // Delay lines for each voice
    delays_left: Vec<DelayLine>,
    delays_right: Vec<DelayLine>,
    // LFOs for subtle modulation
    lfos: Vec<Lfo>,
    sample_rate: f32,
}

impl VocalDoubler {
    const MAX_DELAY_MS: f32 = 80.0;

    pub fn new(sample_rate: u32) -> Self {
        let mut delays_left = Vec::with_capacity(MAX_VOICES);
        let mut delays_right = Vec::with_capacity(MAX_VOICES);
        let mut lfos = Vec::with_capacity(MAX_VOICES);

        for i in 0..MAX_VOICES {
            delays_left.push(DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate));
            delays_right.push(DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate));

            let mut lfo = Lfo::new(LfoWaveform::Sine);
            // Different rates and phases for each voice
            lfo.set_phase(i as f32 * 0.25);
            lfos.push(lfo);
        }

        Self {
            settings: VocalDoublerSettings::default(),
            delays_left,
            delays_right,
            lfos,
            sample_rate: sample_rate as f32,
        }
    }

    pub fn update_settings(&mut self, settings: VocalDoublerSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        for i in 0..MAX_VOICES {
            self.delays_left[i] = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
            self.delays_right[i] = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
        }
    }
}

impl AudioEffect for VocalDoubler {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let num_voices = (self.settings.voices as usize).min(MAX_VOICES);
        let base_delay_ms = self.settings.delay;
        let detune = self.settings.detune; // cents
        let spread = self.settings.spread / 100.0;
        let depth = self.settings.depth / 100.0;
        let mix = self.settings.mix / 100.0;

        // Convert detune cents to delay modulation depth
        // ~1 cent = ~0.01ms of delay variation at typical modulation rates
        let detune_depth_ms = detune * 0.02;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;

            for voice in 0..num_voices {
                // Each voice has slightly different delay and modulation
                let voice_offset = (voice as f32 + 1.0) / (num_voices as f32 + 1.0);

                // Base delay for this voice
                let voice_delay_ms = base_delay_ms * (0.5 + voice_offset);

                // LFO modulation for subtle pitch/time variation
                let lfo_rate = 0.5 + voice as f32 * 0.3; // Slightly different rates
                let lfo_val = self.lfos[voice].tick(lfo_rate, self.sample_rate);
                let mod_depth = detune_depth_ms * depth * lfo_val;

                let delay_samples = (voice_delay_ms + mod_depth) * 0.001 * self.sample_rate;

                // Write to delay lines
                self.delays_left[voice].write(dry_l);
                self.delays_right[voice].write(dry_r);

                // Read delayed samples
                let delayed_l = self.delays_left[voice].read_interpolated(delay_samples);
                let delayed_r = self.delays_right[voice].read_interpolated(delay_samples);

                // Stereo spread - alternate voices between channels
                let pan_angle = (voice as f32 / num_voices as f32 - 0.5) * spread * PI;
                let pan_l = (PI / 4.0 - pan_angle).cos();
                let pan_r = (PI / 4.0 + pan_angle).cos();

                wet_l += delayed_l * pan_l;
                wet_r += delayed_r * pan_r;
            }

            // Normalize by number of voices
            if num_voices > 0 {
                wet_l /= num_voices as f32;
                wet_r /= num_voices as f32;
            }

            // Mix dry and wet
            frame[0] = dry_l * (1.0 - mix * 0.5) + wet_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix * 0.5) + wet_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        for i in 0..MAX_VOICES {
            self.delays_left[i].reset();
            self.delays_right[i].reset();
            self.lfos[i].reset();
        }
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
