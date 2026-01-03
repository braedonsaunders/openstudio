//! Delay effect - various delay types with modulation

use super::dsp::{bpm_subdivision_to_secs, Biquad, BiquadType, DelayLine, Lfo, LfoWaveform};
use super::types::{DelaySettings, DelayType};
use super::AudioEffect;

pub struct Delay {
    settings: DelaySettings,
    // Delay lines for left and right
    delay_left: DelayLine,
    delay_right: DelayLine,
    // Modulation LFO
    lfo: Lfo,
    // Tone filter (for analog/tape)
    tone_filter_l: Biquad,
    tone_filter_r: Biquad,
    sample_rate: f32,
    // BPM for tempo sync
    bpm: f32,
}

impl Delay {
    const MAX_DELAY_SECS: f32 = 2.5;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        Self {
            settings: DelaySettings::default(),
            delay_left: DelayLine::new(Self::MAX_DELAY_SECS, sample_rate),
            delay_right: DelayLine::new(Self::MAX_DELAY_SECS, sample_rate),
            lfo: Lfo::new(LfoWaveform::Sine),
            tone_filter_l: Biquad::new(),
            tone_filter_r: Biquad::new(),
            sample_rate: sr,
            bpm: 120.0,
        }
    }

    /// Set BPM for tempo-synced delay
    pub fn set_bpm(&mut self, bpm: f32) {
        self.bpm = bpm.max(20.0); // Minimum 20 BPM
    }

    pub fn update_settings(&mut self, settings: DelaySettings) {
        // Update tone filter based on tone parameter
        // Lower tone = more low-pass filtering (darker)
        let cutoff = 500.0 + settings.tone * 15000.0; // 500 Hz to 15.5 kHz
        self.tone_filter_l
            .configure(BiquadType::Lowpass, cutoff, 0.707, 0.0, self.sample_rate);
        self.tone_filter_r
            .configure(BiquadType::Lowpass, cutoff, 0.707, 0.0, self.sample_rate);
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.delay_left = DelayLine::new(Self::MAX_DELAY_SECS, rate);
        self.delay_right = DelayLine::new(Self::MAX_DELAY_SECS, rate);
    }
}

impl AudioEffect for Delay {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        // Calculate delay time - use tempo sync if enabled
        let delay_time_secs = if self.settings.tempo_sync {
            bpm_subdivision_to_secs(self.bpm, &self.settings.subdivision)
        } else {
            self.settings.time
        };
        let base_delay_samples = delay_time_secs * self.sample_rate;
        let feedback = self.settings.feedback.clamp(0.0, 0.95);
        let mix = self.settings.mix;
        let modulation = self.settings.modulation;

        let is_analog_tape = matches!(
            self.settings.delay_type,
            DelayType::Analog | DelayType::Tape
        );
        let is_pingpong = matches!(self.settings.delay_type, DelayType::Pingpong);
        let spread = self.settings.ping_pong_spread;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // LFO modulation for analog/tape warmth
            let mod_offset = if modulation > 0.0 {
                let lfo_val = self.lfo.tick(0.5, self.sample_rate);
                lfo_val * modulation * 0.002 * self.sample_rate // +/- 2ms
            } else {
                0.0
            };

            let delay_samples = (base_delay_samples + mod_offset).max(1.0);

            match self.settings.delay_type {
                DelayType::Digital => {
                    // Simple digital delay
                    let delayed_l = self.delay_left.read_interpolated(delay_samples);
                    let delayed_r = self.delay_right.read_interpolated(delay_samples);

                    self.delay_left.write(dry_l + delayed_l * feedback);
                    self.delay_right.write(dry_r + delayed_r * feedback);

                    frame[0] = dry_l * (1.0 - mix) + delayed_l * mix;
                    if frame.len() > 1 {
                        frame[1] = dry_r * (1.0 - mix) + delayed_r * mix;
                    }
                }
                DelayType::Analog | DelayType::Tape => {
                    // Filtered feedback for warmth
                    let delayed_l = self.delay_left.read_interpolated(delay_samples);
                    let delayed_r = self.delay_right.read_interpolated(delay_samples);

                    let filtered_l = self.tone_filter_l.process(delayed_l);
                    let filtered_r = self.tone_filter_r.process(delayed_r);

                    self.delay_left.write(dry_l + filtered_l * feedback);
                    self.delay_right.write(dry_r + filtered_r * feedback);

                    frame[0] = dry_l * (1.0 - mix) + filtered_l * mix;
                    if frame.len() > 1 {
                        frame[1] = dry_r * (1.0 - mix) + filtered_r * mix;
                    }
                }
                DelayType::Pingpong => {
                    // Cross-feed between channels
                    let delayed_l = self.delay_left.read_interpolated(delay_samples);
                    let delayed_r = self.delay_right.read_interpolated(delay_samples);

                    // Cross feedback with spread
                    self.delay_left.write(dry_l + delayed_r * feedback * spread);
                    self.delay_right.write(dry_r + delayed_l * feedback * spread);

                    frame[0] = dry_l * (1.0 - mix) + delayed_l * mix;
                    if frame.len() > 1 {
                        frame[1] = dry_r * (1.0 - mix) + delayed_r * mix;
                    }
                }
                DelayType::Reverse => {
                    // Reverse delay would require buffering chunks
                    // For now, approximate with pitch-shifted delay
                    let delayed_l = self.delay_left.read_interpolated(delay_samples);
                    let delayed_r = self.delay_right.read_interpolated(delay_samples);

                    self.delay_left.write(dry_l + delayed_l * feedback);
                    self.delay_right.write(dry_r + delayed_r * feedback);

                    frame[0] = dry_l * (1.0 - mix) + delayed_l * mix;
                    if frame.len() > 1 {
                        frame[1] = dry_r * (1.0 - mix) + delayed_r * mix;
                    }
                }
            }
        }
    }

    fn reset(&mut self) {
        self.delay_left.reset();
        self.delay_right.reset();
        self.lfo.reset();
        self.tone_filter_l.reset();
        self.tone_filter_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
