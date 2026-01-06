//! Reverb - Freeverb-style algorithmic reverb

use super::dsp::{Biquad, BiquadType, DelayLine};
use super::types::{ReverbSettings, ReverbType};
use super::AudioEffect;

// Freeverb comb filter delays (in samples at 44100Hz)
const COMB_DELAYS: [usize; 8] = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
// Freeverb allpass filter delays
const ALLPASS_DELAYS: [usize; 4] = [225, 556, 441, 341];
// Stereo spread
const STEREO_SPREAD: usize = 23;

/// Comb filter for reverb
#[derive(Clone)]
struct CombFilter {
    delay: DelayLine,
    feedback: f32,
    damp1: f32,
    damp2: f32,
    filter_store: f32,
    delay_samples: usize,
}

impl CombFilter {
    fn new(delay_samples: usize, sample_rate: u32) -> Self {
        let max_delay = (delay_samples as f32 * 2.0) / 44100.0;
        Self {
            delay: DelayLine::new(max_delay, sample_rate),
            feedback: 0.5,
            damp1: 0.5,
            damp2: 0.5,
            filter_store: 0.0,
            delay_samples,
        }
    }

    fn set_params(&mut self, feedback: f32, damp: f32) {
        self.feedback = feedback;
        self.damp1 = damp;
        self.damp2 = 1.0 - damp;
    }

    fn process(&mut self, input: f32) -> f32 {
        let output = self.delay.read(self.delay_samples);

        // Low-pass filter in feedback path
        self.filter_store = output * self.damp2 + self.filter_store * self.damp1;

        self.delay.write(input + self.filter_store * self.feedback);

        output
    }

    fn reset(&mut self) {
        self.delay.reset();
        self.filter_store = 0.0;
    }
}

/// Allpass filter for reverb
#[derive(Clone)]
struct AllpassFilter {
    delay: DelayLine,
    feedback: f32,
    delay_samples: usize,
}

impl AllpassFilter {
    fn new(delay_samples: usize, sample_rate: u32) -> Self {
        let max_delay = (delay_samples as f32 * 2.0) / 44100.0;
        Self {
            delay: DelayLine::new(max_delay, sample_rate),
            feedback: 0.5,
            delay_samples,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let delayed = self.delay.read(self.delay_samples);
        let output = -input + delayed;
        self.delay.write(input + delayed * self.feedback);
        output
    }

    fn reset(&mut self) {
        self.delay.reset();
    }
}

pub struct Reverb {
    settings: ReverbSettings,
    // Comb filters (stereo pairs)
    combs_left: Vec<CombFilter>,
    combs_right: Vec<CombFilter>,
    // Allpass filters (stereo pairs)
    allpasses_left: Vec<AllpassFilter>,
    allpasses_right: Vec<AllpassFilter>,
    // Pre-delay
    predelay_left: DelayLine,
    predelay_right: DelayLine,
    // Input filters
    lp_filter_l: Biquad,
    lp_filter_r: Biquad,
    hp_filter_l: Biquad,
    hp_filter_r: Biquad,
    sample_rate: f32,
}

impl Reverb {
    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;
        let scale = sr / 44100.0;

        // Create comb filters with scaled delays
        let combs_left: Vec<CombFilter> = COMB_DELAYS
            .iter()
            .map(|&d| CombFilter::new((d as f32 * scale) as usize, sample_rate))
            .collect();

        let combs_right: Vec<CombFilter> = COMB_DELAYS
            .iter()
            .map(|&d| {
                CombFilter::new(
                    ((d + STEREO_SPREAD) as f32 * scale) as usize,
                    sample_rate,
                )
            })
            .collect();

        // Create allpass filters
        let allpasses_left: Vec<AllpassFilter> = ALLPASS_DELAYS
            .iter()
            .map(|&d| AllpassFilter::new((d as f32 * scale) as usize, sample_rate))
            .collect();

        let allpasses_right: Vec<AllpassFilter> = ALLPASS_DELAYS
            .iter()
            .map(|&d| {
                AllpassFilter::new(
                    ((d + STEREO_SPREAD) as f32 * scale) as usize,
                    sample_rate,
                )
            })
            .collect();

        Self {
            settings: ReverbSettings::default(),
            combs_left,
            combs_right,
            allpasses_left,
            allpasses_right,
            predelay_left: DelayLine::new(0.2, sample_rate),
            predelay_right: DelayLine::new(0.2, sample_rate),
            lp_filter_l: Biquad::new(),
            lp_filter_r: Biquad::new(),
            hp_filter_l: Biquad::new(),
            hp_filter_r: Biquad::new(),
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: ReverbSettings) {
        // Update filter cutoffs
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

        // Update comb filter parameters based on decay
        // Decay is in seconds (0.1-10), normalize to 0-1 range for feedback calculation
        let decay_normalized = (settings.decay.clamp(0.1, 10.0) - 0.1) / 9.9;
        let feedback = (0.28 + decay_normalized * 0.65).min(0.93); // 0.28 to 0.93, capped for stability
        let damp = self.get_damping_for_type(settings.reverb_type);

        for comb in &mut self.combs_left {
            comb.set_params(feedback, damp);
        }
        for comb in &mut self.combs_right {
            comb.set_params(feedback, damp);
        }

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        // Would need to recreate all delay-based components
        *self = Self::new(rate);
    }

    fn get_damping_for_type(&self, reverb_type: ReverbType) -> f32 {
        match reverb_type {
            ReverbType::Room => 0.5,
            ReverbType::Hall => 0.3,
            ReverbType::Plate => 0.2,
            ReverbType::Spring => 0.6,
            ReverbType::Ambient => 0.4,
        }
    }
}

impl AudioEffect for Reverb {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let predelay_samples = (self.settings.pre_delay * 0.001 * self.sample_rate) as usize;
        let mix = self.settings.mix;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Apply input filters
            let filtered_l = self.lp_filter_l.process(self.hp_filter_l.process(dry_l));
            let filtered_r = self.lp_filter_r.process(self.hp_filter_r.process(dry_r));

            // Pre-delay
            self.predelay_left.write(filtered_l);
            self.predelay_right.write(filtered_r);
            let predelayed_l = self.predelay_left.read(predelay_samples);
            let predelayed_r = self.predelay_right.read(predelay_samples);

            // Sum through comb filters (parallel)
            let mut comb_out_l = 0.0;
            let mut comb_out_r = 0.0;

            for comb in &mut self.combs_left {
                comb_out_l += comb.process(predelayed_l);
            }
            for comb in &mut self.combs_right {
                comb_out_r += comb.process(predelayed_r);
            }

            // Normalize
            comb_out_l /= self.combs_left.len() as f32;
            comb_out_r /= self.combs_right.len() as f32;

            // Series allpass filters
            let mut wet_l = comb_out_l;
            let mut wet_r = comb_out_r;

            for allpass in &mut self.allpasses_left {
                wet_l = allpass.process(wet_l);
            }
            for allpass in &mut self.allpasses_right {
                wet_r = allpass.process(wet_r);
            }

            // Mix
            frame[0] = dry_l * (1.0 - mix) + wet_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + wet_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        for comb in &mut self.combs_left {
            comb.reset();
        }
        for comb in &mut self.combs_right {
            comb.reset();
        }
        for allpass in &mut self.allpasses_left {
            allpass.reset();
        }
        for allpass in &mut self.allpasses_right {
            allpass.reset();
        }
        self.predelay_left.reset();
        self.predelay_right.reset();
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
