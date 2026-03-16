//! Multi-Filter - versatile filter with LFO and envelope modulation

use super::dsp::{BiquadType, EnvelopeFollower, Lfo, LfoWaveform, StereoBiquad};
use super::types::{MultiFilterSettings, MultiFilterType};
use super::AudioEffect;

pub struct MultiFilter {
    settings: MultiFilterSettings,
    filter: StereoBiquad,
    lfo: Lfo,
    envelope: EnvelopeFollower,
    sample_rate: f32,
    current_freq: f32,
}

impl MultiFilter {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: MultiFilterSettings::default(),
            filter: StereoBiquad::new(),
            lfo: Lfo::new(LfoWaveform::Sine),
            envelope: EnvelopeFollower::new(10.0, 100.0, sample_rate as f32),
            sample_rate: sample_rate as f32,
            current_freq: 1000.0,
        }
    }

    pub fn update_settings(&mut self, settings: MultiFilterSettings) {
        self.envelope.set_times(
            settings.envelope_attack,
            settings.envelope_release,
            self.sample_rate,
        );
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
    }

    fn get_filter_type(&self) -> BiquadType {
        match self.settings.filter_type {
            MultiFilterType::Lowpass => BiquadType::Lowpass,
            MultiFilterType::Highpass => BiquadType::Highpass,
            MultiFilterType::Bandpass => BiquadType::Bandpass,
            MultiFilterType::Notch => BiquadType::Notch,
            MultiFilterType::Allpass => BiquadType::Allpass,
            MultiFilterType::Formant => BiquadType::Peak, // Approximate formant with peak
        }
    }
}

impl AudioEffect for MultiFilter {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let base_freq = self.settings.frequency;
        let lfo_rate = self.settings.lfo_rate;
        let lfo_depth = self.settings.lfo_depth / 100.0;
        let env_amount = self.settings.envelope_amount / 100.0;
        let q = 0.5 + self.settings.resonance / 100.0 * 9.5; // Q from 0.5 to 10
        let filter_type = self.get_filter_type();

        for frame in samples.chunks_mut(2) {
            // Get input level for envelope
            let input_level = if frame.len() > 1 {
                (frame[0].abs() + frame[1].abs()) * 0.5
            } else {
                frame[0].abs()
            };

            // LFO modulation
            let lfo_val = if lfo_rate > 0.0 {
                self.lfo.tick(lfo_rate, self.sample_rate)
            } else {
                0.0
            };

            // Envelope modulation
            let env_val = self.envelope.process(input_level);

            // Calculate target frequency with modulation
            // Use logarithmic scaling for more musical sweep
            let lfo_mod = 2.0_f32.powf(lfo_val * lfo_depth * 2.0); // +/- 2 octaves
            let env_mod = 2.0_f32.powf(env_val * env_amount * 4.0); // +/- 4 octaves

            let target_freq = (base_freq * lfo_mod * env_mod).clamp(20.0, 20000.0);

            // Smooth frequency changes
            self.current_freq += (target_freq - self.current_freq) * 0.1;

            // Update filter
            self.filter
                .configure(filter_type, self.current_freq, q, 0.0, self.sample_rate);

            // Process
            let (left, right) = self
                .filter
                .process(frame[0], if frame.len() > 1 { frame[1] } else { frame[0] });

            frame[0] = left;
            if frame.len() > 1 {
                frame[1] = right;
            }
        }
    }

    fn reset(&mut self) {
        self.filter.reset();
        self.lfo.reset();
        self.envelope.reset();
        self.current_freq = self.settings.frequency;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
