//! Cloudflare MoQ Relay Client
//!
//! Connects to a Media over QUIC relay for scalable audio distribution.
//! Used when P2P mesh would have too many connections (5+ users).

use super::{clock::*, codec::*, jitter::*, osp::*, peer::*, NetworkError, NetworkStats, Result};
use parking_lot::RwLock;
use quinn::{ClientConfig, Connection, Endpoint, RecvStream, SendStream, TransportConfig, VarInt};
use rustls::{Certificate, ServerName};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, oneshot};
use tracing::{debug, error, info, warn};

/// MoQ relay configuration
#[derive(Debug, Clone)]
pub struct MoqConfig {
    /// Relay server URL (e.g., "relay.openstudio.io:443")
    pub relay_url: String,
    /// Connection timeout
    pub connect_timeout: Duration,
    /// Reconnect interval on failure
    pub reconnect_interval: Duration,
    /// Maximum reconnect attempts
    pub max_reconnect_attempts: u32,
    /// Keep-alive interval
    pub keep_alive_interval: Duration,
    /// Enable certificate verification (disable for self-signed in dev)
    pub verify_certs: bool,
}

impl Default for MoqConfig {
    fn default() -> Self {
        Self {
            relay_url: std::env::var("OPENSTUDIO_RELAY_URL")
                .unwrap_or_else(|_| "relay.openstudio.io:443".to_string()),
            connect_timeout: Duration::from_secs(10),
            reconnect_interval: Duration::from_secs(2),
            max_reconnect_attempts: 5,
            keep_alive_interval: Duration::from_secs(5),
            verify_certs: true,
        }
    }
}

/// MoQ track types for publishing/subscribing
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MoqTrackName {
    /// Room ID
    pub room_id: String,
    /// User ID (publisher)
    pub user_id: String,
    /// Track type: "audio", "control", "clock"
    pub track_type: String,
    /// Track number (for multi-track audio)
    pub track_num: u8,
}

impl MoqTrackName {
    pub fn audio(room_id: &str, user_id: &str, track_num: u8) -> Self {
        Self {
            room_id: room_id.to_string(),
            user_id: user_id.to_string(),
            track_type: "audio".to_string(),
            track_num,
        }
    }

    pub fn control(room_id: &str, user_id: &str) -> Self {
        Self {
            room_id: room_id.to_string(),
            user_id: user_id.to_string(),
            track_type: "control".to_string(),
            track_num: 0,
        }
    }

    pub fn clock(room_id: &str) -> Self {
        Self {
            room_id: room_id.to_string(),
            user_id: "master".to_string(),
            track_type: "clock".to_string(),
            track_num: 0,
        }
    }

    pub fn to_path(&self) -> String {
        format!(
            "{}/{}/{}/{}",
            self.room_id, self.user_id, self.track_type, self.track_num
        )
    }

    pub fn from_path(s: &str) -> Option<Self> {
        let parts: Vec<&str> = s.split('/').collect();
        if parts.len() != 4 {
            return None;
        }
        Some(Self {
            room_id: parts[0].to_string(),
            user_id: parts[1].to_string(),
            track_type: parts[2].to_string(),
            track_num: parts[3].parse().ok()?,
        })
    }
}

/// Events from the relay
#[derive(Debug, Clone)]
pub enum MoqEvent {
    /// Connected to relay
    Connected,
    /// Disconnected from relay
    Disconnected { reason: String },
    /// New track available to subscribe
    TrackAvailable { track: MoqTrackName },
    /// Track no longer available
    TrackEnded { track: MoqTrackName },
    /// Received audio data on subscribed track
    AudioReceived {
        track: MoqTrackName,
        samples: Vec<f32>,
        sequence: u32,
    },
    /// Received control message
    ControlReceived {
        from_user: String,
        message_type: OspMessageType,
        payload: Vec<u8>,
    },
    /// Connection quality update
    QualityUpdate { rtt_ms: f32, loss_percent: f32 },
    /// Error occurred
    Error { message: String },
}

/// MoQ relay connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoqConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

/// Track publisher state
struct PublishedTrack {
    track: MoqTrackName,
    /// Send stream wrapped in tokio Mutex to allow async access without holding RwLock
    send_stream: Arc<tokio::sync::Mutex<SendStream>>,
    sequence: u32,
    bytes_sent: u64,
}

/// Track subscriber state
struct SubscribedTrack {
    track: MoqTrackName,
    jitter_buffer: JitterBuffer,
    last_sequence: u32,
    packets_received: u64,
    packets_lost: u64,
}

