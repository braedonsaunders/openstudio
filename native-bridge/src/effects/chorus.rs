//! Chorus effect - modulated delay for thickening

use super::dsp::{DelayLine, Lfo, LfoWaveform};
use super::types::ChorusSettings;
use super::AudioEffect;
use std::f32::consts::PI;

const NUM_VOICES: usize = 3;

pub struct Chorus {
    settings: ChorusSettings,
    // Multiple voices with different phase offsets
    delay_left: Vec<DelayLine>,
    delay_right: Vec<DelayLine>,
    lfos: Vec<Lfo>,
    sample_rate: f32,
}

impl Chorus {
    const MAX_DELAY_MS: f32 = 50.0;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        let max_delay_secs = Self::MAX_DELAY_MS / 1000.0;

        let mut delay_left = Vec::with_capacity(NUM_VOICES);
        let mut delay_right = Vec::with_capacity(NUM_VOICES);
        let mut lfos = Vec::with_capacity(NUM_VOICES);

        for i in 0..NUM_VOICES {
            delay_left.push(DelayLine::new(max_delay_secs, sample_rate));
            delay_right.push(DelayLine::new(max_delay_secs, sample_rate));

            let mut lfo = Lfo::new(LfoWaveform::Sine);
            // Offset each voice's LFO phase
            lfo.set_phase(i as f32 / NUM_VOICES as f32);
            lfos.push(lfo);
        }

        Self {
            settings: ChorusSettings::default(),
            delay_left,
            delay_right,
            lfos,
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: ChorusSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        let max_delay_secs = Self::MAX_DELAY_MS / 1000.0;

        for i in 0..NUM_VOICES {
            self.delay_left[i] = DelayLine::new(max_delay_secs, rate);
            self.delay_right[i] = DelayLine::new(max_delay_secs, rate);
        }
    }
}

impl AudioEffect for Chorus {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let base_delay_ms = self.settings.delay;
        let rate = self.settings.rate;
        let depth = self.settings.depth;
        let feedback = self.settings.feedback.clamp(0.0, 0.9);
        let spread_rad = self.settings.spread * PI / 180.0; // degrees to radians
        let mix = self.settings.mix;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;

            for voice in 0..NUM_VOICES {
                // Modulate delay time
                let lfo_val = self.lfos[voice].tick(rate, self.sample_rate);

                // Calculate delay with modulation
                let delay_ms = base_delay_ms + lfo_val * depth * base_delay_ms * 0.5;
                let delay_samples = delay_ms * 0.001 * self.sample_rate;

                // Read delayed samples
                let delayed_l = self.delay_left[voice].read_interpolated(delay_samples);
                let delayed_r = self.delay_right[voice].read_interpolated(delay_samples);

                // Write with feedback
                self.delay_left[voice].write(dry_l + delayed_l * feedback);
                self.delay_right[voice].write(dry_r + delayed_r * feedback);

                // Stereo spread - pan each voice differently
                let voice_angle = (voice as f32 / NUM_VOICES as f32 - 0.5) * spread_rad;
                let pan_l = (PI / 4.0 - voice_angle).cos();
                let pan_r = (PI / 4.0 + voice_angle).cos();

                wet_l += delayed_l * pan_l;
                wet_r += delayed_r * pan_r;
            }

            // Normalize by number of voices
            wet_l /= NUM_VOICES as f32;
            wet_r /= NUM_VOICES as f32;

            // Mix
            frame[0] = dry_l * (1.0 - mix) + wet_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + wet_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        for i in 0..NUM_VOICES {
            self.delay_left[i].reset();
            self.delay_right[i].reset();
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
