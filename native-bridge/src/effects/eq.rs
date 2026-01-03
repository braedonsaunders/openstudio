//! Parametric EQ - multi-band equalizer with various filter types

use super::dsp::{BiquadType, StereoBiquad};
use super::types::{EqBandType, EqSettings};
use super::AudioEffect;

const MAX_BANDS: usize = 8;

pub struct Eq {
    settings: EqSettings,
    bands: Vec<StereoBiquad>,
    sample_rate: f32,
}

impl Eq {
    pub fn new(sample_rate: u32) -> Self {
        let mut eq = Self {
            settings: EqSettings::default(),
            bands: vec![StereoBiquad::new(); MAX_BANDS],
            sample_rate: sample_rate as f32,
        };
        eq.update_filters();
        eq
    }

    pub fn update_settings(&mut self, settings: EqSettings) {
        self.settings = settings;
        self.update_filters();
    }

    pub fn set_sample_rate(&mut self, rate: u32) {
        self.sample_rate = rate as f32;
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Ensure we have enough bands
        while self.bands.len() < self.settings.bands.len() {
            self.bands.push(StereoBiquad::new());
        }

        // Configure each band
        for (i, band_settings) in self.settings.bands.iter().enumerate() {
            if i >= self.bands.len() {
                break;
            }

            let filter_type = match band_settings.band_type {
                EqBandType::Lowshelf => BiquadType::LowShelf,
                EqBandType::Peak | EqBandType::Peaking => BiquadType::Peak,
                EqBandType::Highshelf => BiquadType::HighShelf,
            };

            self.bands[i].configure(
                filter_type,
                band_settings.frequency,
                band_settings.q,
                band_settings.gain,
                self.sample_rate,
            );
        }
    }
}

impl AudioEffect for Eq {
    fn process(&mut self, samples: &mut [f32], _sample_rate: u32) {
        if !self.settings.enabled {
            return;
        }

        let num_bands = self.settings.bands.len().min(self.bands.len());

        for frame in samples.chunks_mut(2) {
            let mut left = frame[0];
            let mut right = if frame.len() > 1 { frame[1] } else { frame[0] };

            // Process through all bands in series
            for i in 0..num_bands {
                let (l, r) = self.bands[i].process(left, right);
                left = l;
                right = r;
            }

            frame[0] = left;
            if frame.len() > 1 {
                frame[1] = right;
            }
        }
    }

    fn reset(&mut self) {
        for band in &mut self.bands {
            band.reset();
        }
    }

    fn is_enabled(&self) -> bool {
        self.settings.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.settings.enabled = enabled;
    }
}
