// Cloudflare Calls (Realtime) integration for WebRTC SFU
// This provides ultra-low latency audio streaming via Cloudflare's edge network
// API Reference: https://developers.cloudflare.com/calls/https-api/

import type { CloudflareSession, WebRTCStats } from '@/types';

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

export class CloudflareCalls {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private sessionId: string | null = null;
  private roomId: string;
  private userId: string;
  private localTrackName: string;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private onStatsUpdate: ((stats: WebRTCStats) => void) | null = null;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemoved: ((userId: string) => void) | null = null;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.localTrackName = `audio-${userId}`;
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
        // Extract user ID from track label/id
        const trackId = event.track.label || event.track.id;
        console.log('Received remote track:', trackId);

        // Parse userId from trackName format: "audio-{userId}"
        const match = trackId.match(/audio-(.+)/);
        const remoteUserId = match ? match[1] : trackId;

        this.remoteStreams.set(remoteUserId, stream);
        this.onRemoteStream?.(remoteUserId, stream);
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

  async joinRoom(stream: MediaStream): Promise<CloudflareSession> {
    if (!this.peerConnection) {
      throw new Error('PeerConnection not initialized');
    }

    this.localStream = stream;

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

    // Step 2: Add local audio track to the peer connection
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('No audio track in stream');
    }

    // Add transceiver for sending audio
    const transceiver = this.peerConnection.addTransceiver(audioTrack, {
      direction: 'sendrecv',
      streams: [stream],
    });

    // Step 3: Create offer with local tracks
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete (or timeout)
    await this.waitForIceGathering();

    const localDescription = this.peerConnection.localDescription;
    if (!localDescription) {
      throw new Error('No local description after ICE gathering');
    }

    // Step 4: Push local track to Cloudflare via our backend
    const pushResponse = await fetch('/api/cloudflare/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pushTrack',
        sessionId: this.sessionId,
        roomId: this.roomId,
        trackName: this.localTrackName,
        sdp: localDescription.sdp,
        mid: transceiver.mid,
      }),
    });

    if (!pushResponse.ok) {
      const error = await pushResponse.text();
      throw new Error(`Failed to push track: ${error}`);
    }

    const pushData = await pushResponse.json();
    console.log('Push track response:', pushData);

    // Step 5: Set the answer from Cloudflare
    if (pushData.sdp) {
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: pushData.sdp,
      });
    }

    return {
      sessionId: this.sessionId!,
      tracks: pushData.tracks || [],
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
      await this.peerConnection.setLocalDescription(offer);
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

  async muteTrack(muted: boolean): Promise<void> {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getLocalTrackName(): string {
    return this.localTrackName;
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

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.remoteStreams.clear();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.sessionId = null;
  }
}

// Factory function to create Cloudflare Calls instance
export function createCloudflareCalls(roomId: string, userId: string): CloudflareCalls {
  return new CloudflareCalls(roomId, userId);
}
