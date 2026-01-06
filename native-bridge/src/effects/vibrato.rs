//! Vibrato effect - pitch modulation via variable delay

use super::dsp::{DelayLine, Lfo, LfoWaveform};
use super::types::{VibratoSettings, VibratoWaveform};
use super::AudioEffect;

pub struct Vibrato {
    settings: VibratoSettings,
    delay_left: DelayLine,
    delay_right: DelayLine,
    lfo: Lfo,
    sample_rate: f32,
    onset_counter: u32,
}

impl Vibrato {
    // Max delay for pitch modulation (~20ms)
    const MAX_DELAY_MS: f32 = 25.0;

    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: VibratoSettings::default(),
            delay_left: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            delay_right: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            lfo: Lfo::new(LfoWaveform::Sine),
            sample_rate: sample_rate as f32,
            onset_counter: 0,
        }
    }

    pub fn update_settings(&mut self, settings: VibratoSettings) {
        let waveform = match settings.waveform {
            VibratoWaveform::Sine => LfoWaveform::Sine,
            VibratoWaveform::Triangle => LfoWaveform::Triangle,
            VibratoWaveform::Square => LfoWaveform::Square,
            VibratoWaveform::Sawtooth => LfoWaveform::Sawtooth,
        };
        self.lfo.set_waveform(waveform);
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.delay_left = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
        self.delay_right = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
    }
}

impl AudioEffect for Vibrato {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let rate = self.settings.rate;
        let depth = self.settings.depth / 100.0; // Convert to 0-1
        let onset_samples = (self.settings.delay * 0.001 * self.sample_rate) as u32;

        // Center delay for vibrato modulation
        let center_delay_ms = Self::MAX_DELAY_MS / 2.0;

        for frame in samples.chunks_mut(2) {
            // Handle onset delay
            let effective_depth = if self.onset_counter < onset_samples {
                self.onset_counter += 1;
                // Fade in the effect
                depth * (self.onset_counter as f32 / onset_samples as f32)
            } else {
                depth
            };

            // LFO modulates delay time
            let lfo_val = self.lfo.tick(rate, self.sample_rate);

            // Calculate delay with modulation
            // depth controls how many cents of pitch variation (up to ~100 cents = 1 semitone)
            let delay_mod_ms = lfo_val * effective_depth * 2.0; // +/- 2ms max
            let delay_samples =
                (center_delay_ms + delay_mod_ms) * 0.001 * self.sample_rate;

            // Write current samples
            self.delay_left.write(frame[0]);
            if frame.len() > 1 {
                self.delay_right.write(frame[1]);
            } else {
                self.delay_right.write(frame[0]);
            }

            // Read modulated delay (this creates pitch shift)
            frame[0] = self.delay_left.read_interpolated(delay_samples);
            if frame.len() > 1 {
                frame[1] = self.delay_right.read_interpolated(delay_samples);
            }
        }
    }

    fn reset(&mut self) {
        self.delay_left.reset();
        self.delay_right.reset();
        self.lfo.reset();
        self.onset_counter = 0;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
        if enabled {
            self.onset_counter = 0;
        }
    }
}
