//! Rotary Speaker (Leslie) Simulation
//!
//! Simulates a Leslie cabinet with rotating horn and drum speakers.
//! Includes doppler effect, amplitude modulation, and crossover.

use super::dsp::{crossfade, soft_clip, Biquad, BiquadType, DelayLine};
use super::types::{RotarySpeakerSettings, RotarySpeed};
use super::AudioEffect;
use std::f32::consts::PI;

/// Rotating element (horn or drum)
struct Rotor {
    phase: f32,           // Current rotation angle (0-1)
    target_speed: f32,    // Target rotation speed (Hz)
    current_speed: f32,   // Current speed (ramps to target)
    acceleration: f32,    // Ramp rate
    delay_l: DelayLine,   // Delay for doppler L
    delay_r: DelayLine,   // Delay for doppler R
    max_delay_ms: f32,    // Maximum doppler delay
}

impl Rotor {
    fn new(sample_rate: u32, max_delay_ms: f32) -> Self {
        let max_delay_secs = max_delay_ms / 1000.0;
        Self {
            phase: 0.0,
            target_speed: 1.0,
            current_speed: 1.0,
            acceleration: 0.5,
            delay_l: DelayLine::new(max_delay_secs, sample_rate),
            delay_r: DelayLine::new(max_delay_secs, sample_rate),
            max_delay_ms,
        }
    }

    fn set_sample_rate(&mut self, rate: u32) {
        let max_delay_secs = self.max_delay_ms / 1000.0;
        self.delay_l = DelayLine::new(max_delay_secs, rate);
        self.delay_r = DelayLine::new(max_delay_secs, rate);
    }

    fn set_speed(&mut self, speed: f32) {
        self.target_speed = speed;
    }

    fn set_acceleration(&mut self, accel: f32) {
        // Acceleration in Hz/second
        self.acceleration = accel;
    }

    fn process(&mut self, input: f32, sample_rate: f32) -> (f32, f32) {
        // Ramp current speed towards target
        let speed_diff = self.target_speed - self.current_speed;
        let max_change = self.acceleration / sample_rate;
        if speed_diff.abs() > max_change {
            self.current_speed += speed_diff.signum() * max_change;
        } else {
            self.current_speed = self.target_speed;
        }

        // Advance rotation
        self.phase += self.current_speed / sample_rate;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        let angle = self.phase * 2.0 * PI;

        // Doppler delay modulation (speakers at 180° apart)
        // Left speaker at angle, right at angle + π
        let doppler_depth = self.max_delay_ms / 2.0; // Half of max delay for modulation range

        let delay_l_ms = doppler_depth * (1.0 + angle.sin());
        let delay_r_ms = doppler_depth * (1.0 + (angle + PI).sin());

        let delay_l_samples = delay_l_ms * sample_rate / 1000.0;
        let delay_r_samples = delay_r_ms * sample_rate / 1000.0;

        // Write to delay lines
        self.delay_l.write(input);
        self.delay_r.write(input);

        // Read with interpolation
        let out_l = self.delay_l.read_interpolated(delay_l_samples);
        let out_r = self.delay_r.read_interpolated(delay_r_samples);

        // Amplitude modulation (directional effect)
        let am_l = 0.5 + 0.5 * angle.cos();
        let am_r = 0.5 + 0.5 * (angle + PI).cos();

        (out_l * am_l, out_r * am_r)
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.current_speed = self.target_speed;
        self.delay_l.reset();
        self.delay_r.reset();
    }
}

pub struct RotarySpeaker {
    settings: RotarySpeakerSettings,
    sample_rate: u32,
    enabled: bool,

    // Crossover filter (split signal into horn and drum frequencies)
    crossover_hp: Biquad, // Horn (high frequencies)
    crossover_lp: Biquad, // Drum (low frequencies)

    // Rotating elements
    horn: Rotor,
    drum: Rotor,

    // Drive saturation
    drive_hp: Biquad, // Pre-emphasis for drive
}

