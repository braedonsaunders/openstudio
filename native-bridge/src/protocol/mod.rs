//! WebSocket protocol for browser communication

mod messages;
mod server;

pub use messages::*;
pub use server::BridgeServer;

use std::env;
use url::Url;

/// Parameters parsed from launch URL or CLI
#[derive(Debug, Clone, Default)]
pub struct LaunchParams {
    pub room_id: Option<String>,
    pub user_id: Option<String>,
    pub token: Option<String>,
}

impl LaunchParams {
    /// Parse launch params from command line args
    /// Handles both direct args and openstudio:// protocol URLs
    pub fn from_args() -> Self {
        let args: Vec<String> = env::args().collect();
        let mut params = Self::default();

        for arg in args.iter().skip(1) {
            // Check for protocol URL
            if arg.starts_with("openstudio://") {
                if let Ok(url) = Url::parse(arg) {
                    // Parse query parameters
                    for (key, value) in url.query_pairs() {
                        match key.as_ref() {
                            "room" => params.room_id = Some(value.to_string()),
                            "user" => params.user_id = Some(value.to_string()),
                            "token" => params.token = Some(value.to_string()),
                            _ => {}
                        }
                    }

                    // Also check path for room ID
                    if let Some(host) = url.host_str() {
                        if host == "join" {
                            // openstudio://join/roomId
                            let path = url.path().trim_start_matches('/');
                            if !path.is_empty() && params.room_id.is_none() {
                                params.room_id = Some(path.to_string());
                            }
                        }
                    }
                }
            }
            // Check for direct CLI args
            else if arg.starts_with("--room=") {
                params.room_id = Some(arg.trim_start_matches("--room=").to_string());
            } else if arg.starts_with("--user=") {
                params.user_id = Some(arg.trim_start_matches("--user=").to_string());
            } else if arg.starts_with("--token=") {
                params.token = Some(arg.trim_start_matches("--token=").to_string());
            }
        }

        params
    }
}
