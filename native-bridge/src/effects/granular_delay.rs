//! Granular Delay - delay with pitch-shifted grains
//!
//! Creates textures ranging from subtle thickening to shimmering clouds.

use super::dsp::{crossfade, Biquad, BiquadType};
use super::types::GranularDelaySettings;
use super::AudioEffect;
use std::f32::consts::PI;

const MAX_GRAINS: usize = 8;
const MAX_DELAY_MS: f32 = 2000.0;

/// A single grain
struct Grain {
    active: bool,
    start_pos: usize,      // Position in delay buffer
    read_pos: f32,         // Current playback position (can be fractional for pitch shift)
    length: usize,         // Grain length in samples
    env_pos: usize,        // Position in envelope
    pitch_ratio: f32,      // Playback speed (1.0 = normal, 2.0 = octave up)
    pan: f32,              // Stereo pan (-1 to 1)
}

impl Grain {
    fn new() -> Self {
        Self {
            active: false,
            start_pos: 0,
            read_pos: 0.0,
            length: 0,
            env_pos: 0,
            pitch_ratio: 1.0,
            pan: 0.0,
        }
    }
}

pub struct GranularDelay {
    settings: GranularDelaySettings,
    sample_rate: u32,
    enabled: bool,

    // Delay buffer (stereo interleaved)
    buffer: Vec<f32>,
    write_pos: usize,
    buffer_size: usize,

    // Grains
    grains: [Grain; MAX_GRAINS],
    next_grain_time: usize,
    grain_spacing: usize,

    // Grain window (Hann)
    window: Vec<f32>,

    // Feedback filtering
    feedback_lp: Biquad,

    // Random state
    rand_state: u32,
}

impl GranularDelay {
    pub fn new(sample_rate: u32) -> Self {
        let buffer_size = (sample_rate as usize * MAX_DELAY_MS as usize) / 1000 * 2;
        let grain_size = (sample_rate as usize * 50) / 1000; // Default 50ms grains

        // Create Hann window
        let mut window = vec![0.0f32; grain_size];
        for i in 0..grain_size {
            window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / grain_size as f32).cos());
        }

        let mut feedback_lp = Biquad::new();
        feedback_lp.configure(BiquadType::Lowpass, 8000.0, 0.7, 0.0, sample_rate as f32);

        Self {
            settings: GranularDelaySettings::default(),
            sample_rate,
            enabled: false,
            buffer: vec![0.0; buffer_size],
            write_pos: 0,
            buffer_size,
            grains: std::array::from_fn(|_| Grain::new()),
            next_grain_time: 0,
            grain_spacing: grain_size / 4,
            window,
            feedback_lp,
            rand_state: 12345,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        let buffer_size = (rate as usize * MAX_DELAY_MS as usize) / 1000 * 2;
        self.buffer.resize(buffer_size, 0.0);
        self.buffer_size = buffer_size;
        self.feedback_lp = Biquad::new();
        self.feedback_lp.configure(BiquadType::Lowpass, 8000.0, 0.7, 0.0, rate as f32);
        self.update_grain_params();
    }

    pub fn update_settings(&mut self, settings: GranularDelaySettings) {
        self.enabled = settings.enabled;
        self.settings = settings;
        self.update_grain_params();
    }

    fn update_grain_params(&mut self) {
        let grain_size = (self.sample_rate as f32 * self.settings.grain_size / 1000.0) as usize;
        let grain_size = grain_size.max(64);

        // Resize window
        self.window.resize(grain_size, 0.0);
        for i in 0..grain_size {
            self.window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / grain_size as f32).cos());
        }

        // Calculate grain spacing based on density
        let density = self.settings.density / 100.0;
        let overlap = 0.25 + density * 0.5; // 25% to 75% overlap
        self.grain_spacing = (grain_size as f32 * (1.0 - overlap)) as usize;
        self.grain_spacing = self.grain_spacing.max(16);
    }

    /// Simple pseudo-random number generator
    fn rand(&mut self) -> f32 {
        self.rand_state = self.rand_state.wrapping_mul(1103515245).wrapping_add(12345);
        ((self.rand_state >> 16) & 0x7FFF) as f32 / 32768.0
    }

    fn spawn_grain(&mut self) {
        // Find inactive grain slot index
        let slot_idx = self.grains.iter().position(|g| !g.active);
        if let Some(idx) = slot_idx {
            let delay_samples = (self.sample_rate as f32 * self.settings.delay_time / 1000.0) as usize;
            let grain_size = self.window.len();

            // Add texture randomization (generate randoms before borrowing grain)
            let texture = self.settings.texture / 100.0;
            let rand1 = self.rand();
            let rand2 = self.rand();
            let rand3 = self.rand();

            let delay_jitter = (rand1 - 0.5) * texture * delay_samples as f32 * 0.2;
            let pitch_jitter = (rand2 - 0.5) * texture * 1.0; // ±0.5 semitones

            // Start position with jitter
            let start = (self.write_pos + self.buffer_size - delay_samples * 2) % self.buffer_size;
            let start = (start as f32 + delay_jitter) as usize % self.buffer_size;

            // Pitch ratio from settings + jitter
            let base_ratio = 2.0f32.powf(self.settings.pitch / 12.0);
            let ratio = base_ratio * 2.0f32.powf(pitch_jitter / 12.0);

            // Random pan based on spread
            let spread = self.settings.spread / 100.0;
            let pan = (rand3 - 0.5) * 2.0 * spread;

            // Now borrow grain and set values
            let grain = &mut self.grains[idx];
            grain.active = true;
            grain.start_pos = start;
            grain.read_pos = 0.0;
            grain.length = grain_size;
            grain.env_pos = 0;
            grain.pitch_ratio = ratio;
            grain.pan = pan;
        }
    }
}