/// Message types for relay protocol
#[repr(u8)]
enum RelayMessageType {
    // Client -> Relay
    Join = 0x01,
    Leave = 0x02,
    Publish = 0x03,
    Unpublish = 0x04,
    Subscribe = 0x05,
    Unsubscribe = 0x06,
    AudioData = 0x10,
    ControlData = 0x11,
    ClockSync = 0x12,
    Ping = 0x20,

    // Relay -> Client
    JoinAck = 0x81,
    TrackAnnounce = 0x82,
    TrackEnd = 0x83,
    Pong = 0xA0,
    Error = 0xFF,
}

/// MoQ relay client
pub struct MoqRelay {
    config: MoqConfig,
    state: RwLock<MoqConnectionState>,
    /// Our user/room info
    room_id: RwLock<Option<String>>,
    user_id: RwLock<Option<String>>,
    /// QUIC connection
    connection: RwLock<Option<Connection>>,
    /// Control stream for signaling
    control_send: Arc<tokio::sync::Mutex<Option<SendStream>>>,
    /// Published tracks
    published_tracks: RwLock<HashMap<String, PublishedTrack>>,
    /// Subscribed tracks
    subscribed_tracks: RwLock<HashMap<String, SubscribedTrack>>,
    /// Event sender
    event_tx: RwLock<Option<broadcast::Sender<MoqEvent>>>,
    /// Codec for audio
    codec: Arc<OpusCodec>,
    /// Peers (received from control messages)
    peers: Arc<PeerRegistry>,
    /// Clock sync
    clock: Arc<ClockSync>,
    /// Stats
    stats: RwLock<NetworkStats>,
    /// Reconnect attempts
    reconnect_attempts: RwLock<u32>,
    /// Last activity
    last_activity: RwLock<Instant>,
    /// Shutdown signal
    shutdown_tx: RwLock<Option<oneshot::Sender<()>>>,
}

impl MoqRelay {
    pub fn new(config: MoqConfig) -> Result<Self> {
        let codec = OpusCodec::low_latency()?;

        Ok(Self {
            config,
            state: RwLock::new(MoqConnectionState::Disconnected),
            room_id: RwLock::new(None),
            user_id: RwLock::new(None),
            connection: RwLock::new(None),
            control_send: Arc::new(tokio::sync::Mutex::new(None)),
            published_tracks: RwLock::new(HashMap::new()),
            subscribed_tracks: RwLock::new(HashMap::new()),
            event_tx: RwLock::new(None),
            codec: Arc::new(codec),
            peers: Arc::new(PeerRegistry::new()),
            clock: Arc::new(ClockSync::new(ClockConfig::default())),
            stats: RwLock::new(NetworkStats::default()),
            reconnect_attempts: RwLock::new(0),
            last_activity: RwLock::new(Instant::now()),
            shutdown_tx: RwLock::new(None),
        })
    }

    /// Build QUIC client configuration
    fn build_client_config(&self) -> Result<ClientConfig> {
        let mut roots = rustls::RootCertStore::empty();

        // Add webpki roots for production (rustls 0.21 compatible)
        roots.add_trust_anchors(webpki_roots::TLS_SERVER_ROOTS.iter().map(|ta| {
            rustls::OwnedTrustAnchor::from_subject_spki_name_constraints(
                ta.subject.as_ref(),
                ta.spki.as_ref(),
                ta.name_constraints.as_ref().map(|nc| nc.as_ref() as &[u8]),
            )
        }));

        let crypto = if self.config.verify_certs {
            rustls::ClientConfig::builder()
                .with_safe_defaults()
                .with_root_certificates(roots)
                .with_no_client_auth()
        } else {
            // Allow self-signed certs in development
            rustls::ClientConfig::builder()
                .with_safe_defaults()
                .with_custom_certificate_verifier(Arc::new(SkipServerVerification))
                .with_no_client_auth()
        };

        let mut transport = TransportConfig::default();
        transport.max_idle_timeout(Some(VarInt::from_u32(30_000).into())); // 30s idle timeout
        transport.keep_alive_interval(Some(self.config.keep_alive_interval));

        // quinn 0.10 uses rustls ClientConfig directly
        let mut config = ClientConfig::new(Arc::new(crypto));
        config.transport_config(Arc::new(transport));

        Ok(config)
    }

