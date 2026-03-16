//! Noise Gate - dynamic range gate with attack/hold/release

use super::dsp::{db_to_linear, EnvelopeFollower};
use super::types::NoiseGateSettings;
use super::AudioEffect;

/// Gate state machine
#[derive(Debug, Clone, Copy, PartialEq)]
enum GateState {
    Closed,
    Attack,
    Open,
    Hold,
    Release,
}

pub struct NoiseGate {
    settings: NoiseGateSettings,
    envelope: EnvelopeFollower,
    state: GateState,
    gain: f32,
    hold_counter: u32,
    sample_rate: f32,
}

impl NoiseGate {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            settings: NoiseGateSettings::default(),
            envelope: EnvelopeFollower::new(0.1, 100.0, sample_rate as f32),
            state: GateState::Closed,
            gain: 0.0,
            hold_counter: 0,
            sample_rate: sample_rate as f32,
        }
    }

    pub fn update_settings(&mut self, settings: NoiseGateSettings) {
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

    pub fn is_gate_open(&self) -> bool {
        matches!(
            self.state,
            GateState::Open | GateState::Attack | GateState::Hold
        )
    }
}

impl AudioEffect for NoiseGate {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let threshold_linear = db_to_linear(self.settings.threshold);
        let range_linear = db_to_linear(self.settings.range);
        let attack_samples = (self.settings.attack * 0.001 * self.sample_rate) as u32;
        let hold_samples = (self.settings.hold * 0.001 * self.sample_rate) as u32;
        let release_samples = (self.settings.release * 0.001 * self.sample_rate) as u32;

        // Attack/release increments
        let attack_inc = if attack_samples > 0 {
            1.0 / attack_samples as f32
        } else {
            1.0
        };
        let release_inc = if release_samples > 0 {
            1.0 / release_samples as f32
        } else {
            1.0
        };

        for frame in samples.chunks_mut(2) {
            // Get level from both channels
            let level = if frame.len() > 1 {
                (frame[0].abs() + frame[1].abs()) * 0.5
            } else {
                frame[0].abs()
            };

            let envelope = self.envelope.process(level);
            let above_threshold = envelope > threshold_linear;

            // State machine
            match self.state {
                GateState::Closed => {
                    if above_threshold {
                        self.state = GateState::Attack;
                    }
                }
                GateState::Attack => {
                    self.gain += attack_inc;
                    if self.gain >= 1.0 {
                        self.gain = 1.0;
                        self.state = GateState::Open;
                    }
                }
                GateState::Open => {
                    if !above_threshold {
                        self.hold_counter = hold_samples;
                        self.state = GateState::Hold;
                    }
                }
                GateState::Hold => {
                    if above_threshold {
                        self.state = GateState::Open;
                    } else if self.hold_counter > 0 {
                        self.hold_counter -= 1;
                    } else {
                        self.state = GateState::Release;
                    }
                }
                GateState::Release => {
                    self.gain -= release_inc;
                    if self.gain <= 0.0 {
                        self.gain = 0.0;
                        self.state = GateState::Closed;
                    } else if above_threshold {
                        self.state = GateState::Attack;
                    }
                }
            }

            // Apply gain with range (minimum attenuation when closed)
            let effective_gain = range_linear + self.gain * (1.0 - range_linear);

            frame[0] *= effective_gain;
            if frame.len() > 1 {
                frame[1] *= effective_gain;
            }
        }
    }

    fn reset(&mut self) {
        self.envelope.reset();
        self.state = GateState::Closed;
        self.gain = 0.0;
        self.hold_counter = 0;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