impl AudioEffect for GranularDelay {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.enabled {
            return;
        }

        let mix = self.settings.mix / 100.0;
        let feedback = self.settings.feedback / 100.0 * 0.95;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { dry_l };

            // Write to delay buffer (with feedback)
            let fb_l = self.feedback_lp.process(self.buffer[self.write_pos]);
            let fb_r = self.buffer[self.write_pos + 1];

            self.buffer[self.write_pos] = dry_l + fb_l * feedback;
            self.buffer[self.write_pos + 1] = dry_r + fb_r * feedback;
            self.write_pos = (self.write_pos + 2) % self.buffer_size;

            // Spawn new grains
            if self.next_grain_time == 0 {
                self.spawn_grain();
                self.next_grain_time = self.grain_spacing;
            } else {
                self.next_grain_time -= 1;
            }

            // Sum grain outputs
            let mut out_l = 0.0f32;
            let mut out_r = 0.0f32;

            for grain in &mut self.grains {
                if !grain.active {
                    continue;
                }

                // Get windowed sample from buffer
                let read_idx = grain.start_pos + (grain.read_pos as usize * 2);
                let read_idx = read_idx % self.buffer_size;
                let frac = grain.read_pos.fract();

                // Linear interpolation
                let next_idx = (read_idx + 2) % self.buffer_size;
                let sample_l = self.buffer[read_idx] * (1.0 - frac) + self.buffer[next_idx] * frac;
                let sample_r = self.buffer[read_idx + 1] * (1.0 - frac)
                    + self.buffer[(next_idx + 1) % self.buffer_size] * frac;

                // Apply window
                let env = if grain.env_pos < self.window.len() {
                    self.window[grain.env_pos]
                } else {
                    0.0
                };

                // Apply pan
                let pan_l = (1.0 - grain.pan.max(0.0)).sqrt();
                let pan_r = (1.0 + grain.pan.min(0.0)).sqrt();

                out_l += sample_l * env * pan_l;
                out_r += sample_r * env * pan_r;

                // Advance grain
                grain.read_pos += grain.pitch_ratio;
                grain.env_pos += 1;

                // Deactivate when done
                if grain.env_pos >= grain.length {
                    grain.active = false;
                }
            }

            // Normalize by average active grains
            let active_count = self.grains.iter().filter(|g| g.active).count().max(1) as f32;
            out_l /= active_count.sqrt();
            out_r /= active_count.sqrt();

            // Mix
            frame[0] = crossfade(dry_l, out_l, mix);
            if frame.len() > 1 {
                frame[1] = crossfade(dry_r, out_r, mix);
            }
        }
    }

    fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
        for grain in &mut self.grains {
            grain.active = false;
        }
        self.next_grain_time = 0;
        self.feedback_lp.reset();
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}
