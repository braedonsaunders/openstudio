//! Core DSP primitives for effects processing
//!
//! This module provides fundamental building blocks:
//! - Biquad filters (lowpass, highpass, bandpass, peaking, shelf, allpass)
//! - Delay lines with interpolation
//! - LFO oscillators
//! - Envelope followers
//! - Utility functions

#![allow(dead_code)]

use std::f32::consts::{PI, TAU};

// ============================================================================
// BIQUAD FILTER
// ============================================================================

/// Biquad filter using Direct Form II Transposed
/// Supports all standard filter types with configurable parameters
#[derive(Debug, Clone)]
pub struct Biquad {
    // Coefficients
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    // State
    z1: f32,
    z2: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BiquadType {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
    Peak,
    LowShelf,
    HighShelf,
    Allpass,
}

impl Biquad {
    pub fn new() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    /// Configure filter coefficients
    /// Based on Audio EQ Cookbook by Robert Bristow-Johnson
    pub fn configure(
        &mut self,
        filter_type: BiquadType,
        freq: f32,
        q: f32,
        gain_db: f32,
        sample_rate: f32,
    ) {
        let freq = freq.clamp(20.0, sample_rate * 0.49);
        let q = q.max(0.1);

        let w0 = TAU * freq / sample_rate;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * q);
        let a = 10.0_f32.powf(gain_db / 40.0); // sqrt of linear gain

