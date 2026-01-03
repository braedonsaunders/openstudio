//! Pitch detection and shifting utilities
//!
//! Uses autocorrelation for pitch detection and PSOLA-style resampling for shifting.

use std::f32::consts::PI;

/// Musical scale intervals (semitones from root)
#[derive(Debug, Clone, Copy)]
pub enum Scale {
    Chromatic,    // All 12 notes
    Major,        // [0, 2, 4, 5, 7, 9, 11]
    Minor,        // [0, 2, 3, 5, 7, 8, 10]
    PentatonicMajor, // [0, 2, 4, 7, 9]
    PentatonicMinor, // [0, 3, 5, 7, 10]
    Blues,        // [0, 3, 5, 6, 7, 10]
    Dorian,       // [0, 2, 3, 5, 7, 9, 10]
    Mixolydian,   // [0, 2, 4, 5, 7, 9, 10]
    HarmonicMinor, // [0, 2, 3, 5, 7, 8, 11]
}

impl Scale {
    /// Get the semitone intervals for this scale
    pub fn intervals(&self) -> &'static [i32] {
        match self {
            Scale::Chromatic => &[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            Scale::Major => &[0, 2, 4, 5, 7, 9, 11],
            Scale::Minor => &[0, 2, 3, 5, 7, 8, 10],
            Scale::PentatonicMajor => &[0, 2, 4, 7, 9],
            Scale::PentatonicMinor => &[0, 3, 5, 7, 10],
            Scale::Blues => &[0, 3, 5, 6, 7, 10],
            Scale::Dorian => &[0, 2, 3, 5, 7, 9, 10],
            Scale::Mixolydian => &[0, 2, 4, 5, 7, 9, 10],
            Scale::HarmonicMinor => &[0, 2, 3, 5, 7, 8, 11],
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "major" => Scale::Major,
            "minor" => Scale::Minor,
            "pentatonicmajor" | "pentatonic_major" => Scale::PentatonicMajor,
            "pentatonicminor" | "pentatonic_minor" => Scale::PentatonicMinor,
            "blues" => Scale::Blues,
            "dorian" => Scale::Dorian,
            "mixolydian" => Scale::Mixolydian,
            "harmonicminor" | "harmonic_minor" => Scale::HarmonicMinor,
            _ => Scale::Chromatic,
        }
    }
}

/// Convert key name to MIDI note offset (C = 0)
pub fn key_to_offset(key: &str) -> i32 {
    match key.to_uppercase().as_str() {
        "C" => 0,
        "C#" | "DB" => 1,
        "D" => 2,
        "D#" | "EB" => 3,
        "E" => 4,
        "F" => 5,
        "F#" | "GB" => 6,
        "G" => 7,
        "G#" | "AB" => 8,
        "A" => 9,
        "A#" | "BB" => 10,
        "B" => 11,
        _ => 0,
    }
}

/// Pitch detector using autocorrelation (YIN-inspired)
pub struct PitchDetector {
    sample_rate: u32,
    buffer: Vec<f32>,
    buffer_pos: usize,
    window_size: usize,
    min_freq: f32,
    max_freq: f32,
    threshold: f32,
    last_pitch: f32,
    confidence: f32,
}

