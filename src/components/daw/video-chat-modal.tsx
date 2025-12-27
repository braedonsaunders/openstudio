'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';

interface VideoChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  userName: string;
}

interface PeerConnection {
  peerId: string;
  peerName: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

// Simple signaling server connection (uses the room's realtime channel)
export function VideoChatModal({ isOpen, onClose, roomId, userId, userName }: VideoChatModalProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
      return null;
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Start video call (join room)
  const startCall = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const stream = await initializeMedia();
      if (stream) {
        setIsConnected(true);
        // Note: In a full implementation, this would use the room's realtime
        // channel to signal peer connections. For now, it just shows local video.
      }
    } catch (err) {
      setError('Failed to start video chat');
    } finally {
      setIsConnecting(false);
    }
  }, [initializeMedia]);

  // End video call
  const endCall = useCallback(() => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Close peer connections
    peers.forEach((peer) => {
      peer.connection.close();
    });
    setPeers(new Map());

    setIsConnected(false);
  }, [localStream, peers]);

  // Handle close
  const handleClose = useCallback(() => {
    endCall();
    onClose();
  }, [endCall, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        ref={containerRef}
        className={cn(
          'relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col',
          isFullscreen ? 'w-full h-full rounded-none' : 'w-[800px] max-w-[90vw] h-[600px] max-h-[80vh]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-medium text-white">Video Chat</span>
            {isConnected && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded-full">
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-gray-950">
          {!isConnected ? (
            // Pre-call state
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Video className="w-10 h-10 text-indigo-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-white mb-2">Start Video Chat</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Connect with other musicians in the room via video. Your camera and microphone will be used.
                </p>
              </div>
              {error && (
                <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <button
                onClick={startCall}
                disabled={isConnecting}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                  isConnecting
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'neon-button text-white'
                )}
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    <span>Join Video Chat</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500">
                Video is separate from the low-latency audio connection
              </p>
            </div>
          ) : (
            // In-call state
            <div className="h-full flex flex-col">
              {/* Main video grid */}
              <div className="flex-1 grid grid-cols-1 gap-2 p-2">
                {/* Local video */}
                <div className="relative bg-gray-800 rounded-xl overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      'w-full h-full object-cover',
                      !isVideoEnabled && 'hidden'
                    )}
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-lg">
                    <span className="text-xs font-medium text-white">{userName} (You)</span>
                  </div>
                  {!isAudioEnabled && (
                    <div className="absolute top-3 right-3 p-1.5 bg-red-500/80 rounded-lg">
                      <MicOff className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Remote videos would go here */}
                {Array.from(peers.entries()).map(([peerId, peer]) => (
                  <div key={peerId} className="relative bg-gray-800 rounded-xl overflow-hidden">
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && peer.stream) el.srcObject = peer.stream;
                      }}
                    />
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-lg">
                      <span className="text-xs font-medium text-white">{peer.peerName}</span>
                    </div>
                  </div>
                ))}

                {/* Waiting for others message */}
                {peers.size === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-sm text-gray-400">Waiting for others to join...</p>
                      <p className="text-xs text-gray-500 mt-1">Share the room to invite musicians</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {isConnected && (
          <div className="flex items-center justify-center gap-3 px-4 py-4 bg-gray-800/80 border-t border-white/10">
            <button
              onClick={toggleAudio}
              className={cn(
                'p-4 rounded-full transition-colors',
                isAudioEnabled
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              )}
              title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleVideo}
              className={cn(
                'p-4 rounded-full transition-colors',
                isVideoEnabled
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              )}
              title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="End call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
