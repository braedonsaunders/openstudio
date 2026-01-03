//! Transient Shaper - attack and sustain control

use super::dsp::{db_to_linear, EnvelopeFollower};
use super::types::TransientShaperSettings;
use super::AudioEffect;

pub struct TransientShaper {
    settings: TransientShaperSettings,
    // Fast envelope for attack detection
    fast_env_l: EnvelopeFollower,
    fast_env_r: EnvelopeFollower,
    // Slow envelope for sustain detection
    slow_env_l: EnvelopeFollower,
    slow_env_r: EnvelopeFollower,
    sample_rate: f32,
}

impl TransientShaper {
    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        Self {
            settings: TransientShaperSettings::default(),
            fast_env_l: EnvelopeFollower::new(0.1, 50.0, sr),
            fast_env_r: EnvelopeFollower::new(0.1, 50.0, sr),
            slow_env_l: EnvelopeFollower::new(20.0, 200.0, sr),
            slow_env_r: EnvelopeFollower::new(20.0, 200.0, sr),
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: TransientShaperSettings) {
        // Update envelope times
        self.fast_env_l.set_times(
            settings.attack_time * 0.1, // Very fast attack
            settings.release_time * 0.5,
            self.sample_rate,
        );
        self.fast_env_r.set_times(
            settings.attack_time * 0.1,
            settings.release_time * 0.5,
            self.sample_rate,
        );
        self.slow_env_l.set_times(
            settings.attack_time * 2.0, // Slow attack
            settings.release_time * 2.0,
            self.sample_rate,
        );
        self.slow_env_r.set_times(
            settings.attack_time * 2.0,
            settings.release_time * 2.0,
            self.sample_rate,
        );
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_settings(self.settings.clone());
    }
}

impl AudioEffect for TransientShaper {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let attack_amount = self.settings.attack / 100.0; // -1 to 1
        let sustain_amount = self.settings.sustain / 100.0; // -1 to 1
        let output_gain = db_to_linear(self.settings.output_gain);

        for frame in samples.chunks_mut(2) {
            let in_l = frame[0];
            let in_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Get envelopes
            let fast_l = self.fast_env_l.process(in_l);
            let fast_r = self.fast_env_r.process(in_r);
            let slow_l = self.slow_env_l.process(in_l);
            let slow_r = self.slow_env_r.process(in_r);

            // Transient detection: fast - slow gives attack component
            let transient_l = (fast_l - slow_l).max(0.0);
            let transient_r = (fast_r - slow_r).max(0.0);

            // Sustain is approximated by the slow envelope
            let sustain_l = slow_l;
            let sustain_r = slow_r;

            // Calculate gain modifiers
            // Attack boost/cut
            let attack_mod_l = if attack_amount > 0.0 {
                1.0 + transient_l * attack_amount * 4.0 // Boost
            } else {
                1.0 / (1.0 + transient_l * (-attack_amount) * 4.0) // Cut
            };
            let attack_mod_r = if attack_amount > 0.0 {
                1.0 + transient_r * attack_amount * 4.0
            } else {
                1.0 / (1.0 + transient_r * (-attack_amount) * 4.0)
            };

            // Sustain boost/cut (applied when not in transient)
            let non_transient_l = (1.0 - transient_l * 10.0).clamp(0.0, 1.0);
            let non_transient_r = (1.0 - transient_r * 10.0).clamp(0.0, 1.0);

            let sustain_mod_l = if sustain_amount > 0.0 {
                1.0 + non_transient_l * sustain_l * sustain_amount * 3.0
            } else {
                1.0 / (1.0 + non_transient_l * sustain_l * (-sustain_amount) * 3.0)
            };
            let sustain_mod_r = if sustain_amount > 0.0 {
                1.0 + non_transient_r * sustain_r * sustain_amount * 3.0
            } else {
                1.0 / (1.0 + non_transient_r * sustain_r * (-sustain_amount) * 3.0)
            };

            // Apply modifiers
            frame[0] = in_l * attack_mod_l * sustain_mod_l * output_gain;
            if frame.len() > 1 {
                frame[1] = in_r * attack_mod_r * sustain_mod_r * output_gain;
            }
        }
    }

    fn reset(&mut self) {
        self.fast_env_l.reset();
        self.fast_env_r.reset();
        self.slow_env_l.reset();
        self.slow_env_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