impl PitchDetector {
    pub fn new(sample_rate: u32) -> Self {
        let window_size = 2048; // ~42ms at 48kHz
        Self {
            sample_rate,
            buffer: vec![0.0; window_size],
            buffer_pos: 0,
            window_size,
            min_freq: 60.0,  // ~B1
            max_freq: 1000.0, // ~B5
            threshold: 0.15,
            last_pitch: 0.0,
            confidence: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        // Adjust window size for sample rate
        self.window_size = (rate as usize * 2048) / 48000;
        self.buffer.resize(self.window_size, 0.0);
    }

    /// Add a sample to the detector
    pub fn push_sample(&mut self, sample: f32) {
        self.buffer[self.buffer_pos] = sample;
        self.buffer_pos = (self.buffer_pos + 1) % self.window_size;
    }

    /// Detect pitch using autocorrelation
    pub fn detect(&mut self) -> (f32, f32) {
        let sr = self.sample_rate as f32;
        let min_period = (sr / self.max_freq) as usize;
        let max_period = (sr / self.min_freq) as usize;

        // YIN-style difference function
        let mut diff = vec![0.0f32; max_period];

        for tau in 1..max_period.min(self.window_size / 2) {
            let mut sum = 0.0;
            for i in 0..self.window_size - tau {
                let d = self.buffer[i] - self.buffer[i + tau];
                sum += d * d;
            }
            diff[tau] = sum;
        }

        // Cumulative mean normalized difference
        let mut cmnd = vec![1.0f32; max_period];
        let mut running_sum = 0.0;
        for tau in 1..max_period.min(self.window_size / 2) {
            running_sum += diff[tau];
            if running_sum > 0.0 {
                cmnd[tau] = diff[tau] * tau as f32 / running_sum;
            }
        }

        // Find first minimum below threshold
        let mut best_tau = 0;
        let mut best_val = 1.0f32;

        for tau in min_period..max_period.min(cmnd.len()) {
            if cmnd[tau] < self.threshold {
                // Find local minimum
                while tau + 1 < cmnd.len() && cmnd[tau + 1] < cmnd[tau] {
                    // Skip to next
                }
                if cmnd[tau] < best_val {
                    best_val = cmnd[tau];
                    best_tau = tau;
                }
                break;
            }
        }

        if best_tau > 0 {
            // Parabolic interpolation for sub-sample accuracy
            let tau = best_tau;
            if tau > 0 && tau + 1 < cmnd.len() {
                let s0 = cmnd[tau - 1];
                let s1 = cmnd[tau];
                let s2 = cmnd[tau + 1];
                let adjustment = (s0 - s2) / (2.0 * (s0 - 2.0 * s1 + s2));
                let refined_tau = tau as f32 + adjustment;
                self.last_pitch = sr / refined_tau;
            } else {
                self.last_pitch = sr / best_tau as f32;
            }
            self.confidence = 1.0 - best_val;
        } else {
            self.confidence = 0.0;
        }

        (self.last_pitch, self.confidence)
    }

    pub fn last_pitch(&self) -> f32 {
        self.last_pitch
    }

    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.buffer_pos = 0;
        self.last_pitch = 0.0;
        self.confidence = 0.0;
    }
}

/// Simple pitch shifter using granular synthesis
pub struct PitchShifter {
    sample_rate: u32,
    buffer: Vec<f32>,
    write_pos: usize,
    read_pos: f32,
    grain_size: usize,
    overlap: usize,
    ratio: f32, // 1.0 = no shift, 2.0 = octave up, 0.5 = octave down
    window: Vec<f32>,
    output_buffer: Vec<f32>,
    output_pos: usize,
}

impl PitchShifter {
    pub fn new(sample_rate: u32) -> Self {
        let grain_size = (sample_rate as usize * 50) / 1000; // 50ms grains
        let overlap = grain_size / 4;

        // Hann window for smooth grains
        let mut window = vec![0.0; grain_size];
        for i in 0..grain_size {
            window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / grain_size as f32).cos());
        }

        Self {
            sample_rate,
            buffer: vec![0.0; grain_size * 4],
            write_pos: 0,
            read_pos: 0.0,
            grain_size,
            overlap,
            ratio: 1.0,
            window,
            output_buffer: vec![0.0; grain_size * 2],
            output_pos: 0,
        }
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate;
        let grain_size = (rate as usize * 50) / 1000;
        self.grain_size = grain_size;
        self.overlap = grain_size / 4;
        self.buffer.resize(grain_size * 4, 0.0);
        self.window.resize(grain_size, 0.0);
        for i in 0..grain_size {
            self.window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / grain_size as f32).cos());
        }
        self.output_buffer.resize(grain_size * 2, 0.0);
    }

    /// Set pitch ratio (1.0 = no change, 2.0 = octave up)
    pub fn set_ratio(&mut self, ratio: f32) {
        self.ratio = ratio.clamp(0.5, 2.0);
    }

    /// Set shift in semitones
    pub fn set_semitones(&mut self, semitones: f32) {
        self.ratio = 2.0f32.powf(semitones / 12.0);
    }

    /// Process a single sample
    pub fn process(&mut self, input: f32) -> f32 {
        // Write to circular buffer
        self.buffer[self.write_pos] = input;
        self.write_pos = (self.write_pos + 1) % self.buffer.len();

        // Read at shifted rate
        let read_idx = self.read_pos as usize % self.buffer.len();
        let frac = self.read_pos - self.read_pos.floor();
        let next_idx = (read_idx + 1) % self.buffer.len();

        // Linear interpolation
        let output = self.buffer[read_idx] * (1.0 - frac) + self.buffer[next_idx] * frac;

        // Advance read position at shifted rate
        self.read_pos += self.ratio;
        if self.read_pos >= self.buffer.len() as f32 {
            self.read_pos -= self.buffer.len() as f32;
        }

        output
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
        self.read_pos = 0.0;
        self.output_buffer.fill(0.0);
        self.output_pos = 0;
    }
}