        let (b0, b1, b2, a0, a1, a2) = match filter_type {
            BiquadType::Lowpass => {
                let b1 = 1.0 - cos_w0;
                let b0 = b1 / 2.0;
                let b2 = b0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::Highpass => {
                let b1 = -(1.0 + cos_w0);
                let b0 = (1.0 + cos_w0) / 2.0;
                let b2 = b0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::Bandpass => {
                let b0 = alpha;
                let b1 = 0.0;
                let b2 = -alpha;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::Notch => {
                let b0 = 1.0;
                let b1 = -2.0 * cos_w0;
                let b2 = 1.0;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::Peak => {
                let b0 = 1.0 + alpha * a;
                let b1 = -2.0 * cos_w0;
                let b2 = 1.0 - alpha * a;
                let a0 = 1.0 + alpha / a;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha / a;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::LowShelf => {
                let sqrt_a = a.sqrt();
                let b0 = a * ((a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
                let b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0);
                let b2 = a * ((a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
                let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
                let a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cos_w0);
                let a2 = (a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::HighShelf => {
                let sqrt_a = a.sqrt();
                let b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha);
                let b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0);
                let b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha);
                let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + 2.0 * sqrt_a * alpha;
                let a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0);
                let a2 = (a + 1.0) - (a - 1.0) * cos_w0 - 2.0 * sqrt_a * alpha;
                (b0, b1, b2, a0, a1, a2)
            }
            BiquadType::Allpass => {
                let b0 = 1.0 - alpha;
                let b1 = -2.0 * cos_w0;
                let b2 = 1.0 + alpha;
                let a0 = 1.0 + alpha;
                let a1 = -2.0 * cos_w0;
                let a2 = 1.0 - alpha;
                (b0, b1, b2, a0, a1, a2)
            }
        };

        // Normalize by a0
        self.b0 = b0 / a0;
        self.b1 = b1 / a0;
        self.b2 = b2 / a0;
        self.a1 = a1 / a0;
        self.a2 = a2 / a0;
    }

    /// Process a single sample
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let output = self.b0 * input + self.z1;
        self.z1 = self.b1 * input - self.a1 * output + self.z2;
        self.z2 = self.b2 * input - self.a2 * output;
        output
    }

    pub fn reset(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }
}

impl Default for Biquad {
    fn default() -> Self {
        Self::new()
    }
}

/// Stereo biquad filter pair
#[derive(Debug, Clone, Default)]
pub struct StereoBiquad {
    pub left: Biquad,
    pub right: Biquad,
}

impl StereoBiquad {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn configure(
        &mut self,
        filter_type: BiquadType,
        freq: f32,
        q: f32,
        gain_db: f32,
        sample_rate: f32,
    ) {
        self.left
            .configure(filter_type, freq, q, gain_db, sample_rate);
        self.right
            .configure(filter_type, freq, q, gain_db, sample_rate);
    }

    #[inline]
    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        (self.left.process(left), self.right.process(right))
    }

    pub fn reset(&mut self) {
        self.left.reset();
        self.right.reset();
    }
}

// ============================================================================
// DELAY LINE
// ============================================================================

/// Delay line with linear interpolation for fractional delays
#[derive(Debug, Clone)]
pub struct DelayLine {
    buffer: Vec<f32>,
    write_pos: usize,
    max_delay_samples: usize,
}

impl DelayLine {
    /// Create a delay line with maximum delay in seconds
    pub fn new(max_delay_secs: f32, sample_rate: u32) -> Self {
        let max_samples = (max_delay_secs * sample_rate as f32).ceil() as usize + 2;
        Self {
            buffer: vec![0.0; max_samples],
            write_pos: 0,
            max_delay_samples: max_samples,
        }
    }

    /// Write a sample to the delay line
    #[inline]
    pub fn write(&mut self, sample: f32) {
        self.buffer[self.write_pos] = sample;
        self.write_pos = (self.write_pos + 1) % self.max_delay_samples;
    }

    /// Read from delay line with integer sample delay
    #[inline]
    pub fn read(&self, delay_samples: usize) -> f32 {
        let delay = delay_samples.min(self.max_delay_samples - 1);
        let read_pos =
            (self.write_pos + self.max_delay_samples - delay - 1) % self.max_delay_samples;
        self.buffer[read_pos]
    }

    /// Read from delay line with fractional sample delay (linear interpolation)
    #[inline]
    pub fn read_interpolated(&self, delay_samples: f32) -> f32 {
        let delay = delay_samples.clamp(0.0, (self.max_delay_samples - 2) as f32);
        let delay_int = delay as usize;
        let frac = delay - delay_int as f32;

        let pos1 =
            (self.write_pos + self.max_delay_samples - delay_int - 1) % self.max_delay_samples;
        let pos2 = (pos1 + self.max_delay_samples - 1) % self.max_delay_samples;

        self.buffer[pos1] * (1.0 - frac) + self.buffer[pos2] * frac
    }

    /// Write and read in one operation (tap-out, then write)
    #[inline]
    pub fn process(&mut self, input: f32, delay_samples: f32) -> f32 {
        let output = self.read_interpolated(delay_samples);
        self.write(input);
        output
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
    }
}

/// Stereo delay line pair
#[derive(Debug, Clone)]
pub struct StereoDelayLine {
    pub left: DelayLine,
    pub right: DelayLine,
}

impl StereoDelayLine {
    pub fn new(max_delay_secs: f32, sample_rate: u32) -> Self {
        Self {
            left: DelayLine::new(max_delay_secs, sample_rate),
            right: DelayLine::new(max_delay_secs, sample_rate),
        }
    }

    #[inline]
    pub fn process(
        &mut self,
        left: f32,
        right: f32,
        left_delay: f32,
        right_delay: f32,
    ) -> (f32, f32) {
        (
            self.left.process(left, left_delay),
            self.right.process(right, right_delay),
        )
    }

    pub fn reset(&mut self) {
        self.left.reset();
        self.right.reset();
    }
}

// ============================================================================
// LFO (Low Frequency Oscillator)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LfoWaveform {
    Sine,
    Triangle,
    Square,
    Sawtooth,
    SawtoothDown,
}

/// LFO with multiple waveforms
#[derive(Debug, Clone)]
pub struct Lfo {
    phase: f32,
    waveform: LfoWaveform,
}

impl Lfo {
    pub fn new(waveform: LfoWaveform) -> Self {
        Self {
            phase: 0.0,
            waveform,
        }
    }

    pub fn set_waveform(&mut self, waveform: LfoWaveform) {
        self.waveform = waveform;
    }

    /// Get current value and advance phase
    /// Returns value in range [-1, 1]
    #[inline]
    pub fn tick(&mut self, rate_hz: f32, sample_rate: f32) -> f32 {
        let value = self.value();
        self.phase = (self.phase + rate_hz / sample_rate) % 1.0;
        value
    }

    /// Get current value without advancing
    #[inline]
    pub fn value(&self) -> f32 {
        match self.waveform {
            LfoWaveform::Sine => (self.phase * TAU).sin(),
            LfoWaveform::Triangle => {
                if self.phase < 0.25 {
                    self.phase * 4.0
                } else if self.phase < 0.75 {
                    2.0 - self.phase * 4.0
                } else {
                    self.phase * 4.0 - 4.0
                }
            }
            LfoWaveform::Square => {
                if self.phase < 0.5 {
                    1.0
                } else {
                    -1.0
                }
            }
            LfoWaveform::Sawtooth => 2.0 * self.phase - 1.0,
            LfoWaveform::SawtoothDown => 1.0 - 2.0 * self.phase,
        }
    }

