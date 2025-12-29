//! Audio stream abstractions

use super::ChannelConfig;

/// Capture stream wrapper
pub struct CaptureStream {
    pub channel_config: ChannelConfig,
    pub sample_rate: u32,
    pub buffer_size: u32,
}

/// Playback stream wrapper
pub struct PlaybackStream {
    pub sample_rate: u32,
    pub buffer_size: u32,
}