    /// Connect to relay
    pub async fn connect(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> Result<broadcast::Receiver<MoqEvent>> {
        *self.state.write() = MoqConnectionState::Connecting;
        *self.room_id.write() = Some(room_id.to_string());
        *self.user_id.write() = Some(user_id.to_string());

        info!("Connecting to MoQ relay: {}", self.config.relay_url);

        // Create event channel
        let (tx, rx) = broadcast::channel(1000);
        *self.event_tx.write() = Some(tx.clone());

        // Parse relay URL
        let relay_addr: SocketAddr = self
            .config
            .relay_url
            .parse()
            .or_else(|_| {
                // Try with default port
                format!("{}:443", self.config.relay_url).parse()
            })
            .map_err(|e| NetworkError::ConnectionFailed(format!("Invalid relay URL: {}", e)))?;

        // Create QUIC endpoint
        let mut endpoint = Endpoint::client("0.0.0.0:0".parse().unwrap())
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        let client_config = self.build_client_config()?;
        endpoint.set_default_client_config(client_config);

        // Extract hostname for SNI
        let host = self
            .config
            .relay_url
            .split(':')
            .next()
            .unwrap_or("localhost");

        // Connect with timeout
        let connecting = endpoint
            .connect(relay_addr, host)
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        let connection = tokio::time::timeout(self.config.connect_timeout, connecting)
            .await
            .map_err(|_| NetworkError::ConnectionFailed("Connection timeout".to_string()))?
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        info!("QUIC connection established to {}", relay_addr);

        // Open control stream
        let (mut control_send, control_recv) = connection
            .open_bi()
            .await
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        // Send join message
        let join_msg = self.encode_join_message(room_id, user_id);
        control_send
            .write_all(&join_msg)
            .await
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        *self.connection.write() = Some(connection.clone());
        *self.control_send.lock().await = Some(control_send);

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        *self.shutdown_tx.write() = Some(shutdown_tx);

        // Spawn tasks for receiving
        self.spawn_receiver_tasks(connection, control_recv, shutdown_rx);

        *self.state.write() = MoqConnectionState::Connected;
        *self.reconnect_attempts.write() = 0;

        let _ = tx.send(MoqEvent::Connected);

        Ok(rx)
    }

    /// Encode join message
    fn encode_join_message(&self, room_id: &str, user_id: &str) -> Vec<u8> {
        let mut msg = Vec::with_capacity(256);
        msg.push(RelayMessageType::Join as u8);

        // Room ID (length-prefixed)
        let room_bytes = room_id.as_bytes();
        msg.push(room_bytes.len() as u8);
        msg.extend_from_slice(room_bytes);

        // User ID (length-prefixed)
        let user_bytes = user_id.as_bytes();
        msg.push(user_bytes.len() as u8);
        msg.extend_from_slice(user_bytes);

        // Protocol version
        msg.extend_from_slice(&[0x01, 0x00]); // v1.0

        msg
    }

    /// Spawn receiver tasks
    fn spawn_receiver_tasks(
        &self,
        connection: Connection,
        mut control_recv: RecvStream,
        mut shutdown_rx: oneshot::Receiver<()>,
    ) {
        let event_tx = self.event_tx.read().clone();
        let codec = self.codec.clone();
        let peers = self.peers.clone();

        // Control stream receiver
        let event_tx_ctrl = event_tx.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 65536];
            loop {
                tokio::select! {
                    result = control_recv.read(&mut buf) => {
                        match result {
                            Ok(Some(n)) => {
                                Self::handle_control_message(&buf[..n], &event_tx_ctrl, &peers);
                            }
                            Ok(None) => {
                                info!("Control stream closed");
                                break;
                            }
                            Err(e) => {
                                error!("Control stream error: {}", e);
                                if let Some(tx) = &event_tx_ctrl {
                                    let _ = tx.send(MoqEvent::Error {
                                        message: e.to_string()
                                    });
                                }
                                break;
                            }
                        }
                    }
                    _ = &mut shutdown_rx => {
                        info!("Shutdown signal received");
                        break;
                    }
                }
            }
        });

        // Incoming unidirectional streams (audio data)
        let event_tx_audio = event_tx.clone();
        let codec_audio = codec.clone();
        tokio::spawn(async move {
            loop {
                match connection.accept_uni().await {
                    Ok(mut recv) => {
                        let event_tx = event_tx_audio.clone();
                        let codec = codec_audio.clone();

                        tokio::spawn(async move {
                            let mut buf = vec![0u8; 4096];
                            while let Ok(Some(n)) = recv.read(&mut buf).await {
                                Self::handle_audio_data(&buf[..n], &event_tx, &codec);
                            }
                        });
                    }
                    Err(e) => {
                        if !e.to_string().contains("closed") {
                            error!("Failed to accept stream: {}", e);
                        }
                        break;
                    }
                }
            }
        });
    }

    /// Handle control message from relay
    fn handle_control_message(
        data: &[u8],
        event_tx: &Option<broadcast::Sender<MoqEvent>>,
        _peers: &PeerRegistry,
    ) {
        if data.is_empty() {
            return;
        }

        let msg_type = data[0];
        let payload = &data[1..];

        match msg_type {
            x if x == RelayMessageType::JoinAck as u8 => {
                info!("Received join acknowledgment");
            }
            x if x == RelayMessageType::TrackAnnounce as u8 => {
                if let Some(track) = Self::parse_track_announce(payload) {
                    info!("Track announced: {}", track.to_path());
                    if let Some(tx) = event_tx {
                        let _ = tx.send(MoqEvent::TrackAvailable { track });
                    }
                }
            }
            x if x == RelayMessageType::TrackEnd as u8 => {
                if let Some(track) = Self::parse_track_announce(payload) {
                    info!("Track ended: {}", track.to_path());
                    if let Some(tx) = event_tx {
                        let _ = tx.send(MoqEvent::TrackEnded { track });
                    }
                }
            }
            x if x == RelayMessageType::Pong as u8 => {
                // RTT measurement handled by transport layer
            }
            x if x == RelayMessageType::Error as u8 => {
                let error_msg = String::from_utf8_lossy(payload).to_string();
                error!("Relay error: {}", error_msg);
                if let Some(tx) = event_tx {
                    let _ = tx.send(MoqEvent::Error { message: error_msg });
                }
            }
            _ => {
                debug!("Unknown control message type: {:#x}", msg_type);
            }
        }
    }

    /// Parse track announce message
    fn parse_track_announce(data: &[u8]) -> Option<MoqTrackName> {
        if data.is_empty() {
            return None;
        }

        let path_len = data[0] as usize;
        if data.len() < 1 + path_len {
            return None;
        }

        let path = std::str::from_utf8(&data[1..1 + path_len]).ok()?;
        MoqTrackName::from_path(path)
    }

    /// Handle audio data from relay
    fn handle_audio_data(
        data: &[u8],
        event_tx: &Option<broadcast::Sender<MoqEvent>>,
        codec: &OpusCodec,
    ) {
        if data.len() < 13 {
            return;
        }

        // Parse header: msg_type(1) + track_path_len(1) + track_path(n) + sequence(4) + opus_data
        let msg_type = data[0];
        if msg_type != RelayMessageType::AudioData as u8 {
            return;
        }

        let path_len = data[1] as usize;
        if data.len() < 2 + path_len + 4 {
            return;
        }

        let path = match std::str::from_utf8(&data[2..2 + path_len]) {
            Ok(p) => p,
            Err(_) => return,
        };

        let track = match MoqTrackName::from_path(path) {
            Some(t) => t,
            None => return,
        };

        let seq_offset = 2 + path_len;
        let sequence = u32::from_be_bytes([
            data[seq_offset],
            data[seq_offset + 1],
            data[seq_offset + 2],
            data[seq_offset + 3],
        ]);

        let opus_data = &data[seq_offset + 4..];

        // Decode audio
        match codec.decoder.decode(opus_data) {
            Ok(samples) => {
                if let Some(tx) = event_tx {
                    let _ = tx.send(MoqEvent::AudioReceived {
                        track,
                        samples,
                        sequence,
                    });
                }
            }
            Err(e) => {
                debug!("Failed to decode audio: {}", e);
            }
        }
    }

    /// Disconnect from relay
    pub async fn disconnect(&self) {
        info!("Disconnecting from MoQ relay");

        // Send shutdown signal
        if let Some(tx) = self.shutdown_tx.write().take() {
            let _ = tx.send(());
        }

        // Send leave message
        if let Some(mut control) = self.control_send.lock().await.take() {
            let room_id = self.room_id.read().clone().unwrap_or_default();
            let user_id = self.user_id.read().clone().unwrap_or_default();

            let mut leave_msg = vec![RelayMessageType::Leave as u8];
            leave_msg.push(room_id.len() as u8);
            leave_msg.extend_from_slice(room_id.as_bytes());
            leave_msg.push(user_id.len() as u8);
            leave_msg.extend_from_slice(user_id.as_bytes());

            let _ = control.write_all(&leave_msg).await;
            let _ = control.finish();
        }

        // Close connection
        if let Some(conn) = self.connection.write().take() {
            conn.close(VarInt::from_u32(0), b"User disconnected");
        }

        // Clear state
        self.published_tracks.write().clear();
        self.subscribed_tracks.write().clear();

        *self.state.write() = MoqConnectionState::Disconnected;

        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(MoqEvent::Disconnected {
                reason: "User requested".to_string(),
            });
        }
    }

    /// Publish an audio track
    pub async fn publish_audio(&self, track_num: u8) -> Result<()> {
        let room_id = self
            .room_id
            .read()
            .clone()
            .ok_or_else(|| NetworkError::ConnectionFailed("Not in room".to_string()))?;
        let user_id = self
            .user_id
            .read()
            .clone()
            .ok_or_else(|| NetworkError::ConnectionFailed("No user ID".to_string()))?;
        let connection = self
            .connection
            .read()
            .clone()
            .ok_or_else(|| NetworkError::ConnectionFailed("Not connected".to_string()))?;

        let track = MoqTrackName::audio(&room_id, &user_id, track_num);
        let track_path = track.to_path();

        info!("Publishing audio track: {}", track_path);

        // Open unidirectional stream for publishing
        let send_stream = connection
            .open_uni()
            .await
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        // Send publish announcement via control stream
        {
            let mut control_guard = self.control_send.lock().await;
            if let Some(control) = control_guard.as_mut() {
                let mut msg = vec![RelayMessageType::Publish as u8];
                msg.push(track_path.len() as u8);
                msg.extend_from_slice(track_path.as_bytes());

                control
                    .write_all(&msg)
                    .await
                    .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;
            }
        }

        self.published_tracks.write().insert(
            track_path,
            PublishedTrack {
                track,
                send_stream: Arc::new(tokio::sync::Mutex::new(send_stream)),
                sequence: 0,
                bytes_sent: 0,
            },
        );

        Ok(())
    }

    /// Unpublish an audio track
    pub async fn unpublish_audio(&self, track_num: u8) -> Result<()> {
        let room_id = self.room_id.read().clone().unwrap_or_default();
        let user_id = self.user_id.read().clone().unwrap_or_default();
        let track = MoqTrackName::audio(&room_id, &user_id, track_num);
        let track_path = track.to_path();

        // Send unpublish via control stream
        {
            let mut control_guard = self.control_send.lock().await;
            if let Some(control) = control_guard.as_mut() {
                let mut msg = vec![RelayMessageType::Unpublish as u8];
                msg.push(track_path.len() as u8);
                msg.extend_from_slice(track_path.as_bytes());

                let _ = control.write_all(&msg).await;
            }
        }

        // Close and remove the track
        if let Some(track) = self.published_tracks.write().remove(&track_path) {
            // Lock and finish the stream
            let mut stream = track.send_stream.lock().await;
            let _ = stream.finish();
        }

        Ok(())
    }

    /// Subscribe to a user's audio
    pub async fn subscribe_audio(&self, publisher_user_id: &str, track_num: u8) -> Result<()> {
        let room_id = self
            .room_id
            .read()
            .clone()
            .ok_or_else(|| NetworkError::ConnectionFailed("Not in room".to_string()))?;

        let track = MoqTrackName::audio(&room_id, publisher_user_id, track_num);
        let track_path = track.to_path();

        info!("Subscribing to audio track: {}", track_path);

        // Send subscribe via control stream
        {
            let mut control_guard = self.control_send.lock().await;
            if let Some(control) = control_guard.as_mut() {
                let mut msg = vec![RelayMessageType::Subscribe as u8];
                msg.push(track_path.len() as u8);
                msg.extend_from_slice(track_path.as_bytes());

                control
                    .write_all(&msg)
                    .await
                    .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;
            }
        }

        // Create jitter buffer for this track
        let jitter_config = JitterConfig::live_jamming();
        let jitter_buffer = JitterBuffer::new(jitter_config);

        self.subscribed_tracks.write().insert(
            track_path,
            SubscribedTrack {
                track,
                jitter_buffer,
                last_sequence: 0,
                packets_received: 0,
                packets_lost: 0,
            },
        );

        Ok(())
    }

    /// Unsubscribe from a user's audio
    pub async fn unsubscribe_audio(&self, publisher_user_id: &str, track_num: u8) -> Result<()> {
        let room_id = self.room_id.read().clone().unwrap_or_default();
        let track = MoqTrackName::audio(&room_id, publisher_user_id, track_num);
        let track_path = track.to_path();

        // Send unsubscribe via control stream
        {
            let mut control_guard = self.control_send.lock().await;
            if let Some(control) = control_guard.as_mut() {
                let mut msg = vec![RelayMessageType::Unsubscribe as u8];
                msg.push(track_path.len() as u8);
                msg.extend_from_slice(track_path.as_bytes());

                let _ = control.write_all(&msg).await;
            }
        }

        self.subscribed_tracks.write().remove(&track_path);

        Ok(())
    }

    /// Send audio data
    pub async fn send_audio(&self, track_num: u8, samples: &[f32]) -> Result<()> {
        if *self.state.read() != MoqConnectionState::Connected {
            return Err(NetworkError::ConnectionFailed("Not connected".to_string()));
        }

        let room_id = self.room_id.read().clone().unwrap_or_default();
        let user_id = self.user_id.read().clone().unwrap_or_default();
        let track_path = MoqTrackName::audio(&room_id, &user_id, track_num).to_path();

        // Encode with Opus
        let encoded = self.codec.encoder.encode(samples)?;

        // Get the send_stream Arc and sequence while holding the RwLock briefly
        let (send_stream, sequence) = {
            let tracks = self.published_tracks.read();
            if let Some(track) = tracks.get(&track_path) {
                (track.send_stream.clone(), track.sequence)
            } else {
                return Ok(()); // Track not found
            }
        }; // RwLock dropped here

        // Build message: msg_type + path_len + path + sequence + opus_data
        let mut msg = Vec::with_capacity(2 + track_path.len() + 4 + encoded.len());
        msg.push(RelayMessageType::AudioData as u8);
        msg.push(track_path.len() as u8);
        msg.extend_from_slice(track_path.as_bytes());
        msg.extend_from_slice(&sequence.to_be_bytes());
        msg.extend_from_slice(&encoded);

        // Send on the track's stream (tokio Mutex is fine to hold across await)
        {
            let mut stream = send_stream.lock().await;
            stream
                .write_all(&msg)
                .await
                .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;
        }

        // Update track state after successful send
        {
            let mut tracks = self.published_tracks.write();
            if let Some(track) = tracks.get_mut(&track_path) {
                track.sequence = track.sequence.wrapping_add(1);
                track.bytes_sent += msg.len() as u64;
            }
        }

        // Update stats
        {
            let mut stats = self.stats.write();
            stats.bytes_sent_per_sec += msg.len() as u64;
        }

        *self.last_activity.write() = Instant::now();

        Ok(())
    }

    /// Send control message to room
    pub async fn send_control(&self, message_type: OspMessageType, payload: Vec<u8>) -> Result<()> {
        if *self.state.read() != MoqConnectionState::Connected {
            return Err(NetworkError::ConnectionFailed("Not connected".to_string()));
        }

        let mut control_guard = self.control_send.lock().await;
        if let Some(control) = control_guard.as_mut() {
            let mut msg = vec![RelayMessageType::ControlData as u8];
            msg.extend_from_slice(&(message_type as u16).to_be_bytes());
            msg.extend_from_slice(&(payload.len() as u16).to_be_bytes());
            msg.extend_from_slice(&payload);

            control
                .write_all(&msg)
                .await
                .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;
        }

        Ok(())
    }

    /// Get connection state
    pub fn state(&self) -> MoqConnectionState {
        *self.state.read()
    }

    /// Get stats
    pub fn stats(&self) -> NetworkStats {
        let mut stats = self.stats.read().clone();
        stats.peer_count = self.peers.connected_count();
        stats
    }

    /// Get clock
    pub fn clock(&self) -> &ClockSync {
        &self.clock
    }

    /// Get peers
    pub fn peers(&self) -> &PeerRegistry {
        &self.peers
    }

    /// Get subscribed track count
    pub fn subscribed_track_count(&self) -> usize {
        self.subscribed_tracks.read().len()
    }

    /// Get published track count
    pub fn published_track_count(&self) -> usize {
        self.published_tracks.read().len()
    }

    /// Attempt reconnection
    pub async fn reconnect(&self) -> Result<()> {
        // Check and update attempt count (scope to release lock before await)
        {
            let mut attempts = self.reconnect_attempts.write();
            *attempts += 1;

            if *attempts > self.config.max_reconnect_attempts {
                *self.state.write() = MoqConnectionState::Failed;
                return Err(NetworkError::ConnectionFailed(
                    "Max reconnect attempts exceeded".to_string(),
                ));
            }

            *self.state.write() = MoqConnectionState::Reconnecting;
        } // Lock released here before await

        // Wait before retry
        tokio::time::sleep(self.config.reconnect_interval).await;

        // Get saved room/user info
        let room_id = self.room_id.read().clone().unwrap_or_default();
        let user_id = self.user_id.read().clone().unwrap_or_default();
        match self.connect(&room_id, &user_id).await {
            Ok(_) => {
                info!("Reconnected successfully");

                // Re-publish tracks
                let tracks: Vec<u8> = self
                    .published_tracks
                    .read()
                    .values()
                    .map(|t| t.track.track_num)
                    .collect();

                for track_num in tracks {
                    if let Err(e) = self.publish_audio(track_num).await {
                        warn!("Failed to re-publish track {}: {}", track_num, e);
                    }
                }

                Ok(())
            }
            Err(e) => {
                warn!("Reconnection failed: {}", e);
                Err(e)
            }
        }
    }
}

