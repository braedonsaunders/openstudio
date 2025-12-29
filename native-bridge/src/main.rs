//! OpenStudio Native Audio Bridge
//!
//! Provides ultra-low-latency audio I/O via ASIO (Windows) / CoreAudio (macOS)
//! Communicates with browser via WebSocket on localhost:9999

mod audio;
mod effects;
mod mixing;
mod protocol;

use anyhow::Result;
use protocol::{BridgeServer, LaunchParams};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

/// Application state shared across all components
pub struct AppState {
    pub audio_engine: Arc<RwLock<audio::AudioEngine>>,
    pub mixer: Arc<RwLock<mixing::Mixer>>,
    pub connected_room: Option<String>,
    pub user_id: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .compact()
        .init();

    info!("🎵 OpenStudio Bridge v{}", env!("CARGO_PKG_VERSION"));

    // Parse launch params (from custom protocol or CLI)
    let params = LaunchParams::from_args();

    if let Some(ref room) = params.room_id {
        info!("📡 Auto-connecting to room: {}", room);
    }

    // Initialize audio engine
    let audio_engine = Arc::new(RwLock::new(
        audio::AudioEngine::new().await?
    ));

    // Initialize mixer
    let mixer = Arc::new(RwLock::new(
        mixing::Mixer::new()
    ));

    // Create shared state
    let state = Arc::new(RwLock::new(AppState {
        audio_engine: audio_engine.clone(),
        mixer: mixer.clone(),
        connected_room: params.room_id.clone(),
        user_id: params.user_id.clone(),
    }));

    // Start WebSocket server
    let server = BridgeServer::new(state.clone());

    // Spawn server task
    let server_handle = tokio::spawn(async move {
        if let Err(e) = server.run("127.0.0.1:9999").await {
            error!("WebSocket server error: {}", e);
        }
    });

    // Start system tray (blocks on main thread for UI)
    #[cfg(feature = "tray")]
    {
        start_tray(state.clone()).await?;
    }

    // Without tray, just wait for server
    #[cfg(not(feature = "tray"))]
    {
        info!("🔊 Bridge running on ws://localhost:9999");
        info!("   Press Ctrl+C to quit");
        server_handle.await?;
    }

    Ok(())
}

/// Register custom protocol handler (openstudio://)
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

        info!("✓ Registered openstudio:// protocol handler");
    }

    #[cfg(target_os = "macos")]
    {
        // macOS requires modifying Info.plist in the .app bundle
        // This is typically done during packaging, not at runtime
        info!("ℹ Protocol handler must be set in Info.plist for macOS");
    }

    Ok(())
}
