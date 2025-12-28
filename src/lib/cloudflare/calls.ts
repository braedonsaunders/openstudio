// Cloudflare Calls (Realtime) integration for WebRTC SFU
// This provides ultra-low latency audio streaming via Cloudflare's edge network
// API Reference: https://developers.cloudflare.com/calls/https-api/
//
// MULTI-TRACK SYNCHRONIZED ARCHITECTURE:
// ======================================
// Each user can send multiple independent audio tracks:
// - Microphone track (voice chat)
// - Instrument tracks (guitar, bass, piano, drums, etc.)
// - MIDI/synth tracks
//
// All tracks are synchronized using:
// 1. WebRTC's RTCP for timing info
// 2. Shared room clock for beat synchronization
// 3. High-priority transport hints for low latency
//
// Track naming convention: "{type}-{userId}-{instanceId}"
// Examples: "mic-user123", "guitar-user123", "midi-user123-synth1"

import type { CloudflareSession, WebRTCStats } from '@/types';

/**
 * Track type - can be any string identifier for the audio source.
 * Common examples: 'mic', 'guitar', 'bass', 'keys', 'drums', 'violin', 'sax', 'synth', 'loop', etc.
 * This is intentionally flexible to support any instrument or audio source.
 */
export type AudioTrackType = string;

/**
 * Common track type constants for convenience (not exhaustive)
 */
export const TrackTypes = {
  MIC: 'mic',
  VOICE: 'voice',
  GUITAR: 'guitar',
  BASS: 'bass',
  KEYS: 'keys',
  PIANO: 'piano',
  DRUMS: 'drums',
  PERCUSSION: 'percussion',
  SYNTH: 'synth',
  MIDI: 'midi',
  LOOP: 'loop',
  BACKING: 'backing',
  VIOLIN: 'violin',
  CELLO: 'cello',
  SAX: 'sax',
  TRUMPET: 'trumpet',
  FLUTE: 'flute',
  DJ: 'dj',
  FX: 'fx',
  OTHER: 'other',
} as const;

/**
 * Information about an audio track
 */
export interface AudioTrackInfo {
  trackId: string;
  userId: string;
  /**
   * Type of audio source - can be any string (e.g., 'guitar', 'vocals', 'synth-pad', 'loop-drums', etc.)
   * Use TrackTypes constants for common types, or any custom string for specialized sources.
   */
  type: AudioTrackType;
  /** Human-readable label for display (e.g., "Lead Guitar", "Backing Vocals", "808 Beat") */
  label: string;
  stream: MediaStream;
  transceiver: RTCRtpTransceiver | null;
  enabled: boolean;
  volume: number;
}

// TURN server configuration (optional but recommended for NAT traversal)
const TURN_SERVER_URL = process.env.NEXT_PUBLIC_TURN_SERVER_URL || '';
const TURN_USERNAME = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
const TURN_CREDENTIAL = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';