/// Get the closest note in a scale to the given frequency
pub fn snap_to_scale(freq: f32, key_offset: i32, scale: &Scale) -> f32 {
    if freq <= 0.0 {
        return 0.0;
    }

    // Convert frequency to MIDI note number
    let midi_note = 12.0 * (freq / 440.0).log2() + 69.0;

    // Get note within octave (0-11), relative to key
    let note_in_octave = ((midi_note.round() as i32 - key_offset) % 12 + 12) % 12;
    let octave = (midi_note.round() as i32 - key_offset) / 12;

    // Find closest scale degree
    let intervals = scale.intervals();
    let mut closest_interval = intervals[0];
    let mut min_distance = 12;

    for &interval in intervals {
        let distance = (note_in_octave - interval).abs();
        let distance_wrapped = (12 - distance).min(distance);
        if distance_wrapped < min_distance {
            min_distance = distance_wrapped;
            closest_interval = interval;
        }
    }

    // Calculate target MIDI note
    let target_midi = (octave * 12 + closest_interval + key_offset) as f32
        + (midi_note.round() as i32 / 12 - octave) as f32 * 12.0;

    // Handle octave wrapping
    let adjusted_target = if (target_midi - midi_note).abs() > 6.0 {
        if target_midi > midi_note {
            target_midi - 12.0
        } else {
            target_midi + 12.0
        }
    } else {
        target_midi
    };

    // Convert back to frequency
    440.0 * 2.0f32.powf((adjusted_target - 69.0) / 12.0)
}

/// Get harmony intervals for a chord type, using the scale to determine
/// musically correct intervals. Falls back to chromatic intervals if scale
/// doesn't have enough degrees.
pub fn get_harmony_intervals(harmony_type: &str, scale: &Scale) -> Vec<i32> {
    let intervals = scale.intervals();

    // Helper to get nth scale degree (0-indexed), with fallback
    let get_degree = |degree: usize, fallback: i32| -> i32 {
        intervals.get(degree).copied().unwrap_or(fallback)
    };

    match harmony_type.to_lowercase().as_str() {
        "third" => {
            // 3rd scale degree (index 2)
            vec![get_degree(2, 4)]
        }
        "fifth" => {
            // 5th scale degree (index 4)
            vec![get_degree(4, 7)]
        }
        "octave" => vec![12], // Octave is always 12 semitones
        "powerchord" => {
            // Root + 5th + octave
            let fifth = get_degree(4, 7);
            vec![fifth, 12]
        }
        "majorchord" => {
            // Major third + perfect fifth (force major regardless of scale)
            vec![4, 7]
        }
        "minorchord" => {
            // Minor third + perfect fifth (force minor regardless of scale)
            vec![3, 7]
        }
        "scalechord" => {
            // 3rd and 5th from the scale (will be major/minor depending on scale)
            let third = get_degree(2, 4);
            let fifth = get_degree(4, 7);
            vec![third, fifth]
        }
        "custom" => vec![], // Custom intervals set separately
        _ => {
            // Default to scale-aware third
            vec![get_degree(2, 4)]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_to_offset() {
        assert_eq!(key_to_offset("C"), 0);
        assert_eq!(key_to_offset("G"), 7);
        assert_eq!(key_to_offset("F#"), 6);
    }

    #[test]
    fn test_snap_to_scale() {
        // C major scale: C, D, E, F, G, A, B
        let scale = Scale::Major;
        let key = key_to_offset("C");

        // 440 Hz = A4, should stay at A
        let a4 = 440.0;
        let snapped = snap_to_scale(a4, key, &scale);
        assert!((snapped - a4).abs() < 1.0);
    }
}
