// Cloudflare Calls WebRTC implementation
// Handles ultra-low latency audio streaming for real-time collaboration

import type {
  WebRTCStats,
  UserPerformanceInfo,
  LatencyBreakdown,
  JamCompatibility,
  QualityPresetName,
} from '@/types';

/**
 * Audio track info stored locally in CloudflareCalls
 */
interface AudioTrackInfo {
  trackId: string;
  userId: string;
  type: string;
  label: string;
  enabled: boolean;
  mid?: string;
}

/**
 * Extended WebRTC stats with additional fields we track internally
 */
interface ExtendedWebRTCStats extends WebRTCStats {
  bitrate?: number;
  jitterBufferDelay?: number;
}

/**
 * Simplified performance info for internal broadcasts
 * This is what we send over the data channel
 */
interface BroadcastPerformanceInfo {
  rtt: number;
  jitter: number;
  packetLoss: number;
  bufferSize: number;
  qualityScore: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}
import {
  MasterClockSync,
  LatencyCompensator,
  NetworkTrendAnalyzer,
  calculateLatencyBreakdown,
  calculateQualityScore,
  assessConnectionQuality,
} from '@/lib/audio/latency-sync-engine';
import { QUALITY_PRESETS, getRecommendedPreset } from '@/lib/audio/quality-presets';
import { useSessionTempoStore } from '@/stores/session-tempo-store';

/**
 * Track type - can be any string identifier for the audio source.
 * Common examples: 'mic', 'guitar', 'bass', 'keys', 'drums', 'violin', 'sax', 'synth', 'loop', etc.
 * This is intentionally flexible to support any instrument or audio source.
 */
export type AudioTrackType = string;

/**
 * Common track types for convenience
 */
export const CommonTrackTypes = {
  MIC: 'mic',
  GUITAR: 'guitar',
  BASS: 'bass',
  KEYS: 'keys',
  DRUMS: 'drums',
  VIOLIN: 'violin',
  SAX: 'sax',
  SYNTH: 'synth',
  LOOP: 'loop',
  MIDI: 'midi',
} as const;

interface CallsConfig {
  iceServers?: RTCIceServer[];
  sdpSemantics?: string;
  bundlePolicy?: RTCBundlePolicy;
}

/**
 * Build ICE servers configuration
 * Uses Cloudflare's free TURN servers when available, falls back to Google STUN
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [];

  // Always include Google STUN server as fallback
  servers.push({ urls: 'stun:stun.l.google.com:19302' });

  // Add Cloudflare TURN servers if credentials are configured
  const turnUsername = process.env.NEXT_PUBLIC_CLOUDFLARE_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_CLOUDFLARE_TURN_CREDENTIAL;

  if (turnUsername && turnCredential) {
    servers.push({
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
      ],
      username: turnUsername,
      credential: turnCredential,
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
 * Opus encoding settings for SDP modification
 */
interface OpusSdpSettings {
  frameSize: number;  // 10 or 20 ms
  fec: boolean;       // Forward Error Correction
  dtx: boolean;       // Discontinuous Transmission
  cbr: boolean;       // Constant Bit Rate
  stereo?: boolean;   // Stereo encoding
}

/**
 * SDP optimization options (legacy interface for backwards compatibility)
 */
interface SdpOptimizationOptions {
  /** Use 10ms Opus frames instead of 20ms (default: true) */
  lowLatency?: boolean;
  /** Enable stereo encoding for this track (default: false for mono) */
  stereo?: boolean;
}

/**
 * Modify SDP to optimize Opus encoding for the given settings.
 * Applies frame size, FEC, DTX, and CBR settings from quality presets.
 *
 * This modifies the fmtp line for Opus to set:
 * - ptime/maxptime/minptime: Packet time based on frameSize
 * - useinbandfec: Forward Error Correction
 * - usedtx: Discontinuous Transmission (silence suppression)
 * - cbr: Constant Bit Rate mode
 * - stereo/sprop-stereo: Stereo encoding settings
 */