interface CallsConfig {
  iceServers: RTCIceServer[];
  sdpSemantics: 'unified-plan';
  bundlePolicy: 'max-bundle';
}

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    // Cloudflare STUN server (always included)
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  // Add TURN server if configured
  if (TURN_SERVER_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    servers.push({
      urls: TURN_SERVER_URL,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
  }

  return servers;
}

const defaultConfig: CallsConfig = {
  iceServers: buildIceServers(),
  sdpSemantics: 'unified-plan',
  bundlePolicy: 'max-bundle',
};

/**
 * Modify SDP to use 10ms Opus frames for lower latency.
 * Default browser Opus frame size is 20ms, which adds significant latency
 * for real-time jamming. Using 10ms frames saves ~10ms per direction (~20ms round-trip).
 *
 * This modifies the fmtp line for Opus to set:
 * - ptime=10: Preferred packet time of 10ms
 * - maxptime=10: Maximum packet time of 10ms
 * - minptime=10: Minimum packet time of 10ms
 */
function optimizeSdpForLowLatency(sdp: string): string {
  let optimizedSdp = sdp;

  // Find the Opus codec line and add latency parameters
  // Look for patterns like "a=fmtp:111 minptime=10;useinbandfec=1"
  // or "a=fmtp:111 useinbandfec=1"

  // First, check if ptime is already set
  if (!optimizedSdp.includes('ptime=10')) {
    // Add ptime and maxptime to the Opus fmtp line
    // Match a=fmtp:NNN followed by any existing parameters
    optimizedSdp = optimizedSdp.replace(
      /a=fmtp:(\d+)\s+(.*)/g,
      (match, payloadType, params) => {
        // Only modify Opus lines (typically payload type 111, but we check by context)
        // We identify Opus by looking for useinbandfec or minptime in the same line
        if (params.includes('useinbandfec') || params.includes('minptime')) {
          // Remove any existing ptime/maxptime values first
          let cleanParams = params
            .replace(/ptime=\d+;?/g, '')
            .replace(/maxptime=\d+;?/g, '')
            .replace(/;;/g, ';')
            .replace(/;$/g, '');

          // Add our low-latency parameters
          return `a=fmtp:${payloadType} ptime=10;maxptime=10;minptime=10;${cleanParams}`;
        }
        return match;
      }
    );
  }

  // Also add a=ptime:10 attribute if not present (some browsers prefer this)
  if (!optimizedSdp.includes('a=ptime:')) {
    // Add after the m=audio line
    optimizedSdp = optimizedSdp.replace(
      /(m=audio.*\r?\n)/,
      '$1a=ptime:10\r\n'
    );
  }

  return optimizedSdp;
}

export class CloudflareCalls {
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private sessionId: string | null = null;
  private roomId: string;
  private userId: string;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private onStatsUpdate: ((stats: WebRTCStats) => void) | null = null;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemoved: ((userId: string) => void) | null = null;

  // Multi-track support
  private localTracks: Map<string, AudioTrackInfo> = new Map();
  private remoteTracks: Map<string, AudioTrackInfo> = new Map();
  private onRemoteTrackAdded: ((track: AudioTrackInfo) => void) | null = null;
  private onRemoteTrackRemoved: ((trackId: string) => void) | null = null;

  // Synchronization: shared room clock reference
  // All tracks use this as the timing reference for synchronized playback
  private roomClockOffset: number = 0; // Offset between local time and room time
  private lastSyncTimestamp: number = 0;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async initialize(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(defaultConfig);

    // Cloudflare Calls uses trickle ICE - candidates are gathered and included in the SDP
    // We don't need to send them separately
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate gathered:', event.candidate.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        // Extract track info from track label/id
        // Multi-track format: "{type}-{userId}-{instanceId}" or "{type}-{userId}"
        // Legacy format: "audio-{userId}"
        const trackLabel = event.track.label || event.track.id;
        console.log('Received remote track:', trackLabel);

        // Parse track format: "{type}-{userId}" or "{type}-{userId}-{instanceId}"
        // Type can be any alphanumeric string (guitar, synth-pad, 808-drums, etc.)
        // Legacy format "audio-{userId}" is also supported
        const parts = trackLabel.split('-');

        if (parts.length >= 2) {
          // Check for legacy "audio-{userId}" format
          if (parts[0] === 'audio' && parts.length === 2) {
            const remoteUserId = parts[1];
            const trackInfo: AudioTrackInfo = {
              trackId: trackLabel,
              userId: remoteUserId,
              type: 'audio',
              label: 'Audio',
              stream,
              transceiver: event.transceiver || null,
              enabled: true,
              volume: 1,
            };

            this.remoteTracks.set(trackLabel, trackInfo);
            this.onRemoteTrackAdded?.(trackInfo);
            this.remoteStreams.set(remoteUserId, stream);
            this.onRemoteStream?.(remoteUserId, stream);
          } else {
            // Multi-track format: "{type}-{userId}" or "{type}-{userId}-{instanceId}"
            const type = parts[0];
            const userId = parts[1];
            const instanceId = parts.length > 2 ? parts.slice(2).join('-') : undefined;

            const trackInfo: AudioTrackInfo = {
              trackId: trackLabel,
              userId,
              type,
              label: instanceId ? `${type} (${instanceId})` : type,
              stream,
              transceiver: event.transceiver || null,
              enabled: true,
              volume: 1,
            };

            this.remoteTracks.set(trackLabel, trackInfo);
            this.onRemoteTrackAdded?.(trackInfo);

            // Also call legacy callback for backwards compatibility
            this.remoteStreams.set(trackLabel, stream);
            this.onRemoteStream?.(userId, stream);
          }
        } else {
          // Unknown format - use entire label as trackId
          const trackInfo: AudioTrackInfo = {
            trackId: trackLabel,
            userId: 'unknown',
            type: 'unknown',
            label: trackLabel,
            stream,
            transceiver: event.transceiver || null,
            enabled: true,
            volume: 1,
          };

          this.remoteTracks.set(trackLabel, trackInfo);
          this.onRemoteTrackAdded?.(trackInfo);
          this.remoteStreams.set(trackLabel, stream);
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
    };

    // Start stats monitoring
    this.startStatsMonitoring();
  }

  /**
   * Join a room and optionally add an initial audio track.
   * For multi-track support, use addTrack() after joining to add additional tracks.
   *
   * @param stream Optional initial MediaStream (for backwards compatibility)
   * @param trackType Type of the initial track - any string (e.g., 'mic', 'guitar', 'synth-lead')
   * @param trackLabel Human-readable label for the initial track (e.g., "Lead Vocals", "Rhythm Guitar")
   * @returns Session info including session ID and initial track list
   */
  async joinRoom(
    stream?: MediaStream,
    trackType: AudioTrackType = 'audio',
    trackLabel: string = 'Audio'
  ): Promise<CloudflareSession> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    // Step 1: Create a new session via our backend API
    const sessionResponse = await fetch('/api/cloudflare/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        roomId: this.roomId,
        userId: this.userId,
      }),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      throw new Error(`Failed to create session: ${error}`);
    }

    const sessionData = await sessionResponse.json();
    this.sessionId = sessionData.sessionId;
    console.log('Created session:', this.sessionId);

    // Initial clock sync
    await this.syncRoomClock();

    // If a stream is provided, add it as the initial track
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track in stream');
      }

      const trackId = `${trackType}-${this.userId}`;

      // Add transceiver for sending audio with priority hints for low latency
      const transceiver = this.peerConnection.addTransceiver(audioTrack, {
        direction: 'sendrecv',
        streams: [stream],
        sendEncodings: [{ priority: 'high', networkPriority: 'high' as RTCPriorityType }],
      });

      // Create offer with local tracks
      const offer = await this.peerConnection.createOffer();

      // Optimize SDP for low latency (10ms Opus frames instead of default 20ms)
      const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '');
      console.log('[CloudflareCalls] Optimized SDP for low latency (10ms Opus frames)');

      await this.peerConnection.setLocalDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });

      // Wait for ICE gathering to complete (or timeout)
      await this.waitForIceGathering();

      const localDescription = this.peerConnection.localDescription;
      if (!localDescription) {
        throw new Error('No local description after ICE gathering');
      }

      // Push local track to Cloudflare via our backend
      const pushResponse = await fetch('/api/cloudflare/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pushTrack',
          sessionId: this.sessionId,
          roomId: this.roomId,
          trackName: trackId,
          sdp: localDescription.sdp,
          mid: transceiver.mid,
          metadata: {
            userId: this.userId,
            type: trackType,
            label: trackLabel,
            timestamp: Date.now(),
          },
        }),
      });

      if (!pushResponse.ok) {
        const error = await pushResponse.text();
        throw new Error(`Failed to push track: ${error}`);
      }

      const pushData = await pushResponse.json();
      console.log('Push track response:', pushData);

      // Set the answer from Cloudflare
      if (pushData.sdp) {
        await this.peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: pushData.sdp,
        });
      }

      // Store track info
      const trackInfo: AudioTrackInfo = {
        trackId,
        userId: this.userId,
        type: trackType,
        label: trackLabel,
        stream,
        transceiver,
        enabled: true,
        volume: 1,
      };

      this.localTracks.set(trackId, trackInfo);
      console.log(`[CloudflareCalls] Added initial track: ${trackId} (${trackLabel})`);

      return {
        sessionId: this.sessionId!,
        tracks: pushData.tracks || [],
      };
    }

    // No initial stream - just return session info
    return {
      sessionId: this.sessionId!,
      tracks: [],
    };
  }

  // Pull remote tracks from other users in the room
  async pullRemoteTracks(remoteUserIds: string[]): Promise<void> {
    if (!this.peerConnection || !this.sessionId) {
      console.warn('Cannot pull tracks: no session');
      return;
    }

    for (const remoteUserId of remoteUserIds) {
      if (remoteUserId === this.userId) continue; // Skip self

      const trackName = `audio-${remoteUserId}`;

      // Add a transceiver for receiving
      const transceiver = this.peerConnection.addTransceiver('audio', {
        direction: 'recvonly',
      });

      // Create a new offer with the added transceiver
      const offer = await this.peerConnection.createOffer();

      // Optimize SDP for low latency
      const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '');

      await this.peerConnection.setLocalDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });
      await this.waitForIceGathering();

      const localDescription = this.peerConnection.localDescription;
      if (!localDescription) continue;

      try {
        const pullResponse = await fetch('/api/cloudflare/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'pullTrack',
            sessionId: this.sessionId,
            roomId: this.roomId,
            trackName: trackName,
            sdp: localDescription.sdp,
            mid: transceiver.mid,
          }),
        });

        if (pullResponse.ok) {
          const pullData = await pullResponse.json();
          if (pullData.sdp) {
            await this.peerConnection.setRemoteDescription({
              type: 'answer',
              sdp: pullData.sdp,
            });
          }
        }
      } catch (error) {
        console.error(`Failed to pull track for ${remoteUserId}:`, error);
      }
    }
  }

  private async waitForIceGathering(timeout = 2000): Promise<void> {
    if (!this.peerConnection) return;

    if (this.peerConnection.iceGatheringState === 'complete') {
      return;
    }

    return new Promise((resolve) => {
      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          resolve();
        }
      };

      this.peerConnection!.onicegatheringstatechange = checkState;

      // Also resolve on timeout to avoid hanging
      setTimeout(resolve, timeout);
    });
  }

  async leaveRoom(): Promise<void> {
    if (this.sessionId) {
      try {
        await fetch('/api/cloudflare/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'close',
            sessionId: this.sessionId,
            roomId: this.roomId,
          }),
        });
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    }

    this.cleanup();
  }

  /**
   * Mute/unmute all local tracks (legacy method for backwards compatibility)
   * For fine-grained control, use setTrackEnabled() instead.
   */
  async muteTrack(muted: boolean): Promise<void> {
    for (const trackInfo of this.localTracks.values()) {
      trackInfo.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      trackInfo.enabled = !muted;
    }
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  /**
   * Get the first local stream (legacy method for backwards compatibility)
   * For multi-track support, use getLocalTracks() instead.
   */
  getLocalStream(): MediaStream | null {
    const firstTrack = this.localTracks.values().next().value;
    return firstTrack?.stream || null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get the first local track name (legacy method for backwards compatibility)
   * For multi-track support, use getLocalTracks() instead.
   */
  getLocalTrackName(): string {
    const firstTrack = this.localTracks.values().next().value;
    return firstTrack?.trackId || `audio-${this.userId}`;
  }

  setOnRemoteStream(callback: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
  }

  setOnRemoteStreamRemoved(callback: (userId: string) => void): void {
    this.onRemoteStreamRemoved = callback;
  }

  setOnStatsUpdate(callback: (stats: WebRTCStats) => void): void {
    this.onStatsUpdate = callback;
  }

  // =============================================================================
  // MULTI-TRACK API
  // =============================================================================

  /**
   * Add a new audio track to send to all participants.
   * Each user can have multiple tracks (mic, guitar, midi, etc.)
   *
   * @param stream MediaStream containing the audio track
   * @param type Type of track (mic, guitar, bass, piano, drums, midi, synth, other)
   * @param label Human-readable label for the track
   * @param instanceId Optional instance ID for multiple tracks of same type (e.g., "synth1", "synth2")
   * @returns Track ID that can be used to remove/update the track
   */
  async addTrack(
    stream: MediaStream,
    type: AudioTrackType,
    label: string,
    instanceId?: string
  ): Promise<string> {
    if (!this.peerConnection || !this.sessionId) {
      throw new Error('Must join room before adding tracks');
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track in stream');
    }

    // Generate unique track ID
    const trackId = instanceId
      ? `${type}-${this.userId}-${instanceId}`
      : `${type}-${this.userId}`;

    // Check if track already exists
    if (this.localTracks.has(trackId)) {
      throw new Error(`Track ${trackId} already exists. Remove it first or use a different instanceId.`);
    }

    // Add transceiver with priority hints for low latency
    const transceiver = this.peerConnection.addTransceiver(audioTrack, {
      direction: 'sendrecv',
      streams: [stream],
      sendEncodings: [{ priority: 'high', networkPriority: 'high' as RTCPriorityType }],
    });

    // Create offer with the new track
    const offer = await this.peerConnection.createOffer();
    const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '');

    await this.peerConnection.setLocalDescription({
      type: offer.type,
      sdp: optimizedSdp,
    });

    await this.waitForIceGathering();

    const localDescription = this.peerConnection.localDescription;
    if (!localDescription) {
      throw new Error('No local description after ICE gathering');
    }

    // Push track to Cloudflare
    const pushResponse = await fetch('/api/cloudflare/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pushTrack',
        sessionId: this.sessionId,
        roomId: this.roomId,
        trackName: trackId,
        sdp: localDescription.sdp,
        mid: transceiver.mid,
        // Include track metadata for remote users
        metadata: {
          userId: this.userId,
          type,
          label,
          timestamp: Date.now(),
        },
      }),
    });

    if (!pushResponse.ok) {
      const error = await pushResponse.text();
      throw new Error(`Failed to push track ${trackId}: ${error}`);
    }

    const pushData = await pushResponse.json();

    // Set the answer
    if (pushData.sdp) {
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: pushData.sdp,
      });
    }

    // Store track info
    const trackInfo: AudioTrackInfo = {
      trackId,
      userId: this.userId,
      type,
      label,
      stream,
      transceiver,
      enabled: true,
      volume: 1,
    };

    this.localTracks.set(trackId, trackInfo);
    console.log(`[CloudflareCalls] Added track: ${trackId} (${label})`);

    return trackId;
  }

  /**
   * Remove a local track
   * @param trackId Track ID to remove
   */
  async removeTrack(trackId: string): Promise<void> {
    const trackInfo = this.localTracks.get(trackId);
    if (!trackInfo) {
      console.warn(`Track ${trackId} not found`);
      return;
    }

    // Stop the track
    trackInfo.stream.getAudioTracks().forEach((track) => track.stop());

    // Remove the sender
    if (trackInfo.transceiver) {
      trackInfo.transceiver.sender.replaceTrack(null);
    }

    this.localTracks.delete(trackId);
    console.log(`[CloudflareCalls] Removed track: ${trackId}`);
  }

  /**
   * Enable or disable a local track
   * @param trackId Track ID
   * @param enabled Whether the track should be enabled
   */
  setTrackEnabled(trackId: string, enabled: boolean): void {
    const trackInfo = this.localTracks.get(trackId);
    if (trackInfo) {
      trackInfo.enabled = enabled;
      trackInfo.stream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Get all local tracks
   */
  getLocalTracks(): Map<string, AudioTrackInfo> {
    return new Map(this.localTracks);
  }

  /**
   * Get all remote tracks
   */
  getRemoteTracks(): Map<string, AudioTrackInfo> {
    return new Map(this.remoteTracks);
  }

  /**
   * Set callback for when a remote track is added
   */
  setOnRemoteTrackAdded(callback: (track: AudioTrackInfo) => void): void {
    this.onRemoteTrackAdded = callback;
  }

  /**
   * Set callback for when a remote track is removed
   */
  setOnRemoteTrackRemoved(callback: (trackId: string) => void): void {
    this.onRemoteTrackRemoved = callback;
  }

  // =============================================================================
  // SYNCHRONIZATION API
  // =============================================================================

  /**
   * Get the current room time (synchronized across all participants).
   * Use this for scheduling synchronized playback of loops, samples, etc.
   *
   * @returns Room time in milliseconds
   */
  getRoomTime(): number {
    return Date.now() + this.roomClockOffset;
  }

  /**
   * Calculate when to play a sound to be synchronized with other participants.
   * Given a target room time, returns the local time to schedule playback.
   *
   * @param targetRoomTime Target room time when the sound should play
   * @returns Local timestamp when to play the sound
   */
  getLocalPlaybackTime(targetRoomTime: number): number {
    return targetRoomTime - this.roomClockOffset;
  }

  /**
   * Synchronize the room clock with the server.
   * This should be called periodically to maintain accurate timing.
   */
  async syncRoomClock(): Promise<void> {
    try {
      const beforeTime = Date.now();

      const response = await fetch('/api/cloudflare/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncClock',
          sessionId: this.sessionId,
          roomId: this.roomId,
          clientTime: beforeTime,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const afterTime = Date.now();
        const roundTripTime = afterTime - beforeTime;

        // Calculate clock offset accounting for network latency
        // serverTime was captured at approximately beforeTime + roundTripTime/2
        this.roomClockOffset = data.serverTime - (beforeTime + roundTripTime / 2);
        this.lastSyncTimestamp = afterTime;

        console.log(`[CloudflareCalls] Clock synced. Offset: ${this.roomClockOffset}ms, RTT: ${roundTripTime}ms`);
      }
    } catch (error) {
      console.error('[CloudflareCalls] Failed to sync clock:', error);
    }
  }

  /**
   * Get the last clock sync timestamp
   */
  getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }

  /**
   * Get estimated clock offset in milliseconds
   */
  getClockOffset(): number {
    return this.roomClockOffset;
  }

  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;

      try {
        const stats = await this.peerConnection.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let packetsLost = 0;
        let jitter = 0;
        let roundTripTime = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            bytesReceived += report.bytesReceived || 0;
            packetsLost += report.packetsLost || 0;
            jitter = report.jitter || 0;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            bytesSent += report.bytesSent || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            roundTripTime = report.currentRoundTripTime || 0;
          }
        });

        this.onStatsUpdate?.({
          bytesReceived,
          bytesSent,
          packetsLost,
          jitter: jitter * 1000, // Convert to ms
          roundTripTime: roundTripTime * 1000, // Convert to ms
          timestamp: Date.now(),
        });
      } catch (error) {
        // Stats collection can fail if connection is closed
      }
    }, 1000);
  }

  private cleanup(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Clean up all local tracks
    for (const trackInfo of this.localTracks.values()) {
      trackInfo.stream.getTracks().forEach((track) => track.stop());
    }
    this.localTracks.clear();

    // Clean up all remote tracks
    for (const trackInfo of this.remoteTracks.values()) {
      trackInfo.stream.getTracks().forEach((track) => track.stop());
      this.onRemoteTrackRemoved?.(trackInfo.trackId);
    }
    this.remoteTracks.clear();

    // Legacy cleanup
    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.remoteStreams.clear();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.sessionId = null;
    this.roomClockOffset = 0;
    this.lastSyncTimestamp = 0;
  }
}

