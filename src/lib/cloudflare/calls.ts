// Cloudflare Calls integration for WebRTC SFU
// This provides ultra-low latency audio streaming via Cloudflare's edge network

import type { CloudflareSession, CloudflareTrack, WebRTCStats } from '@/types';

const CLOUDFLARE_CALLS_URL = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_URL || '';
const CLOUDFLARE_CALLS_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID || '';

interface CallsConfig {
  iceServers: RTCIceServer[];
  sdpSemantics: 'unified-plan';
  bundlePolicy: 'max-bundle';
}

const defaultConfig: CallsConfig = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
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
  private statsInterval: NodeJS.Timeout | null = null;
  private onStatsUpdate: ((stats: WebRTCStats) => void) | null = null;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private onRemoteStreamRemoved: ((userId: string) => void) | null = null;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async initialize(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(defaultConfig);

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        // Extract user ID from track metadata (set via Cloudflare)
        const userId = event.track.id.split('-')[0] || 'unknown';
        this.remoteStreams.set(userId, stream);
        this.onRemoteStream?.(userId, stream);
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

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });

    // Create offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(offer);

    // Send offer to Cloudflare Calls API
    const response = await fetch(`${CLOUDFLARE_CALLS_URL}/rooms/${this.roomId}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_CALLS_APP_ID}`,
      },
      body: JSON.stringify({
        userId: this.userId,
        sdp: offer.sdp,
        type: 'offer',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to join room via Cloudflare Calls');
    }

    const data = await response.json();
    this.sessionId = data.sessionId;

    // Set remote description (answer from Cloudflare)
    await this.peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: data.sdp,
    });

    return {
      sessionId: this.sessionId!,
      tracks: data.tracks || [],
    };
  }

  async leaveRoom(): Promise<void> {
    if (this.sessionId) {
      try {
        await fetch(`${CLOUDFLARE_CALLS_URL}/rooms/${this.roomId}/sessions/${this.sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_CALLS_APP_ID}`,
          },
        });
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    }

    this.cleanup();
  }

  private async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.sessionId) return;

    await fetch(`${CLOUDFLARE_CALLS_URL}/rooms/${this.roomId}/sessions/${this.sessionId}/ice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_CALLS_APP_ID}`,
      },
      body: JSON.stringify({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      }),
    });
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

// Factory function to create mock Cloudflare Calls for development
export function createCloudflareCalls(roomId: string, userId: string): CloudflareCalls {
  return new CloudflareCalls(roomId, userId);
}