function optimizeSdpForLowLatency(sdp: string, settings?: OpusSdpSettings): string {
  let optimizedSdp = sdp;

  // Default to low-latency settings if not provided
  const frameSize = settings?.frameSize ?? 10;
  const fec = settings?.fec ?? true;
  const dtx = settings?.dtx ?? false;
  const cbr = settings?.cbr ?? true;
  const stereo = settings?.stereo ?? false;

  // Find the Opus codec line and add latency parameters
  // Look for patterns like "a=fmtp:111 minptime=10;useinbandfec=1"
  optimizedSdp = optimizedSdp.replace(
    /a=fmtp:(\d+)\s+(.*)/g,
    (match, payloadType, params) => {
      // Only modify Opus lines (identified by useinbandfec or minptime)
      if (params.includes('useinbandfec') || params.includes('minptime')) {
        // Remove existing parameters that we'll be setting
        let cleanParams = params
          .replace(/ptime=\d+;?/g, '')
          .replace(/maxptime=\d+;?/g, '')
          .replace(/minptime=\d+;?/g, '')
          .replace(/useinbandfec=\d;?/g, '')
          .replace(/usedtx=\d;?/g, '')
          .replace(/cbr=\d;?/g, '')
          .replace(/stereo=\d;?/g, '')
          .replace(/sprop-stereo=\d;?/g, '')
          .replace(/;;/g, ';')
          .replace(/;$/g, '')
          .replace(/^\s*;/, '');

        // Build new parameters with our settings
        const newParams = [
          `ptime=${frameSize}`,
          `maxptime=${frameSize}`,
          `minptime=${frameSize}`,
          `useinbandfec=${fec ? 1 : 0}`,
          `usedtx=${dtx ? 1 : 0}`,
          `cbr=${cbr ? 1 : 0}`,
          `stereo=${stereo ? 1 : 0}`,
        ];

        // Add sprop-stereo for stereo streams
        if (stereo) {
          newParams.push('sprop-stereo=1');
        }

        // Combine new params with remaining clean params
        const finalParams = cleanParams ? `${newParams.join(';')};${cleanParams}` : newParams.join(';');
        return `a=fmtp:${payloadType} ${finalParams}`;
      }
      return match;
    }
  );

  // Also add a=ptime attribute if not present (some browsers prefer this)
  if (!optimizedSdp.includes('a=ptime:')) {
    // Add after the m=audio line
    optimizedSdp = optimizedSdp.replace(
      /(m=audio.*\r?\n)/,
      `$1a=ptime:${frameSize}\r\n`
    );
  }

  return optimizedSdp;
}

/**
 * Modify SDP for optimal audio transmission.
 * Convenience wrapper that accepts simple options.
 */