impl RotarySpeaker {
    pub fn new(sample_rate: u32) -> Self {
        let crossover_freq = 800.0; // Hz
        let sr = sample_rate as f32;

        let mut crossover_hp = Biquad::new();
        crossover_hp.configure(BiquadType::Highpass, crossover_freq, 0.5, 0.0, sr);

        let mut crossover_lp = Biquad::new();
        crossover_lp.configure(BiquadType::Lowpass, crossover_freq, 0.5, 0.0, sr);

        let mut drive_hp = Biquad::new();
        drive_hp.configure(BiquadType::Highpass, 200.0, 0.7, 0.0, sr);

        Self {
            settings: RotarySpeakerSettings::default(),
            sample_rate,
            enabled: false,
            crossover_hp,
            crossover_lp,
            horn: Rotor::new(sample_rate, 1.5), // Horn: 1.5ms max doppler
            drum: Rotor::new(sample_rate, 3.0), // Drum: 3ms max doppler (larger)
            drive_hp,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        let sr = rate as f32;
        self.crossover_hp = Biquad::new();
        self.crossover_hp.configure(BiquadType::Highpass, 800.0, 0.5, 0.0, sr);
        self.crossover_lp = Biquad::new();
        self.crossover_lp.configure(BiquadType::Lowpass, 800.0, 0.5, 0.0, sr);
        self.horn.set_sample_rate(rate);
        self.drum.set_sample_rate(rate);
        self.drive_hp = Biquad::new();
        self.drive_hp.configure(BiquadType::Highpass, 200.0, 0.7, 0.0, sr);
    }

    pub fn update_settings(&mut self, settings: RotarySpeakerSettings) {
        self.enabled = settings.enabled;

        // Set rotation speeds based on speed setting
        let (horn_speed, drum_speed) = match settings.speed {
            RotarySpeed::Stop => (0.0, 0.0),
            RotarySpeed::Slow => (settings.slow_rate, settings.slow_rate * 0.85), // Drum slightly slower
            RotarySpeed::Fast => (settings.fast_rate, settings.fast_rate * 0.85),
        };

        self.horn.set_speed(horn_speed);
        self.drum.set_speed(drum_speed);

        // Acceleration (time to switch between slow/fast)
        let accel = settings.acceleration / 100.0 * 5.0 + 0.5; // 0.5 to 5.5 Hz/s
        self.horn.set_acceleration(accel);
        self.drum.set_acceleration(accel * 0.7); // Drum accelerates slower

        self.settings = settings;
    }
}

impl AudioEffect for RotarySpeaker {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let sr = self.sample_rate as f32;
        let mix = self.settings.mix / 100.0;
        let horn_level = self.settings.horn_level / 100.0;
        let drum_level = self.settings.drum_level / 100.0;
        let drive = self.settings.drive / 100.0;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { dry_l };

            // Sum to mono for processing (Leslie is inherently mono in)
            let mono = (dry_l + dry_r) * 0.5;

            // Apply drive (tube-like saturation)
            let driven = if drive > 0.01 {
                let boosted = self.drive_hp.process(mono) * (1.0 + drive * 4.0);
                let saturated = soft_clip(boosted * (1.0 + drive * 2.0));
                mono * (1.0 - drive) + saturated * drive
            } else {
                mono
            };

            // Split into frequency bands
            let horn_in = self.crossover_hp.process(driven);
            let drum_in = self.crossover_lp.process(driven);

            // Process through rotating elements
            let (horn_l, horn_r) = self.horn.process(horn_in, sr);
            let (drum_l, drum_r) = self.drum.process(drum_in, sr);

            // Mix bands with level controls
            let wet_l = horn_l * horn_level + drum_l * drum_level;
            let wet_r = horn_r * horn_level + drum_r * drum_level;

            // Mix with dry
            frame[0] = crossfade(dry_l, wet_l, mix);
            if frame.len() > 1 {
                frame[1] = crossfade(dry_r, wet_r, mix);
            }
        }
    }

    fn reset(&mut self) {
        self.crossover_hp.reset();
        self.crossover_lp.reset();
        self.horn.reset();
        self.drum.reset();
        self.drive_hp.reset();
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
