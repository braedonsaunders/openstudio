//! Audio device enumeration and management

use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DeviceError {
    #[error("No audio devices found")]
    NoDevicesFound,
    #[error("Device not found: {0}")]
    DeviceNotFound(String),
    #[error("Failed to get device config: {0}")]
    ConfigError(String),
    #[error("CPAL error: {0}")]
    CpalError(#[from] cpal::DevicesError),
}

/// Information about an audio device
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub is_input: bool,
    pub is_output: bool,
    pub channels: Vec<ChannelInfo>,
    pub sample_rates: Vec<u32>,
    pub buffer_sizes: Vec<u32>,
    pub is_default: bool,
    pub driver_type: DriverType,
}

/// Information about a single channel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelInfo {
    pub index: u32,
    pub name: String,
}

/// Driver type for the device
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DriverType {
    Asio,
    Wasapi,
    CoreAudio,
    Alsa,
    Jack,
    Unknown,
}

/// Channel configuration for capture
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    /// Number of channels (1 = mono, 2 = stereo)
    #[serde(default = "default_channel_count")]
    pub channel_count: u32,
    /// Left channel index (0-based)
    #[serde(default)]
    pub left_channel: u32,
    /// Right channel index (0-based, only for stereo)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_channel: Option<u32>,
}

fn default_channel_count() -> u32 {
    2
}

impl Default for ChannelConfig {
    fn default() -> Self {
        Self {
            channel_count: 2,
            left_channel: 0,
            right_channel: Some(1),
        }
    }
}

impl ChannelConfig {
    pub fn mono(channel: u32) -> Self {
        Self {
            channel_count: 1,
            left_channel: channel,
            right_channel: None,
        }
    }

    pub fn stereo(left: u32, right: u32) -> Self {
        Self {
            channel_count: 2,
            left_channel: left,
            right_channel: Some(right),
        }
    }
}

/// Wrapper around CPAL device with additional metadata
pub struct AudioDevice {
    pub device: cpal::Device,
    pub info: DeviceInfo,
}

impl AudioDevice {
    /// Enumerate all audio devices
    pub fn enumerate_all() -> Result<Vec<DeviceInfo>, DeviceError> {
        let mut devices = Vec::new();

        // Try ASIO first on Windows (lowest latency)
        #[cfg(target_os = "windows")]
        {
            if let Ok(asio_host) = cpal::host_from_id(cpal::HostId::Asio) {
                for device in asio_host.devices()? {
                    if let Some(info) = Self::get_device_info(&device, DriverType::Asio) {
                        devices.push(info);
                    }
                }
            }
        }

        // Then enumerate default host (WASAPI on Windows, CoreAudio on macOS)
        let host = cpal::default_host();
        let driver_type = Self::detect_driver_type(&host);

        // Get default devices
        let default_input = host.default_input_device().map(|d| d.name().ok()).flatten();
        let default_output = host
            .default_output_device()
            .map(|d| d.name().ok())
            .flatten();

        for device in host.devices()? {
            if let Some(mut info) = Self::get_device_info(&device, driver_type) {
                // Mark defaults
                if let Some(ref name) = default_input {
                    if &info.name == name && info.is_input {
                        info.is_default = true;
                    }
                }
                if let Some(ref name) = default_output {
                    if &info.name == name && info.is_output {
                        info.is_default = true;
                    }
                }
                devices.push(info);
            }
        }

        Ok(devices)
    }

    /// Enumerate input devices only
    pub fn enumerate_inputs() -> Result<Vec<DeviceInfo>, DeviceError> {
        Ok(Self::enumerate_all()?
            .into_iter()
            .filter(|d| d.is_input)
            .collect())
    }

    /// Enumerate output devices only
    pub fn enumerate_outputs() -> Result<Vec<DeviceInfo>, DeviceError> {
        Ok(Self::enumerate_all()?
            .into_iter()
            .filter(|d| d.is_output)
            .collect())
    }

