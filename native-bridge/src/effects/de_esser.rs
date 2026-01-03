//! De-Esser - sibilance reduction using sidechain compression

use super::dsp::{db_to_linear, Biquad, BiquadType, EnvelopeFollower};
use super::types::{DeEsserMode, DeEsserSettings};
use super::AudioEffect;

pub struct DeEsser {
    settings: DeEsserSettings,
    // Detection filters (highpass to isolate sibilance)
    detect_filter_l: Biquad,
    detect_filter_r: Biquad,
    // Split mode - filters to process only sibilant band
    split_filter_l: Biquad,
    split_filter_r: Biquad,
    // Envelope followers for detection
    envelope_l: EnvelopeFollower,
    envelope_r: EnvelopeFollower,
    sample_rate: f32,
    // Metering
    current_reduction: f32,
}

impl DeEsser {
    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        Self {
            settings: DeEsserSettings::default(),
            detect_filter_l: Biquad::new(),
            detect_filter_r: Biquad::new(),
            split_filter_l: Biquad::new(),
            split_filter_r: Biquad::new(),
            envelope_l: EnvelopeFollower::new(0.5, 50.0, sr),
            envelope_r: EnvelopeFollower::new(0.5, 50.0, sr),
            sample_rate: sr,
            current_reduction: 0.0,
        }
    }

    pub fn update_settings(&mut self, settings: DeEsserSettings) {
        // Update detection filter frequency
        self.detect_filter_l.configure(
            BiquadType::Highpass,
            settings.frequency,
            0.707,
            0.0,
            self.sample_rate,
        );
        self.detect_filter_r.configure(
            BiquadType::Highpass,
            settings.frequency,
            0.707,
            0.0,
            self.sample_rate,
        );

        // Split filter - bandpass around sibilance
        self.split_filter_l.configure(
            BiquadType::Bandpass,
            settings.frequency,
            1.0,
            0.0,
            self.sample_rate,
        );
        self.split_filter_r.configure(
            BiquadType::Bandpass,
            settings.frequency,
            1.0,
            0.0,
            self.sample_rate,
        );

        self.envelope_l
            .set_times(settings.attack, settings.release, self.sample_rate);
        self.envelope_r
            .set_times(settings.attack, settings.release, self.sample_rate);

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_settings(self.settings.clone());
    }

    pub fn get_reduction(&self) -> f32 {
        self.current_reduction
    }
}

impl AudioEffect for DeEsser {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let threshold = db_to_linear(self.settings.threshold);
        let max_reduction = db_to_linear(-self.settings.reduction);
        let range = db_to_linear(-self.settings.range);

        self.current_reduction = 0.0;

        for frame in samples.chunks_mut(2) {
            let left = frame[0];
            let right = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Detect sibilance level using highpass filtered signal
            let detect_l = self.detect_filter_l.process(left);
            let detect_r = self.detect_filter_r.process(right);

            let env_l = self.envelope_l.process(detect_l);
            let env_r = self.envelope_r.process(detect_r);

            // Calculate gain reduction
            // - Apply reduction based on how much above threshold
            // - Limit to max_reduction (minimum gain from reduction setting)
            // - Never go below range (absolute floor)
            let calc_gain = |env: f32| -> f32 {
                if env > threshold {
                    let over_db = 20.0 * (env / threshold).log10();
                    let reduction_db = over_db.min(self.settings.reduction);
                    db_to_linear(-reduction_db).max(max_reduction).max(range)
                } else {
                    1.0
                }
            };

            let gain_l = calc_gain(env_l);
            let gain_r = calc_gain(env_r);

            // Track max reduction for metering
            self.current_reduction = self
                .current_reduction
                .max(-20.0 * gain_l.log10())
                .max(-20.0 * gain_r.log10());

            match self.settings.mode {
                DeEsserMode::Wideband => {
                    // Apply gain reduction to entire signal
                    frame[0] = left * gain_l;
                    if frame.len() > 1 {
                        frame[1] = right * gain_r;
                    }
                }
                DeEsserMode::Split => {
                    // Only attenuate the sibilant frequencies
                    let sib_l = self.split_filter_l.process(left);
                    let sib_r = self.split_filter_r.process(right);

                    // Subtract sibilance, add back attenuated version
                    frame[0] = left - sib_l + sib_l * gain_l;
                    if frame.len() > 1 {
                        frame[1] = right - sib_r + sib_r * gain_r;
                    }
                }
            }

            // Listen mode - output only the detected signal
            if self.settings.listen_mode {
                frame[0] = detect_l;
                if frame.len() > 1 {
                    frame[1] = detect_r;
                }
            }
        }
    }

    fn reset(&mut self) {
        self.detect_filter_l.reset();
        self.detect_filter_r.reset();
        self.split_filter_l.reset();
        self.split_filter_r.reset();
        self.envelope_l.reset();
        self.envelope_r.reset();
        self.current_reduction = 0.0;
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
