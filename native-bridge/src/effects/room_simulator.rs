//! Room Simulator - early reflections + late reverb

use super::dsp::{Biquad, BiquadType, DelayLine, Lfo, LfoWaveform};
use super::types::{RoomSimulatorSettings, RoomSize};
use super::AudioEffect;

// Early reflection delays (ms) for different room sizes
const EARLY_DELAYS_SMALL: [f32; 6] = [5.0, 8.0, 12.0, 18.0, 25.0, 32.0];
const EARLY_DELAYS_MEDIUM: [f32; 6] = [8.0, 15.0, 23.0, 35.0, 48.0, 62.0];
const EARLY_DELAYS_LARGE: [f32; 6] = [12.0, 25.0, 40.0, 58.0, 80.0, 105.0];
const EARLY_DELAYS_HALL: [f32; 6] = [18.0, 38.0, 62.0, 90.0, 125.0, 165.0];

pub struct RoomSimulator {
    settings: RoomSimulatorSettings,
    // Early reflection delays
    early_delays: Vec<DelayLine>,
    early_gains: Vec<f32>,
    // Cached early delay times in samples (avoids per-frame match lookup)
    cached_early_delay_samples: Vec<f32>,
    // Late reverb (simplified Freeverb)
    late_delays: Vec<DelayLine>,
    late_feedback: Vec<f32>,
    // Filters
    lp_filter: Biquad,
    diffusion_allpass: Vec<Biquad>,
    // Modulation
    lfo: Lfo,
    // Pre-delay
    predelay: DelayLine,
    sample_rate: f32,
}

impl RoomSimulator {
    const MAX_DELAY_MS: f32 = 500.0;
    const NUM_EARLY: usize = 6;
    const NUM_LATE: usize = 4;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;

        let mut early_delays = Vec::with_capacity(Self::NUM_EARLY);
        let mut early_gains = Vec::with_capacity(Self::NUM_EARLY);

        for i in 0..Self::NUM_EARLY {
            early_delays.push(DelayLine::new(Self::MAX_DELAY_MS / 1000.0, sample_rate));
            // Decreasing gain for later reflections
            early_gains.push(1.0 - i as f32 * 0.12);
        }

        let mut late_delays = Vec::with_capacity(Self::NUM_LATE);
        let mut late_feedback = Vec::with_capacity(Self::NUM_LATE);

        // Prime number delays for late reverb
        let late_times = [37.0, 47.0, 61.0, 79.0];
        for i in 0..Self::NUM_LATE {
            late_delays.push(DelayLine::new(late_times[i] * 3.0 / 1000.0, sample_rate));
            late_feedback.push(0.7);
        }

        let mut diffusion_allpass = Vec::with_capacity(4);
        for _ in 0..4 {
            diffusion_allpass.push(Biquad::new());
        }

        // Initialize cached delay samples with default (Small) room size
        let cached_early_delay_samples: Vec<f32> = EARLY_DELAYS_SMALL
            .iter()
            .map(|d| d * 0.001 * sr)
            .collect();

        Self {
            settings: RoomSimulatorSettings::default(),
            early_delays,
            early_gains,
            cached_early_delay_samples,
            late_delays,
            late_feedback,
            lp_filter: Biquad::new(),
            diffusion_allpass,
            lfo: Lfo::new(LfoWaveform::Sine),
            predelay: DelayLine::new(0.1, sample_rate),
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: RoomSimulatorSettings) {
        // Update early reflection times based on room size
        let delays = match settings.size {
            RoomSize::Small => &EARLY_DELAYS_SMALL,
            RoomSize::Medium => &EARLY_DELAYS_MEDIUM,
            RoomSize::Large => &EARLY_DELAYS_LARGE,
            RoomSize::Hall => &EARLY_DELAYS_HALL,
        };

        // Cache the delay times in samples for O(1) lookup during processing
        self.cached_early_delay_samples = delays
            .iter()
            .map(|d| d * 0.001 * self.sample_rate)
            .collect();

        for (i, gain) in self.early_gains.iter_mut().enumerate() {
            *gain = (1.0 - i as f32 * 0.12) * (1.0 - settings.damping / 100.0 * 0.5);
        }

        // Update late reverb feedback based on decay
        let feedback = 0.5 + settings.decay * 0.1;
        for fb in &mut self.late_feedback {
            *fb = feedback.clamp(0.0, 0.95);
        }

        // Damping filter
        let damp_freq = 20000.0 - settings.damping * 150.0;
        self.lp_filter.configure(
            BiquadType::Lowpass,
            damp_freq,
            0.707,
            0.0,
            self.sample_rate,
        );

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        *self = Self::new(rate);
    }

    fn get_early_delay_samples(&self, index: usize) -> f32 {
        // O(1) lookup from cached values (updated in update_settings)
        self.cached_early_delay_samples[index]
    }
}

impl AudioEffect for RoomSimulator {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let predelay_samples = self.settings.pre_delay * 0.001 * self.sample_rate;
        let early_level = self.settings.early_level / 100.0;
        let late_level = self.settings.late_level / 100.0;
        let mix = self.settings.mix / 100.0;
        let mod_amount = self.settings.modulation / 100.0;

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };
            let mono = (dry_l + dry_r) * 0.5;

            // Pre-delay
            self.predelay.write(mono);
            let predelayed = self.predelay.read_interpolated(predelay_samples);

            // Early reflections
            let mut early_out = 0.0;
            for i in 0..Self::NUM_EARLY {
                let delay_samples = self.get_early_delay_samples(i);
                self.early_delays[i].write(predelayed);
                early_out += self.early_delays[i].read_interpolated(delay_samples) * self.early_gains[i];
            }
            early_out /= Self::NUM_EARLY as f32;

            // Modulation for late reverb
            let mod_val = self.lfo.tick(0.3, self.sample_rate) * mod_amount * 2.0;

            // Late reverb (simple feedback delay network)
            let mut late_out = early_out * 0.5;
            for i in 0..Self::NUM_LATE {
                let base_delay = (37.0 + i as f32 * 12.0) * 0.001 * self.sample_rate;
                let modulated_delay = base_delay + mod_val * self.sample_rate * 0.001;

                let delayed = self.late_delays[i].read_interpolated(modulated_delay);
                let filtered = self.lp_filter.process(delayed);
                self.late_delays[i].write(late_out + filtered * self.late_feedback[i]);
                late_out += delayed;
            }
            late_out /= Self::NUM_LATE as f32;

            // Combine
            let wet_l = early_out * early_level + late_out * late_level;
            let wet_r = wet_l; // Mono for simplicity

            frame[0] = dry_l * (1.0 - mix) + wet_l * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + wet_r * mix;
            }
        }
    }

    fn reset(&mut self) {
        for delay in &mut self.early_delays {
            delay.reset();
        }
        for delay in &mut self.late_delays {
            delay.reset();
        }
        self.predelay.reset();
        self.lp_filter.reset();
        self.lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