    /// Get device by ID
    pub fn get_by_id(device_id: &str) -> Result<AudioDevice, DeviceError> {
        // Try ASIO first on Windows
        #[cfg(target_os = "windows")]
        {
            if let Ok(asio_host) = cpal::host_from_id(cpal::HostId::Asio) {
                if let Ok(devices) = asio_host.devices() {
                    for device in devices {
                        if let Ok(name) = device.name() {
                            let id = Self::generate_device_id(&name, DriverType::Asio);
                            if id == device_id {
                                if let Some(info) = Self::get_device_info(&device, DriverType::Asio)
                                {
                                    return Ok(AudioDevice { device, info });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check default host
        let host = cpal::default_host();
        let driver_type = Self::detect_driver_type(&host);

        for device in host.devices()? {
            if let Ok(name) = device.name() {
                let id = Self::generate_device_id(&name, driver_type);
                if id == device_id {
                    if let Some(info) = Self::get_device_info(&device, driver_type) {
                        return Ok(AudioDevice { device, info });
                    }
                }
            }
        }

        Err(DeviceError::DeviceNotFound(device_id.to_string()))
    }

    /// Get default input device
    pub fn default_input() -> Result<AudioDevice, DeviceError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(DeviceError::NoDevicesFound)?;
        let driver_type = Self::detect_driver_type(&host);
        let info = Self::get_device_info(&device, driver_type)
            .ok_or(DeviceError::ConfigError("Failed to get device info".into()))?;
        Ok(AudioDevice { device, info })
    }

    /// Get default output device
    pub fn default_output() -> Result<AudioDevice, DeviceError> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or(DeviceError::NoDevicesFound)?;
        let driver_type = Self::detect_driver_type(&host);
        let info = Self::get_device_info(&device, driver_type)
            .ok_or(DeviceError::ConfigError("Failed to get device info".into()))?;
        Ok(AudioDevice { device, info })
    }

    fn get_device_info(device: &cpal::Device, driver_type: DriverType) -> Option<DeviceInfo> {
        let name = device.name().ok()?;
        let id = Self::generate_device_id(&name, driver_type);

        let mut is_input = false;
        let mut is_output = false;
        let mut input_channels = Vec::new();
        let mut output_channels = Vec::new();
        let mut sample_rates = Vec::new();

        // Check input capabilities
        if let Ok(configs) = device.supported_input_configs() {
            for config in configs {
                is_input = true;
                let channels = config.channels() as u32;
                for i in 0..channels {
                    if !input_channels.iter().any(|c: &ChannelInfo| c.index == i) {
                        input_channels.push(ChannelInfo {
                            index: i,
                            name: format!("Input {}", i + 1),
                        });
                    }
                }
                // Collect supported sample rates
                let min = config.min_sample_rate().0;
                let max = config.max_sample_rate().0;
                if min <= 44100 && max >= 44100 && !sample_rates.contains(&44100) {
                    sample_rates.push(44100);
                }
                if min <= 48000 && max >= 48000 && !sample_rates.contains(&48000) {
                    sample_rates.push(48000);
                }
                if min <= 96000 && max >= 96000 && !sample_rates.contains(&96000) {
                    sample_rates.push(96000);
                }
            }
        }

        // Check output capabilities
        if let Ok(configs) = device.supported_output_configs() {
            for config in configs {
                is_output = true;
                let channels = config.channels() as u32;
                for i in 0..channels {
                    if !output_channels.iter().any(|c: &ChannelInfo| c.index == i) {
                        output_channels.push(ChannelInfo {
                            index: i,
                            name: format!("Output {}", i + 1),
                        });
                    }
                }
            }
        }

        // Combine channels (prefer input channels for info)
        let channels = if !input_channels.is_empty() {
            input_channels
        } else {
            output_channels
        };

        // Determine supported buffer sizes based on driver type
        // ASIO typically reports specific sizes, WASAPI/CoreAudio are more flexible
        let buffer_sizes = match driver_type {
            DriverType::Asio => {
                // ASIO drivers typically support specific buffer sizes
                // Common ASIO buffer sizes (driver-dependent, but these are typical)
                vec![32, 64, 128, 256, 512, 1024, 2048]
            }
            DriverType::Wasapi => {
                // WASAPI exclusive mode typically supports powers of 2
                vec![128, 256, 512, 1024, 2048]
            }
            DriverType::CoreAudio => {
                // CoreAudio is very flexible with buffer sizes
                vec![32, 64, 128, 256, 512, 1024, 2048]
            }
            _ => {
                // Default reasonable buffer sizes
                vec![128, 256, 512, 1024]
            }
        };

        Some(DeviceInfo {
            id,
            name,
            is_input,
            is_output,
            channels,
            sample_rates,
            buffer_sizes,
            is_default: false,
            driver_type,
        })
    }

    fn generate_device_id(name: &str, driver_type: DriverType) -> String {
        let prefix = match driver_type {
            DriverType::Asio => "asio",
            DriverType::Wasapi => "wasapi",
            DriverType::CoreAudio => "coreaudio",
            DriverType::Alsa => "alsa",
            DriverType::Jack => "jack",
            DriverType::Unknown => "unknown",
        };
        format!("{}:{}", prefix, name.replace(' ', "_").to_lowercase())
    }

    fn detect_driver_type(host: &cpal::Host) -> DriverType {
        match host.id().name() {
            "ASIO" => DriverType::Asio,
            "WASAPI" => DriverType::Wasapi,
            "CoreAudio" => DriverType::CoreAudio,
            "ALSA" => DriverType::Alsa,
            "JACK" => DriverType::Jack,
            _ => DriverType::Unknown,
        }
    }
}