/// Skip server certificate verification (for development only)
struct SkipServerVerification;

impl rustls::client::ServerCertVerifier for SkipServerVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &Certificate,
        _intermediates: &[Certificate],
        _server_name: &ServerName,
        _scts: &mut dyn Iterator<Item = &[u8]>,
        _ocsp_response: &[u8],
        _now: std::time::SystemTime,
    ) -> std::result::Result<rustls::client::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::ServerCertVerified::assertion())
    }
}

/// WebTransport listen-only client for browser users without native bridge
pub struct WebTransportListener {
    config: MoqConfig,
    state: RwLock<MoqConnectionState>,
    room_id: RwLock<Option<String>>,
    user_id: RwLock<Option<String>>,
    connection: RwLock<Option<Connection>>,
    /// Event sender
    event_tx: RwLock<Option<broadcast::Sender<MoqEvent>>>,
    /// Subscribed audio tracks with buffered samples
    subscribed_tracks: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    /// Codec for decoding
    codec: Arc<OpusCodec>,
    /// Stats
    stats: RwLock<NetworkStats>,
}

impl WebTransportListener {
    pub fn new(config: MoqConfig) -> Result<Self> {
        let codec = OpusCodec::low_latency()?;

        Ok(Self {
            config,
            state: RwLock::new(MoqConnectionState::Disconnected),
            room_id: RwLock::new(None),
            user_id: RwLock::new(None),
            connection: RwLock::new(None),
            event_tx: RwLock::new(None),
            subscribed_tracks: Arc::new(RwLock::new(HashMap::new())),
            codec: Arc::new(codec),
            stats: RwLock::new(NetworkStats::default()),
        })
    }