function optimizeSdpForAudio(sdp: string, options: SdpOptimizationOptions = {}): string {
  const { lowLatency = true, stereo = false } = options;
  return optimizeSdpForLowLatency(sdp, {
    frameSize: lowLatency ? 10 : 20,
    fec: true,
    dtx: false,
    cbr: true,
    stereo,
  });
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
  private transceivers: Map<string, RTCRtpTransceiver> = new Map();

  // Room clock sync for playback synchronization
  private roomClockOffset: number = 0;
  private lastSyncTimestamp: number = 0;

  // Data channel for signaling and sync messages
  private dataChannel: RTCDataChannel | null = null;

  // World-class latency sync components
  private clockSync: MasterClockSync;
  private latencyCompensator: LatencyCompensator;
  private networkTrend: NetworkTrendAnalyzer;
  private isMaster: boolean = false;
  private clockSyncInterval: ReturnType<typeof setInterval> | null = null;
  private performanceBroadcastInterval: ReturnType<typeof setInterval> | null = null;

  // Performance tracking (broadcast format for data channel)
  private participantPerformanceData: Map<string, BroadcastPerformanceInfo> = new Map();

  // Current quality preset
  private activePreset: QualityPresetName = 'low-latency';

  // Callbacks for sync system
  private onClockSync?: (offset: number, rtt: number) => void;
  private onParticipantPerformanceUpdate?: (userId: string, info: BroadcastPerformanceInfo) => void;
  private onJamCompatibilityChange?: (compatibility: JamCompatibility) => void;
  private onMasterChange?: (masterId: string, isSelf: boolean) => void;

  constructor(roomId: string, userId: string, config: CallsConfig = {}) {
    this.roomId = roomId;
    this.userId = userId;

    // Initialize sync components
    this.clockSync = new MasterClockSync();
    this.latencyCompensator = new LatencyCompensator();
    this.networkTrend = new NetworkTrendAnalyzer();

    this.initializePeerConnection({ ...defaultConfig, ...config });
  }

  private initializePeerConnection(config: CallsConfig): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: config.iceServers,
      // @ts-expect-error - sdpSemantics is valid but not in types
      sdpSemantics: config.sdpSemantics,
      bundlePolicy: config.bundlePolicy,
    });

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        // Extract userId from track metadata or stream id
        // Track names are in format: {type}-{userId}-{instanceId}
        const trackName = event.track.label || stream.id;
        const parts = trackName.split('-');
        const userId = parts.length >= 2 ? parts[1] : stream.id;

        this.remoteStreams.set(userId, stream);
        this.onRemoteStream?.(userId, stream);

        // Store remote track info
        this.remoteTracks.set(trackName, {
          trackId: trackName,
          userId,
          type: parts[0] || 'audio',
          label: trackName,
          enabled: true,
        });
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('ICE connection state:', state);

      // Attempt ICE restart on connection failure
      if (state === 'failed') {
        console.log('[CloudflareCalls] ICE connection failed, attempting restart...');
        this.peerConnection?.restartIce();
      }

      // Log disconnection for monitoring (may recover automatically)
      if (state === 'disconnected') {
        console.warn('[CloudflareCalls] ICE connection disconnected, monitoring for recovery...');
      }
    };

    // Start stats monitoring
    this.startStatsMonitoring();
  }

  /**
   * Join a room and optionally add an initial audio track.
   * This method handles the complete WebRTC setup including:
   * - Creating a Cloudflare Calls session
   * - Adding the local audio track (if provided)
   * - Pulling existing remote tracks from the room
   * - Setting up the data channel for sync
   *
   * @param stream Optional MediaStream containing an audio track
   * @param trackType Type identifier for the track (e.g., 'mic', 'guitar')
   * @param trackLabel Optional human-readable label for the track
   * @returns Promise that resolves when connected
   */
  async joinRoom(stream?: MediaStream, trackType: AudioTrackType = 'mic', trackLabel?: string): Promise<void> {
    // Create a new Cloudflare Calls session
    const sessionResponse = await fetch('/api/cloudflare/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', roomId: this.roomId, userId: this.userId }),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to create Cloudflare session');
    }

    const sessionData = await sessionResponse.json();
    this.sessionId = sessionData.sessionId;

    console.log('Created Cloudflare session:', this.sessionId);

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
      const transceiver = this.peerConnection!.addTransceiver(audioTrack, {
        direction: 'sendrecv',
        streams: [stream],
        sendEncodings: [{ priority: 'high', networkPriority: 'high' as RTCPriorityType }],
      });

      // Create offer with local tracks
      const offer = await this.peerConnection!.createOffer();

      // Optimize SDP with current preset's Opus settings
      const preset = QUALITY_PRESETS[this.activePreset];
      const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '', {
        frameSize: preset.encoding.frameSize,
        fec: preset.encoding.fec,
        dtx: preset.encoding.dtx,
        cbr: preset.encoding.cbr,
      });
      console.log(`[CloudflareCalls] Optimized SDP with preset '${this.activePreset}' (${preset.encoding.frameSize}ms frames, FEC=${preset.encoding.fec})`);

      await this.peerConnection!.setLocalDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });

      // Wait for ICE gathering to complete (or timeout)
      await this.waitForIceGathering();

      const localDescription = this.peerConnection!.localDescription;
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
        await this.peerConnection!.setRemoteDescription({
          type: 'answer',
          sdp: pushData.sdp,
        });
      }

      // Store track info
      const trackInfo: AudioTrackInfo = {
        trackId,
        userId: this.userId,
        type: trackType,
        label: trackLabel || trackType,
        enabled: true,
        mid: transceiver.mid || undefined,
      };
      this.localTracks.set(trackId, trackInfo);
      this.transceivers.set(trackId, transceiver);
    }

    // Set up data channel for sync messages
    this.setupDataChannel();

    // Pull remote tracks from other users
    await this.pullRemoteTracks();
  }

  private async pullRemoteTracks(): Promise<void> {
    // Get list of remote tracks in the room
    const listResponse = await fetch('/api/cloudflare/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getRoomTracks',
        sessionId: this.sessionId,
        roomId: this.roomId,
      }),
    });

    if (!listResponse.ok) {
      console.warn('Failed to list remote tracks');
      return;
    }

    const listData = await listResponse.json();
    const remoteTracks: { trackName: string; userId: string; type: string }[] = listData.tracks || [];

    // Pull each remote track
    for (const remoteTrack of remoteTracks) {
      const remoteUserId = remoteTrack.userId || remoteTrack.trackName.split('-')[1];
      if (remoteUserId === this.userId) continue; // Skip self

      const trackName = `audio-${remoteUserId}`;

      // Add a transceiver for receiving
      const transceiver = this.peerConnection!.addTransceiver('audio', {
        direction: 'recvonly',
      });

      // Request minimum playout delay for lowest latency
      // This is an experimental API but widely supported in Chromium
      if ('playoutDelayHint' in transceiver.receiver) {
        (transceiver.receiver as RTCRtpReceiver & { playoutDelayHint: number }).playoutDelayHint = 0;
      }

      // Create a new offer with the added transceiver
      const offer = await this.peerConnection!.createOffer();

      // Optimize SDP with current preset's Opus settings
      const preset = QUALITY_PRESETS[this.activePreset];
      const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '', {
        frameSize: preset.encoding.frameSize,
        fec: preset.encoding.fec,
        dtx: preset.encoding.dtx,
        cbr: preset.encoding.cbr,
      });

      await this.peerConnection!.setLocalDescription({
        type: offer.type,
        sdp: optimizedSdp,
      });
      await this.waitForIceGathering();

      const localDescription = this.peerConnection!.localDescription;
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
            await this.peerConnection!.setRemoteDescription({
              type: 'answer',
              sdp: pullData.sdp,
            });
          }
          console.log(`Pulled remote track: ${trackName}`);
        }
      } catch (error) {
        console.warn(`Failed to pull track ${trackName}:`, error);
      }
    }
  }

  private async waitForIceGathering(): Promise<void> {
    if (!this.peerConnection) return;

    if (this.peerConnection.iceGatheringState === 'complete') {
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('ICE gathering timed out');
        resolve();
      }, 2000);

      this.peerConnection!.onicegatheringstatechange = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  /**
   * Add an additional track to the session.
   * Useful for multi-instrument setups or adding MIDI playback.
   *
   * @param stream MediaStream containing the audio track
   * @param trackType Type identifier for the track
   * @param trackLabel Optional human-readable label
   * @param isStereo Whether this is a stereo track (default: false for mono)
   * @returns Promise that resolves with the track ID
   */
  async addTrack(stream: MediaStream, trackType: AudioTrackType, trackLabel?: string, isStereo: boolean = false): Promise<string> {
    if (!this.peerConnection || !this.sessionId) {
      throw new Error('Not connected to a room');
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track in stream');
    }

    // Generate unique track ID
    const instanceId = Date.now().toString(36);
    const trackId = `${trackType}-${this.userId}-${instanceId}`;

    // Add transceiver with priority hints
    const transceiver = this.peerConnection.addTransceiver(audioTrack, {
      direction: 'sendrecv',
      streams: [stream],
      sendEncodings: [{ priority: 'high', networkPriority: 'high' as RTCPriorityType }],
    });

    // Create offer with the new track
    const offer = await this.peerConnection.createOffer();
    const preset = QUALITY_PRESETS[this.activePreset];
    const optimizedSdp = optimizeSdpForLowLatency(offer.sdp || '', {
      frameSize: preset.encoding.frameSize,
      fec: preset.encoding.fec,
      dtx: preset.encoding.dtx,
      cbr: preset.encoding.cbr,
      stereo: isStereo,
    });

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
        metadata: {
          userId: this.userId,
          type: trackType,
          label: trackLabel,
          stereo: isStereo,
          timestamp: Date.now(),
        },
      }),
    });

    if (!pushResponse.ok) {
      throw new Error('Failed to push track');
    }

    const pushData = await pushResponse.json();
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
      label: trackLabel || trackType,
      enabled: true,
      mid: transceiver.mid || undefined,
    };
    this.localTracks.set(trackId, trackInfo);
    this.transceivers.set(trackId, transceiver);

    console.log(`Added track: ${trackId}`);
    return trackId;
  }

  /**
   * Remove a track from the session.
   *
   * @param trackId The track ID to remove
   */
  async removeTrack(trackId: string): Promise<void> {
    const transceiver = this.transceivers.get(trackId);
    if (transceiver) {
      transceiver.direction = 'inactive';
      transceiver.sender.track?.stop();
    }

    this.localTracks.delete(trackId);
    this.transceivers.delete(trackId);

    // Notify Cloudflare
    if (this.sessionId) {
      await fetch('/api/cloudflare/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeTrack',
          sessionId: this.sessionId,
          roomId: this.roomId,
          trackName: trackId,
        }),
      });
    }

    console.log(`Removed track: ${trackId}`);
  }

  /**
   * Enable or disable a track.
   *
   * @param trackId The track ID
   * @param enabled Whether the track should be enabled
   */
  setTrackEnabled(trackId: string, enabled: boolean): void {
    const transceiver = this.transceivers.get(trackId);
    if (transceiver?.sender.track) {
      transceiver.sender.track.enabled = enabled;
    }

    const trackInfo = this.localTracks.get(trackId);
    if (trackInfo) {
      trackInfo.enabled = enabled;
    }
  }

  /**
   * Get info about all local tracks.
   */
  getLocalTracks(): AudioTrackInfo[] {
    return Array.from(this.localTracks.values());
  }

  /**
   * Get info about all remote tracks.
   */
  getRemoteTracks(): AudioTrackInfo[] {
    return Array.from(this.remoteTracks.values());
  }

  /**
   * Get the current room time (adjusted for clock offset).
   * Use this for synchronized playback timing.
   */
  getRoomTime(): number {
    return Date.now() + this.roomClockOffset;
  }

  /**
   * Convert a room timestamp to local time.
   * @param targetRoomTime Target room time when the sound should play
   * @returns Local timestamp when to play the sound
   */
  getLocalPlaybackTime(targetRoomTime: number): number {
    return targetRoomTime - this.roomClockOffset;
  }

  /**
   * Synchronize the room clock with the server.
   * This should be called periodically to maintain accurate timing.
   * Implements exponential backoff retry on failure (max 3 retries).
   */
  async syncRoomClock(retryCount: number = 0): Promise<void> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;

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
      } else if (retryCount < MAX_RETRIES) {
        // Retry with exponential backoff on non-ok response
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.warn(`[CloudflareCalls] Clock sync failed (${response.status}), retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.syncRoomClock(retryCount + 1);
      } else {
        console.error(`[CloudflareCalls] Clock sync failed after ${MAX_RETRIES} retries`);
      }
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        // Retry with exponential backoff on network error
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        console.warn(`[CloudflareCalls] Clock sync error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.syncRoomClock(retryCount + 1);
      } else {
        console.error(`[CloudflareCalls] Clock sync failed after ${MAX_RETRIES} retries:`, error);
      }
    }
  }

  /**
   * Get the last clock sync timestamp
   */
  getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }

  /**
   * Set up the data channel for sync messages
   */
  private setupDataChannel(): void {
    if (!this.peerConnection) return;

    // Create data channel with low-latency settings
    this.dataChannel = this.peerConnection.createDataChannel('sync', {
      ordered: false, // Don't wait for ordering
      maxRetransmits: 0, // Don't retry failed messages
    });

    this.dataChannel.binaryType = 'arraybuffer';

    const channel = this.dataChannel;

    channel.onopen = () => {
      console.log('[CloudflareCalls] Data channel opened');
      // If we're master, start broadcasting clock
      if (this.isMaster) {
        this.startClockBroadcast();
      }
      // Start broadcasting our performance info
      this.startPerformanceBroadcast();
    };

    channel.onclose = () => {
      console.log('[CloudflareCalls] Data channel closed');
      this.stopClockBroadcast();
      this.stopPerformanceBroadcast();
    };

    channel.onerror = (error) => {
      console.error('[CloudflareCalls] Data channel error:', error);
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };
  }

  private handleDataChannelMessage(data: string | ArrayBuffer): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));

      switch (message.type) {
        case 'clock_sync':
          if (!this.isMaster) {
            const receiveTime = performance.now();
            const ack = this.clockSync.processClockSync(message, receiveTime);
            this.sendDataChannelMessage(ack);
          }
          break;

        case 'clock_ack':
          if (this.isMaster) {
            const ackReceiveTime = performance.now();
            this.clockSync.processClockAck(message, ackReceiveTime);
          }
          break;

        case 'performance_info':
          this.handlePerformanceInfo(message.userId, message.info);
          break;

        case 'master_handoff':
          this.handleMasterHandoff(message);
          break;

        case 'latency_compensation':
          // Apply compensation settings from master
          const myDelay = message.userDelays[this.userId] || 0;
          // This would be applied to audio processing
          console.log(`[CloudflareCalls] Received compensation delay: ${myDelay}ms`);
          break;

        case 'ping':
          this.sendDataChannelMessage({ type: 'pong', timestamp: message.timestamp });
          break;

        case 'pong':
          const rtt = performance.now() - message.timestamp;
          this.onClockSync?.(this.clockSync.getOffset(), rtt);
          break;
      }
    } catch (error) {
      console.warn('[CloudflareCalls] Failed to parse data channel message:', error);
    }
  }

  private handlePerformanceInfo(userId: string, info: BroadcastPerformanceInfo): void {
    // Store performance data for this participant
    this.participantPerformanceData.set(userId, info);

    // Notify callback
    this.onParticipantPerformanceUpdate?.(userId, info);

    // Update latency compensator with new info
    this.latencyCompensator.updateUserLatency(
      userId,
      info.rtt,
      info.jitter,
      info.packetLoss
    );
  }

  private handleMasterHandoff(message: { newMasterId: string; lastKnownBeatPosition: number; lastKnownBpm: number }): void {
    const wasMaster = this.isMaster;
    this.isMaster = message.newMasterId === this.userId;

    if (this.isMaster && !wasMaster) {
      console.log('[CloudflareCalls] Becoming room master');
      this.startClockBroadcast();
    } else if (!this.isMaster && wasMaster) {
      console.log('[CloudflareCalls] No longer room master');
      this.stopClockBroadcast();
    }

    this.onMasterChange?.(message.newMasterId, this.isMaster);
  }

  isMasterClient(): boolean {
    return this.isMaster;
  }

  private startClockBroadcast(): void {
    if (this.clockSyncInterval) return;

    // Broadcast clock 10 times per second (100ms interval)
    this.clockSyncInterval = setInterval(() => {
      if (!this.isMaster || !this.dataChannel) return;

      // Get current BPM and beat position from session tempo store
      const { tempo, beatsPerBar } = useSessionTempoStore.getState();
      const bpm = tempo;

      // Calculate beat position based on current time and BPM
      // This provides a continuous beat position for synchronization
      const msPerBeat = 60000 / bpm;
      const currentTime = performance.now();
      const beatPosition = (currentTime / msPerBeat) % beatsPerBar;

      const message = this.clockSync.createClockSyncMessage(bpm, beatPosition);
      this.sendDataChannelMessage(message);
    }, 100);
  }

  private stopClockBroadcast(): void {
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }
  }

  private startPerformanceBroadcast(): void {
    if (this.performanceBroadcastInterval) return;

    // Broadcast performance info every 2 seconds
    this.performanceBroadcastInterval = setInterval(() => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

      const stats = this.getLatestStats();
      if (!stats) return;

      const info: BroadcastPerformanceInfo = {
        rtt: stats.roundTripTime,
        jitter: stats.jitter,
        packetLoss: stats.packetsLost,
        bufferSize: stats.jitterBufferDelay || 0,
        qualityScore: calculateQualityScore(
          stats.roundTripTime,
          stats.jitter,
          stats.packetsLost,
          stats.bitrate || 128
        ),
        connectionQuality: assessConnectionQuality(
          stats.roundTripTime,
          stats.jitter,
          stats.packetsLost
        ),
      };

      this.sendDataChannelMessage({
        type: 'performance_info',
        userId: this.userId,
        info,
      });
    }, 2000);
  }

  private stopPerformanceBroadcast(): void {
    if (this.performanceBroadcastInterval) {
      clearInterval(this.performanceBroadcastInterval);
      this.performanceBroadcastInterval = null;
    }
  }

  private latestStats: ExtendedWebRTCStats | null = null;

  private getLatestStats(): ExtendedWebRTCStats | null {
    return this.latestStats;
  }

  private sendDataChannelMessage(message: object): void {
    if (this.dataChannel?.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message));
      } catch (error) {
        console.warn('[CloudflareCalls] Failed to send data channel message:', error);
      }
    }
  }

  /**
   * Set the active quality preset
   */
  setQualityPreset(presetName: QualityPresetName): void {
    this.activePreset = presetName;
    console.log(`[CloudflareCalls] Quality preset changed to: ${presetName}`);
    // Note: Changing preset requires renegotiation to take effect on existing tracks
    // New tracks will automatically use the new preset
  }

  /**
   * Get the active quality preset
   */
  getQualityPreset(): QualityPresetName {
    return this.activePreset;
  }

  /**
   * Get recommended preset based on current network conditions
   */
  getRecommendedPreset(): QualityPresetName {
    const stats = this.getLatestStats();
    if (!stats) return 'low-latency';
    return getRecommendedPreset(stats.roundTripTime);
  }

  /**
   * Set this client as the room master
   */
  setAsMaster(isMaster: boolean): void {
    const wasMaster = this.isMaster;
    this.isMaster = isMaster;

    if (isMaster && !wasMaster) {
      this.startClockBroadcast();
    } else if (!isMaster && wasMaster) {
      this.stopClockBroadcast();
    }

    this.onMasterChange?.(this.userId, isMaster);
  }

  async initialize(): Promise<void> {
    // No-op, initialization happens in constructor
    // This method exists for API consistency
  }

  setOnStatsUpdate(callback: (stats: WebRTCStats) => void): void {
    this.onStatsUpdate = callback;
  }

  setOnRemoteStream(callback: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStream = callback;
  }

  setOnRemoteStreamRemoved(callback: (userId: string) => void): void {
    this.onRemoteStreamRemoved = callback;
  }

  private startStatsMonitoring(): void {
    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;

      try {
        const stats = await this.peerConnection.getStats();
        let audioStats: ExtendedWebRTCStats = {
          bytesReceived: 0,
          bytesSent: 0,
          packetsLost: 0,
          jitter: 0,
          roundTripTime: 0,
          timestamp: Date.now(),
          bitrate: 0,
          jitterBufferDelay: 0,
        };

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            audioStats.packetsLost = report.packetsLost || 0;
            audioStats.jitter = (report.jitter || 0) * 1000; // Convert to ms
            audioStats.jitterBufferDelay = report.jitterBufferDelay || 0;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            // Bitrate may come from different properties depending on browser
            audioStats.bitrate = (report as { bitrate?: number }).bitrate || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            audioStats.roundTripTime = (report.currentRoundTripTime || 0) * 1000; // Convert to ms
          }
        });

        this.latestStats = audioStats;
        this.onStatsUpdate?.(audioStats);

        // Update network trend analyzer
        if (audioStats.roundTripTime > 0) {
          this.networkTrend.addSample(
            audioStats.roundTripTime,
            audioStats.jitter,
            audioStats.packetsLost
          );

          // Update self latency in compensator
          this.latencyCompensator.updateUserLatency(
            'self',
            audioStats.roundTripTime,
            audioStats.jitter,
            audioStats.packetsLost
          );
        }
      } catch (error) {
        console.warn('Failed to get WebRTC stats:', error);
      }
    }, 1000);
  }

  /**
   * Get all participant performance info (broadcast format)
   */
  getParticipantPerformanceData(): Map<string, BroadcastPerformanceInfo> {
    return new Map(this.participantPerformanceData);
  }

  /**
   * Get performance info for a specific user (broadcast format)
   */
  getUserPerformanceData(userId: string): BroadcastPerformanceInfo | undefined {
    return this.participantPerformanceData.get(userId);
  }

  /**
   * Get jam compatibility assessment
   */
  getJamCompatibility(): JamCompatibility {
    return this.latencyCompensator.calculateJamCompatibility();
  }

  /**
   * Get the latency compensator for audio chain integration
   */
  getLatencyCompensator(): LatencyCompensator {
    return this.latencyCompensator;
  }

  /**
   * Get network trend analysis
   */
  getNetworkTrend(): ReturnType<NetworkTrendAnalyzer['analyzeTrend']> {
    return this.networkTrend.analyzeTrend();
  }

  /**
   * Initialize latency compensation with audio context
   */
  initializeLatencyCompensation(audioContext: AudioContext): void {
    this.latencyCompensator.initialize(audioContext);
  }

  /**
   * Get the compensation delay node for audio chain
   */
  getCompensationDelayNode(): DelayNode | null {
    return this.latencyCompensator.getDelayNode();
  }

  /**
   * Set callback for applying compensation delays to incoming remote streams.
   * This is critical for proper bidirectional synchronization - each remote
   * user's audio needs to be delayed based on their latency compensation.
   * @param callback Function that receives userId and delay in ms
   */
  setOnRemoteStreamCompensation(callback: (userId: string, delayMs: number) => void): void {
    this.latencyCompensator.onRemoteStreamCompensation = callback;
  }

  // Callback setters for sync system
  setOnClockSync(callback: (offset: number, rtt: number) => void): void {
    this.onClockSync = callback;
  }

  setOnParticipantPerformanceUpdate(callback: (userId: string, info: BroadcastPerformanceInfo) => void): void {
    this.onParticipantPerformanceUpdate = callback;
  }

  setOnJamCompatibilityChange(callback: (compatibility: JamCompatibility) => void): void {
    this.onJamCompatibilityChange = callback;
    this.latencyCompensator.onJamCompatibilityChange = callback;
  }

  setOnMasterChange(callback: (masterId: string, isSelf: boolean) => void): void {
    this.onMasterChange = callback;
  }

  // ==========================================================================
  // Metronome Integration for World-Class WebRTC Sync
  // ==========================================================================

  /**
   * Get the master clock sync for metronome integration.
   * The metronome engine can use this to synchronize beats across all participants.
   */
  getClockSync(): MasterClockSync {
    return this.clockSync;
  }

  /**
   * Get the current clock sync offset in milliseconds.
   * Positive values mean local clock is ahead of master.
   */
  getClockOffset(): number {
    return this.clockSync.getOffset();
  }

  /**
   * Get the current sync quality assessment.
   */
  getSyncQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    return this.clockSync.getSyncQuality();
  }

  /**
   * Get the current master time (local time adjusted by offset).
   * Use this for scheduling events in sync with other participants.
   */
  getMasterTime(): number {
    return this.clockSync.getMasterTime();
  }

  /**
   * Convert a master time to local time.
   * Use this to schedule audio events at the correct local time.
   */
  getLocalTime(masterTime: number): number {
    return this.clockSync.getLocalTime(masterTime);
  }

  /**
   * Get the current beat position from the master clock broadcasts.
   * Returns the beat position that should be playing RIGHT NOW.
   */
  getMasterBeatPosition(): { beatPosition: number; bpm: number; timestamp: number } {
    const { tempo, beatsPerBar } = useSessionTempoStore.getState();
    const masterTime = this.clockSync.getMasterTime();
    const msPerBeat = 60000 / tempo;
    const beatPosition = (masterTime / msPerBeat) % beatsPerBar;

    return {
      beatPosition,
      bpm: tempo,
      timestamp: masterTime,
    };
  }

  /**
   * Add metronome broadcast stream to WebRTC.
   * The metronome audio will be sent to all room participants.
   *
   * @param stream MediaStream containing the metronome audio track
   * @returns Promise that resolves with the track ID
   */
  async addMetronomeBroadcast(stream: MediaStream): Promise<string> {
    return this.addTrack(stream, 'metronome', 'Metronome Click Track', false);
  }

  /**
   * Remove metronome broadcast stream from WebRTC.
   *
   * @param trackId The metronome track ID to remove
   */
  async removeMetronomeBroadcast(trackId: string): Promise<void> {
    return this.removeTrack(trackId);
  }

  /**
   * Check if this client is currently the room master.
   * Only the master broadcasts clock sync and should broadcast metronome.
   */
  isRoomMaster(): boolean {
    return this.isMaster;
  }

  /**
   * Leave the room and disconnect all connections.
   * Alias for disconnect() for API compatibility.
   */
  async leaveRoom(): Promise<void> {
    return this.disconnect();
  }

  async disconnect(): Promise<void> {
    this.stopClockBroadcast();
    this.stopPerformanceBroadcast();

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Stop all local tracks
    for (const [trackId, transceiver] of this.transceivers) {
      transceiver.sender.track?.stop();
    }
    this.localTracks.clear();
    this.transceivers.clear();

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Cleanup sync components
    this.clockSync.reset();
    this.latencyCompensator.dispose();

    // Notify server
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
        console.warn('Failed to close session on server:', error);
      }
    }

    this.sessionId = null;
    this.remoteStreams.clear();
    this.remoteTracks.clear();
    this.participantPerformanceData.clear();
  }
}

/**
 * Latency optimization summary:
 * - SDP ptime=10: Saves ~10ms per direction (20ms round-trip)
 * - FEC, DTX, CBR settings: Configurable via quality presets
 * - Data channel: ordered=false, maxRetransmits=0 for lowest latency
 * - ICE restart: Automatic recovery on connection failure
 * - playoutDelayHint=0: Request minimum playout buffer
 * - getUserMedia latency: 0 hint
 * - Aggressive jitter buffer mode
 * - Effect chain bypass optimization
 */

// Factory function to create Cloudflare Calls instance
export function createCloudflareCalls(roomId: string, userId: string): CloudflareCalls {
  return new CloudflareCalls(roomId, userId);
}
