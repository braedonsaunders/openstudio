//! Wah effect - resonant bandpass filter with frequency sweep

use super::dsp::{BiquadType, EnvelopeFollower, Lfo, LfoWaveform, StereoBiquad};
use super::types::{WahMode, WahSettings};
use super::AudioEffect;

pub struct Wah {
    settings: WahSettings,
    filter: StereoBiquad,
    lfo: Lfo,
    envelope: EnvelopeFollower,
    sample_rate: f32,
    current_freq: f32,
}

impl Wah {
    // Wah frequency range (in Hz)
    const MIN_FREQ: f32 = 350.0;
    const MAX_FREQ: f32 = 2500.0;

    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: WahSettings::default(),
            filter: StereoBiquad::new(),
            lfo: Lfo::new(LfoWaveform::Sine),
            envelope: EnvelopeFollower::new(10.0, 100.0, sample_rate as f32),
            sample_rate: sample_rate as f32,
            current_freq: Self::MIN_FREQ,
        }
    }

    pub fn update_settings(&mut self, settings: WahSettings) {
        self.envelope
            .set_times(settings.attack, settings.release, self.sample_rate);
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.envelope.set_times(
            self.settings.attack,
            self.settings.release,
            self.sample_rate,
        );
    }

    /// Calculate target frequency based on mode
    fn get_target_freq(&mut self, input_level: f32) -> f32 {
        let freq_range = Self::MAX_FREQ - Self::MIN_FREQ;

        match self.settings.mode {
            WahMode::Manual => {
                // Direct control from frequency parameter (0-1)
                Self::MIN_FREQ + self.settings.frequency * freq_range
            }
            WahMode::Auto => {
                // LFO-controlled sweep at ~1Hz
                let lfo_val = self.lfo.tick(1.0, self.sample_rate);
                let position = (lfo_val + 1.0) * 0.5; // 0 to 1
                Self::MIN_FREQ + position * freq_range
            }
            WahMode::Envelope => {
                // Follow input envelope
                let env = self.envelope.process(input_level);
                // Map envelope (typically 0-1) to frequency
                let position = (env * 10.0).clamp(0.0, 1.0);
                Self::MIN_FREQ + position * freq_range
            }
        }
    }
}

impl AudioEffect for Wah {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let q = 1.0 + self.settings.resonance * 9.0; // Q from 1 to 10

        for frame in samples.chunks_mut(2) {
            // Get input level for envelope follower
            let input_level = if frame.len() > 1 {
                (frame[0].abs() + frame[1].abs()) * 0.5
            } else {
                frame[0].abs()
            };

            // Get target frequency
            let target_freq = self.get_target_freq(input_level);

            // Smooth frequency changes
            self.current_freq += (target_freq - self.current_freq) * 0.1;

            // Update filter
            self.filter.configure(
                BiquadType::Bandpass,
                self.current_freq,
                q,
                0.0,
                self.sample_rate,
            );

            // Process
            let (left, right) = self
                .filter
                .process(frame[0], if frame.len() > 1 { frame[1] } else { frame[0] });

            // Mix with dry signal for more natural sound
            frame[0] = frame[0] * 0.3 + left * 0.7;
            if frame.len() > 1 {
                frame[1] = frame[1] * 0.3 + right * 0.7;
            }
        }
    }

    fn reset(&mut self) {
        self.filter.reset();
        self.lfo.reset();
        self.envelope.reset();
        self.current_freq = Self::MIN_FREQ;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