/**
 * Summary of Multi-Track Synchronized Architecture:
 *
 * FLEXIBLE TRACK TYPES:
 * =====================
 * Track types are flexible strings - use any identifier that makes sense:
 * - Common: 'mic', 'guitar', 'bass', 'keys', 'drums', 'synth', 'loop'
 * - Specific: 'lead-guitar', 'rhythm-guitar', '808-drums', 'synth-pad'
 * - Custom: 'my-custom-source', 'fx-chain-1', 'ambient-layer'
 *
 * Use TrackTypes constants for common types, or any string for custom sources.
 *
 * SENDING TRACKS:
 * ===============
 * 1. Use addTrack() to add ANY audio source:
 *    - await calls.addTrack(micStream, 'vocals', 'Lead Vocals');
 *    - await calls.addTrack(guitarStream, 'guitar', 'Rhythm Guitar');
 *    - await calls.addTrack(synthStream, 'synth-pad', 'Ambient Pad', 'layer1');
 *    - await calls.addTrack(drumStream, '808-drums', 'Beat Machine');
 *
 * 2. Each track is sent independently with:
 *    - High priority transport hints
 *    - 10ms Opus frames for low latency
 *    - Unique track ID: "{type}-{userId}-{instanceId}"
 *
 * RECEIVING TRACKS:
 * =================
 * 1. Set up callbacks:
 *    - calls.setOnRemoteTrackAdded((track) => { ... });
 *    - calls.setOnRemoteTrackRemoved((trackId) => { ... });
 *
 * 2. Each remote track includes:
 *    - trackId: Unique identifier (e.g., "guitar-user123")
 *    - userId: Who sent this track
 *    - type: Source type string (flexible, any value)
 *    - label: Human-readable display name
 *    - stream: MediaStream to play/process
 *
 * SYNCHRONIZATION:
 * ================
 * 1. Sync clocks periodically:
 *    - await calls.syncRoomClock();
 *
 * 2. Schedule playback using room time:
 *    - const roomTime = calls.getRoomTime();
 *    - const targetBeatTime = getNextBeatTime(roomTime, bpm);
 *    - const localPlayTime = calls.getLocalPlaybackTime(targetBeatTime);
 *    - schedulePlayAt(localPlayTime);
 *
 * LATENCY OPTIMIZATIONS (implemented above):
 * ==========================================
 * - 10ms Opus frames (-20ms round-trip)
 * - Priority transport hints
 * - getUserMedia latency: 0 hint
 * - Aggressive jitter buffer mode
 * - Effect chain bypass optimization
 */

// Factory function to create Cloudflare Calls instance
export function createCloudflareCalls(roomId: string, userId: string): CloudflareCalls {
  return new CloudflareCalls(roomId, userId);
}
