//! OpenStudio Native Audio Bridge
//!
//! Provides ultra-low-latency audio I/O via ASIO (Windows) / CoreAudio (macOS)
//! with P2P/relay networking using the OpenStudio Protocol (OSP).
//!
//! Communicates with browser via WebSocket on localhost:9999

mod audio;
mod effects;
mod mixing;
mod network;
mod protocol;

use anyhow::Result;
use network::{NetworkManager, NetworkConfig, NetworkMode, RoomConfig};
use protocol::LaunchParams;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, Level};

/// Application state shared across all components
pub struct AppState {
    pub audio_engine: audio::AudioEngine,
    pub mixer: mixing::Mixer,
    pub network: Option<Arc<NetworkManager>>,
    pub connected_room: Option<String>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_target(false)
        .compact()
        .init();

    info!("OpenStudio Bridge v{}", env!("CARGO_PKG_VERSION"));

    // Parse launch params (from custom protocol or CLI)
    let params = LaunchParams::from_args();

    if let Some(ref room) = params.room_id {
        info!("Auto-connecting to room: {}", room);
    }

    // Initialize audio engine
    let audio_engine = audio::AudioEngine::new()?;

    // Initialize mixer
    let mixer = mixing::Mixer::new();

    // Initialize network manager
    let network_config = NetworkConfig::default();
    let network = match NetworkManager::new(network_config) {
        Ok(nm) => {
            info!("Network manager initialized");
            Some(Arc::new(nm))
        }
        Err(e) => {
            info!("Network manager failed to initialize: {} (P2P disabled)", e);
            None
        }
    };

    // Create shared state
    let state = Arc::new(Mutex::new(AppState {
        audio_engine,
        mixer,
        network,
        connected_room: params.room_id.clone(),
        user_id: params.user_id.clone(),
        user_name: params.user_name.clone(),
    }));

    // Run WebSocket server (blocks)
    info!("Bridge running on ws://localhost:9999");
    info!("Press Ctrl+C to quit");

    protocol::run_server("127.0.0.1:9999", state).await?;

    Ok(())
}

/// Register custom protocol handler (openstudio://)
#[allow(dead_code)]
pub fn register_protocol_handler() -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey(r"Software\Classes\openstudio")?;
        key.set_value("", &"URL:OpenStudio Protocol")?;
        key.set_value("URL Protocol", &"")?;

        let (cmd_key, _) = hkcu.create_subkey(r"Software\Classes\openstudio\shell\open\command")?;
        let exe_path = std::env::current_exe()?;
        cmd_key.set_value("", &format!("\"{}\" \"%1\"", exe_path.display()))?;

        info!("Registered openstudio:// protocol handler");
    }

    #[cfg(not(target_os = "windows"))]
    {
        info!("Protocol handler registration not implemented for this platform");
    }

    Ok(())
}