    /// Connect as listen-only
    pub async fn connect(
        &self,
        room_id: &str,
        user_id: &str,
    ) -> Result<broadcast::Receiver<MoqEvent>> {
        *self.state.write() = MoqConnectionState::Connecting;
        *self.room_id.write() = Some(room_id.to_string());
        *self.user_id.write() = Some(user_id.to_string());

        info!("Connecting as WebTransport listener to room: {}", room_id);

        let (tx, rx) = broadcast::channel(1000);
        *self.event_tx.write() = Some(tx.clone());

        // Parse relay URL
        let relay_addr: SocketAddr = self
            .config
            .relay_url
            .parse()
            .or_else(|_| format!("{}:443", self.config.relay_url).parse())
            .map_err(|e| NetworkError::ConnectionFailed(format!("Invalid relay URL: {}", e)))?;

        // Create QUIC endpoint
        let mut endpoint = Endpoint::client("0.0.0.0:0".parse().unwrap())
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        // Build client config (rustls 0.21 compatible)
        let mut roots = rustls::RootCertStore::empty();
        roots.add_trust_anchors(webpki_roots::TLS_SERVER_ROOTS.iter().map(|ta| {
            rustls::OwnedTrustAnchor::from_subject_spki_name_constraints(
                ta.subject.as_ref(),
                ta.spki.as_ref(),
                ta.name_constraints.as_ref().map(|nc| nc.as_ref() as &[u8]),
            )
        }));

        let crypto = rustls::ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(roots)
            .with_no_client_auth();

        let mut transport = TransportConfig::default();
        transport.max_idle_timeout(Some(VarInt::from_u32(30_000).into()));

        // quinn 0.10 uses rustls ClientConfig directly
        let mut client_config = ClientConfig::new(Arc::new(crypto));
        client_config.transport_config(Arc::new(transport));
        endpoint.set_default_client_config(client_config);

        let host = self
            .config
            .relay_url
            .split(':')
            .next()
            .unwrap_or("localhost");

        // Connect
        let connecting = endpoint
            .connect(relay_addr, host)
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        let connection = tokio::time::timeout(self.config.connect_timeout, connecting)
            .await
            .map_err(|_| NetworkError::ConnectionFailed("Connection timeout".to_string()))?
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        // Open control stream and send listen-only join
        let (mut control_send, _control_recv) = connection
            .open_bi()
            .await
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        // Send listen-only join message
        let mut join_msg = vec![RelayMessageType::Join as u8, 0x01]; // 0x01 = listen-only flag
        join_msg.push(room_id.len() as u8);
        join_msg.extend_from_slice(room_id.as_bytes());
        join_msg.push(user_id.len() as u8);
        join_msg.extend_from_slice(user_id.as_bytes());

        control_send
            .write_all(&join_msg)
            .await
            .map_err(|e| NetworkError::ConnectionFailed(e.to_string()))?;

        *self.connection.write() = Some(connection.clone());

        // Spawn receiver for audio streams
        let event_tx_clone = tx.clone();
        let codec = self.codec.clone();
        let subscribed = self.subscribed_tracks.clone();

        tokio::spawn(async move {
            loop {
                match connection.accept_uni().await {
                    Ok(mut recv) => {
                        let event_tx = event_tx_clone.clone();
                        let codec = codec.clone();
                        let subscribed = subscribed.clone();

                        tokio::spawn(async move {
                            let mut buf = vec![0u8; 4096];
                            while let Ok(Some(n)) = recv.read(&mut buf).await {
                                // Decode and buffer audio
                                if n > 6 && buf[0] == RelayMessageType::AudioData as u8 {
                                    let path_len = buf[1] as usize;
                                    if n >= 2 + path_len + 4 {
                                        let path = std::str::from_utf8(&buf[2..2 + path_len])
                                            .unwrap_or_default()
                                            .to_string();

                                        let opus_data = &buf[2 + path_len + 4..n];

                                        if let Ok(samples) = codec.decoder.decode(opus_data) {
                                            subscribed
                                                .write()
                                                .insert(path.clone(), samples.clone());

                                            if let Some(track) = MoqTrackName::from_path(&path) {
                                                let _ = event_tx.send(MoqEvent::AudioReceived {
                                                    track,
                                                    samples,
                                                    sequence: 0,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                    Err(e) => {
                        if !e.to_string().contains("closed") {
                            error!("Listener stream error: {}", e);
                        }
                        break;
                    }
                }
            }
        });

        *self.state.write() = MoqConnectionState::Connected;
        let _ = tx.send(MoqEvent::Connected);

        Ok(rx)
    }

    /// Disconnect
    pub async fn disconnect(&self) {
        if let Some(conn) = self.connection.write().take() {
            conn.close(VarInt::from_u32(0), b"Listener disconnected");
        }

        *self.state.write() = MoqConnectionState::Disconnected;
        self.subscribed_tracks.write().clear();

        if let Some(tx) = self.event_tx.read().as_ref() {
            let _ = tx.send(MoqEvent::Disconnected {
                reason: "User disconnected".to_string(),
            });
        }
    }

    /// Get mixed audio output (all subscribed tracks combined)
    pub fn get_mixed_audio(&self, frame_size: usize) -> Vec<f32> {
        let tracks = self.subscribed_tracks.read();
        let mut mixed = vec![0.0; frame_size * 2]; // Stereo

        for samples in tracks.values() {
            let len = samples.len().min(mixed.len());
            for i in 0..len {
                mixed[i] += samples[i];
            }
        }

        // Soft clip to prevent harsh clipping
        for sample in mixed.iter_mut() {
            if sample.abs() > 1.0 {
                *sample = sample.signum() * (1.0 - (-sample.abs() + 1.0).exp());
            }
        }

        mixed
    }

    /// Get state
    pub fn state(&self) -> MoqConnectionState {
        *self.state.read()
    }

    /// Get track count
    pub fn track_count(&self) -> usize {
        self.subscribed_tracks.read().len()
    }

    /// Get stats
    pub fn stats(&self) -> NetworkStats {
        self.stats.read().clone()
    }
}