    /// Get value in range [0, 1] (unipolar)
    #[inline]
    pub fn value_unipolar(&self) -> f32 {
        (self.value() + 1.0) * 0.5
    }

    pub fn reset(&mut self) {
        self.phase = 0.0;
    }

    pub fn set_phase(&mut self, phase: f32) {
        self.phase = phase % 1.0;
    }
}

impl Default for Lfo {
    fn default() -> Self {
        Self::new(LfoWaveform::Sine)
    }
}

// ============================================================================
// ENVELOPE FOLLOWER
// ============================================================================

/// Envelope follower with separate attack and release times
#[derive(Debug, Clone)]
pub struct EnvelopeFollower {
    envelope: f32,
    attack_coeff: f32,
    release_coeff: f32,
}

impl EnvelopeFollower {
    pub fn new(attack_ms: f32, release_ms: f32, sample_rate: f32) -> Self {
        let mut ef = Self {
            envelope: 0.0,
            attack_coeff: 0.0,
            release_coeff: 0.0,
        };
        ef.set_times(attack_ms, release_ms, sample_rate);
        ef
    }

    pub fn set_times(&mut self, attack_ms: f32, release_ms: f32, sample_rate: f32) {
        // Time constant: coeff = exp(-1 / (time * sample_rate))
        self.attack_coeff = (-1.0 / (attack_ms * 0.001 * sample_rate)).exp();
        self.release_coeff = (-1.0 / (release_ms * 0.001 * sample_rate)).exp();
    }

    /// Process a sample and return envelope value
    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let input_abs = input.abs();
        let coeff = if input_abs > self.envelope {
            self.attack_coeff
        } else {
            self.release_coeff
        };
        self.envelope = coeff * self.envelope + (1.0 - coeff) * input_abs;
        self.envelope
    }

    pub fn reset(&mut self) {
        self.envelope = 0.0;
    }

    pub fn current(&self) -> f32 {
        self.envelope
    }
}

impl Default for EnvelopeFollower {
    fn default() -> Self {
        Self::new(10.0, 100.0, 48000.0)
    }
}

// ============================================================================
// ONE-POLE FILTER (for smoothing)
// ============================================================================

/// Simple one-pole lowpass for parameter smoothing
#[derive(Debug, Clone)]
pub struct OnePoleLowpass {
    value: f32,
    coeff: f32,
}

impl OnePoleLowpass {
    pub fn new(cutoff_hz: f32, sample_rate: f32) -> Self {
        let mut filter = Self {
            value: 0.0,
            coeff: 0.0,
        };
        filter.set_cutoff(cutoff_hz, sample_rate);
        filter
    }

    pub fn set_cutoff(&mut self, cutoff_hz: f32, sample_rate: f32) {
        let w = (PI * cutoff_hz / sample_rate).tan();
        self.coeff = w / (1.0 + w);
    }

    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        self.value += self.coeff * (input - self.value);
        self.value
    }

    pub fn reset(&mut self) {
        self.value = 0.0;
    }

    pub fn set(&mut self, value: f32) {
        self.value = value;
    }
}

impl Default for OnePoleLowpass {
    fn default() -> Self {
        Self::new(10.0, 48000.0)
    }
}

// ============================================================================
// DC BLOCKER
// ============================================================================

/// DC blocking filter
#[derive(Debug, Clone)]
pub struct DcBlocker {
    x1: f32,
    y1: f32,
    coeff: f32,
}

impl DcBlocker {
    pub fn new() -> Self {
        Self {
            x1: 0.0,
            y1: 0.0,
            coeff: 0.995, // ~10Hz at 48kHz
        }
    }

    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let output = input - self.x1 + self.coeff * self.y1;
        self.x1 = input;
        self.y1 = output;
        output
    }

    pub fn reset(&mut self) {
        self.x1 = 0.0;
        self.y1 = 0.0;
    }
}

