//! Flanger effect - short modulated delay with feedback

use super::dsp::{DelayLine, Lfo, LfoWaveform};
use super::types::FlangerSettings;
use super::AudioEffect;

pub struct Flanger {
    settings: FlangerSettings,
    delay_left: DelayLine,
    delay_right: DelayLine,
    lfo: Lfo,
    sample_rate: f32,
}

impl Flanger {
    const MAX_DELAY_MS: f32 = 15.0;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        Self {
            settings: FlangerSettings::default(),
            delay_left: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            delay_right: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            lfo: Lfo::new(LfoWaveform::Sine),
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: FlangerSettings) {
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.delay_left = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
        self.delay_right = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
    }
}

impl AudioEffect for Flanger {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let base_delay_ms = self.settings.delay;
        let rate = self.settings.rate;
        let depth = self.settings.depth;
        let mut feedback = self.settings.feedback;
        let mix = self.settings.mix;

        // Invert feedback for "negative" flanger mode
        if self.settings.negative {
            feedback = -feedback;
        }
        feedback = feedback.clamp(-0.95, 0.95);

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // LFO modulation (triangular sweep sounds classic)
            let lfo_val = self.lfo.tick(rate, self.sample_rate);
            let lfo_unipolar = (lfo_val + 1.0) * 0.5; // 0 to 1

            // Modulated delay time (0.1ms to base_delay_ms)
            let delay_ms = 0.1 + lfo_unipolar * depth * (base_delay_ms - 0.1);
            let delay_samples = delay_ms * 0.001 * self.sample_rate;

            // Read delayed samples
            let delayed_l = self.delay_left.read_interpolated(delay_samples);
            let delayed_r = self.delay_right.read_interpolated(delay_samples);

            // Write with feedback
            self.delay_left.write(dry_l + delayed_l * feedback);
            self.delay_right.write(dry_r + delayed_r * feedback);

            // Mix with comb filtering effect
            frame[0] = dry_l * (1.0 - mix) + (dry_l + delayed_l) * mix * 0.5;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + (dry_r + delayed_r) * mix * 0.5;
            }
        }
    }

    fn reset(&mut self) {
        self.delay_left.reset();
        self.delay_right.reset();
        self.lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
