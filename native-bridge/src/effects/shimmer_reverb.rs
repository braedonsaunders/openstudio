//! Shimmer Reverb - reverb with pitch-shifted feedback

use super::dsp::{Biquad, BiquadType, DelayLine, Lfo, LfoWaveform};
use super::types::ShimmerReverbSettings;
use super::AudioEffect;

// Pitch shifting is approximated with modulated delays
// True shimmer would use FFT-based pitch shifting

pub struct ShimmerReverb {
    settings: ShimmerReverbSettings,
    // Main reverb delays
    reverb_delays: Vec<DelayLine>,
    reverb_feedback: Vec<f32>,
    // Shimmer delays (pitch-shifted feedback path)
    shimmer_delays: Vec<DelayLine>,
    shimmer_lfos: Vec<Lfo>,
    // Filters
    damping_filter: Biquad,
    tone_filter: Biquad,
    // Pre-delay
    predelay: DelayLine,
    // Modulation
    mod_lfo: Lfo,
    sample_rate: f32,
}

impl ShimmerReverb {
    const NUM_DELAYS: usize = 6;

    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate as f32;

        // Prime number delay times for dense reverb
        let delay_times = [29.0, 37.0, 43.0, 53.0, 67.0, 79.0];

        let mut reverb_delays = Vec::with_capacity(Self::NUM_DELAYS);
        let mut reverb_feedback = Vec::with_capacity(Self::NUM_DELAYS);
        let mut shimmer_delays = Vec::with_capacity(Self::NUM_DELAYS);
        let mut shimmer_lfos = Vec::with_capacity(Self::NUM_DELAYS);

        for (i, delay_ms) in delay_times.iter().enumerate().take(Self::NUM_DELAYS) {
            reverb_delays.push(DelayLine::new(*delay_ms * 4.0 / 1000.0, sample_rate));
            reverb_feedback.push(0.7);
            shimmer_delays.push(DelayLine::new(0.1, sample_rate));

            let mut lfo = Lfo::new(LfoWaveform::Sawtooth);
            // Different rates for each voice
            lfo.set_phase(i as f32 / Self::NUM_DELAYS as f32);
            shimmer_lfos.push(lfo);
        }

        Self {
            settings: ShimmerReverbSettings::default(),
            reverb_delays,
            reverb_feedback,
            shimmer_delays,
            shimmer_lfos,
            damping_filter: Biquad::new(),
            tone_filter: Biquad::new(),
            predelay: DelayLine::new(0.1, sample_rate),
            mod_lfo: Lfo::new(LfoWaveform::Sine),
            sample_rate: sr,
        }
    }

    pub fn update_settings(&mut self, settings: ShimmerReverbSettings) {
        // Update reverb feedback based on decay
        let feedback = 0.4 + settings.decay * 0.055; // 0.4 to 0.95
        for fb in &mut self.reverb_feedback {
            *fb = feedback.clamp(0.0, 0.95);
        }

        // Damping filter
        let damp_freq = 20000.0 - settings.damping * 180.0;
        self.damping_filter
            .configure(BiquadType::Lowpass, damp_freq, 0.707, 0.0, self.sample_rate);

        // Tone filter
        let tone_freq = 500.0 + settings.tone * 150.0;
        self.tone_filter.configure(
            BiquadType::HighShelf,
            tone_freq,
            0.707,
            (settings.tone - 50.0) * 0.12,
            self.sample_rate,
        );

        self.settings = settings;
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        *self = Self::new(rate);
    }

    /// Calculate pitch shift ratio from semitones
    fn pitch_ratio(&self) -> f32 {
        2.0_f32.powf(self.settings.pitch as f32 / 12.0)
    }
}

impl AudioEffect for ShimmerReverb {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let predelay_samples = self.settings.pre_delay * 0.001 * self.sample_rate;
        let shimmer_amount = self.settings.shimmer / 100.0;
        let mix = self.settings.mix / 100.0;
        let mod_amount = self.settings.modulation / 100.0;
        let pitch_ratio = self.pitch_ratio();

        // Pitch shift rate (for sawtooth modulation)
        // This creates a continuous pitch shift effect
        let shift_rate = if pitch_ratio > 1.0 {
            (pitch_ratio - 1.0) * 5.0 // Shift up rate
        } else {
            (1.0 - pitch_ratio) * 5.0 // Shift down rate
        };

        for frame in samples.chunks_mut(2) {
            let dry_l = frame[0];
            let dry_r = if frame.len() > 1 { frame[1] } else { frame[0] };
            let mono = (dry_l + dry_r) * 0.5;

            // Pre-delay
            self.predelay.write(mono);
            let predelayed = self.predelay.read_interpolated(predelay_samples);

            // Modulation
            let mod_val = self.mod_lfo.tick(0.5, self.sample_rate) * mod_amount * 3.0;

            let mut reverb_out = 0.0;
            let mut shimmer_out = 0.0;

            for i in 0..Self::NUM_DELAYS {
                let base_delay = (29.0 + i as f32 * 8.0) * 0.001 * self.sample_rate;
                let modulated_delay = base_delay + mod_val * self.sample_rate * 0.001;

                // Main reverb path
                let delayed = self.reverb_delays[i].read_interpolated(modulated_delay);
                let filtered = self.damping_filter.process(delayed);

                // Shimmer path - pitch shift approximation using modulated delay
                // Sawtooth modulation creates perceived pitch shift
                let shimmer_mod = self.shimmer_lfos[i].tick(shift_rate, self.sample_rate);
                let shimmer_delay = 20.0 + (shimmer_mod + 1.0) * 20.0; // 20-60 samples
                self.shimmer_delays[i].write(filtered);
                let shimmer_sig = self.shimmer_delays[i].read_interpolated(shimmer_delay);

                // Mix reverb and shimmer into feedback
                let fb_input = predelayed
                    + filtered * self.reverb_feedback[i] * (1.0 - shimmer_amount * 0.5)
                    + shimmer_sig * self.reverb_feedback[i] * shimmer_amount;

                self.reverb_delays[i].write(fb_input);

                reverb_out += delayed;
                shimmer_out += shimmer_sig;
            }

            reverb_out /= Self::NUM_DELAYS as f32;
            shimmer_out /= Self::NUM_DELAYS as f32;

            // Apply tone
            let wet = self
                .tone_filter
                .process(reverb_out * (1.0 - shimmer_amount * 0.3) + shimmer_out * shimmer_amount);

            frame[0] = dry_l * (1.0 - mix) + wet * mix;
            if frame.len() > 1 {
                frame[1] = dry_r * (1.0 - mix) + wet * mix;
            }
        }
    }

    fn reset(&mut self) {
        for delay in &mut self.reverb_delays {
            delay.reset();
        }
        for delay in &mut self.shimmer_delays {
            delay.reset();
        }
        for lfo in &mut self.shimmer_lfos {
            lfo.reset();
        }
        self.predelay.reset();
        self.damping_filter.reset();
        self.tone_filter.reset();
        self.mod_lfo.reset();
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