impl Default for DcBlocker {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Convert dB to linear amplitude
#[inline]
pub fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

/// Convert linear amplitude to dB
#[inline]
pub fn linear_to_db(linear: f32) -> f32 {
    if linear <= 0.0 {
        -100.0
    } else {
        20.0 * linear.log10()
    }
}

/// Soft clipping using tanh
#[inline]
pub fn soft_clip(x: f32) -> f32 {
    x.tanh()
}

/// Hard clipping
#[inline]
pub fn hard_clip(x: f32, threshold: f32) -> f32 {
    x.clamp(-threshold, threshold)
}

/// Crossfade between two signals (0 = a, 1 = b)
#[inline]
pub fn crossfade(a: f32, b: f32, mix: f32) -> f32 {
    a * (1.0 - mix) + b * mix
}

/// Equal-power crossfade
#[inline]
pub fn crossfade_equal_power(a: f32, b: f32, mix: f32) -> f32 {
    let angle = mix * PI * 0.5;
    a * angle.cos() + b * angle.sin()
}

/// Convert MIDI note to frequency
#[inline]
pub fn midi_to_freq(note: f32) -> f32 {
    440.0 * 2.0_f32.powf((note - 69.0) / 12.0)
}

/// Convert frequency to MIDI note
#[inline]
pub fn freq_to_midi(freq: f32) -> f32 {
    69.0 + 12.0 * (freq / 440.0).log2()
}

/// Semitones to frequency ratio
#[inline]
pub fn semitones_to_ratio(semitones: f32) -> f32 {
    2.0_f32.powf(semitones / 12.0)
}

/// Cents to frequency ratio
#[inline]
pub fn cents_to_ratio(cents: f32) -> f32 {
    2.0_f32.powf(cents / 1200.0)
}

/// Convert a musical subdivision string to beats
/// Returns the number of beats for the subdivision
/// e.g., "1/4" = 1 beat, "1/8" = 0.5 beats, "1/4 dot" = 1.5 beats
pub fn subdivision_to_beats(subdivision: &str) -> f32 {
    let s = subdivision.to_lowercase();
    let dotted = s.contains("dot");
    let triplet = s.contains("triplet") || s.contains("trip");

    // Base beat values (assuming 1/4 = 1 beat)
    let base = if s.contains("1/1") || s.contains("whole") {
        4.0
    } else if s.contains("1/2") || s.contains("half") {
        2.0
    } else if s.contains("1/4") || s.contains("quarter") {
        1.0
    } else if s.contains("1/8") || s.contains("eighth") {
        0.5
    } else if s.contains("1/16") || s.contains("sixteenth") {
        0.25
    } else if s.contains("1/32") {
        0.125
    } else {
        1.0 // Default to quarter note
    };

    // Apply dotted/triplet modifiers
    if dotted {
        base * 1.5
    } else if triplet {
        base * 2.0 / 3.0
    } else {
        base
    }
}

/// Convert BPM and subdivision to time in seconds
pub fn bpm_subdivision_to_secs(bpm: f32, subdivision: &str) -> f32 {
    if bpm <= 0.0 {
        return 0.5; // Default fallback
    }
    let beats = subdivision_to_beats(subdivision);
    let secs_per_beat = 60.0 / bpm;
    beats * secs_per_beat
}

/// Convert BPM and subdivision to rate in Hz (for LFOs)
pub fn bpm_subdivision_to_hz(bpm: f32, subdivision: &str) -> f32 {
    let secs = bpm_subdivision_to_secs(bpm, subdivision);
    if secs <= 0.0 {
        1.0
    } else {
        1.0 / secs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_biquad_lowpass() {
        let mut filter = Biquad::new();
        filter.configure(BiquadType::Lowpass, 1000.0, 0.707, 0.0, 48000.0);

        // Process some samples - should not explode
        for _ in 0..1000 {
            filter.process(0.5);
        }
    }

    #[test]
    fn test_delay_line() {
        let mut delay = DelayLine::new(1.0, 48000);

        // Write a sample
        delay.write(1.0);

        // Should read it back after appropriate delay
        let output = delay.read(0);
        assert!((output - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_lfo() {
        let mut lfo = Lfo::new(LfoWaveform::Sine);

        // Run for one cycle
        for _ in 0..48000 {
            let val = lfo.tick(1.0, 48000.0);
            assert!((-1.0..=1.0).contains(&val));
        }
    }

    #[test]
    fn test_db_conversion() {
        assert!((db_to_linear(0.0) - 1.0).abs() < 0.001);
        assert!((db_to_linear(-6.0) - 0.5).abs() < 0.01);
        assert!((linear_to_db(1.0) - 0.0).abs() < 0.001);
    }
}
