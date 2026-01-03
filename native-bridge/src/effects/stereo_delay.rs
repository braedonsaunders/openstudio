//! Stereo Delay - independent left/right delay with cross-feedback

use super::dsp::{bpm_subdivision_to_secs, Biquad, BiquadType, DelayLine};
use super::types::StereoDelaySettings;
use super::AudioEffect;

pub struct StereoDelay {
    settings: StereoDelaySettings,
    delay_left: DelayLine,
    delay_right: DelayLine,
    // Tone filters
    lp_filter_l: Biquad,
    lp_filter_r: Biquad,
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    sample_rate: f32,
    // BPM for tempo sync
    bpm: f32,
}

impl StereoDelay {
    const MAX_DELAY_MS: f32 = 2000.0;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        Self {
            settings: StereoDelaySettings::default(),
            delay_left: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            delay_right: DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate),
            lp_filter_l: Biquad::new(),
            lp_filter_r: Biquad::new(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            sample_rate: sr,
            bpm: 120.0,
        }
    }

    /// Set BPM for tempo-synced delay
    pub fn set_bpm(&mut self, bpm: f32) {
        self.bpm = bpm.max(20.0);
    }

    pub fn update_settings(&mut self, settings: StereoDelaySettings) {
        // Update filters
        self.lp_filter_l.configure(
            BiquadType::Lowpass,
            settings.high_cut,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.lp_filter_r.configure(
            BiquadType::Lowpass,
            settings.high_cut,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.hp_filter_l.configure(
            BiquadType::Highpass,
            settings.low_cut,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.hp_filter_r.configure(
            BiquadType::Highpass,
            settings.low_cut,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.delay_left = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
        self.delay_right = DelayLine::new(Self::MAX_DELAY_MS / 1000.0, rate);
    }
}

impl AudioEffect for StereoDelay {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        // Calculate delay times - use tempo sync if enabled
        let (left_time_secs, right_time_secs) = if self.settings.tempo_sync {
            (
                bpm_subdivision_to_secs(self.bpm, &self.settings.left_subdivision),
                bpm_subdivision_to_secs(self.bpm, &self.settings.right_subdivision),
            )
        } else {
            (
                self.settings.left_time * 0.001,
                self.settings.right_time * 0.001,
            )
        };
        let left_delay_samples = left_time_secs * self.sample_rate;
        let right_delay_samples = right_time_secs * self.sample_rate;
        let left_feedback = self.settings.left_feedback / 100.0;
        let right_feedback = self.settings.right_feedback / 100.0;
        let cross_feedback = self.settings.cross_feedback / 100.0;
        let mix = self.settings.mix / 100.0;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Read delayed samples
            let delayed_l = self.delay_left.read_interpolated(left_delay_samples);
            let delayed_r = self.delay_right.read_interpolated(right_delay_samples);

            // Apply filters
            let filtered_l = self.lp_filter_l.process(self.hp_filter_l.process(delayed_l));
            let filtered_r = self.lp_filter_r.process(self.hp_filter_r.process(delayed_r));

            // Write with feedback (including cross-feedback)
            let fb_l = filtered_l * left_feedback + filtered_r * cross_feedback;
            let fb_r = filtered_r * right_feedback + filtered_l * cross_feedback;

            self.delay_left.write(dry_l + fb_l.clamp(-1.0, 1.0));
            self.delay_right.write(dry_r + fb_r.clamp(-1.0, 1.0));

            // Mix
            frame[0] = dry_l * (1.0 - mix) + filtered_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + filtered_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        self.delay_left.reset();
        self.delay_right.reset();
        self.lp_filter_l.reset();
        self.lp_filter_r.reset();
        self.hp_filter_l.reset();
        self.hp_filter_r.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
