'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Video, VideoOff, Youtube } from 'lucide-react';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  destroy: () => void;
}

export interface YouTubePlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  isReady: () => boolean;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: string) => void;
  onDurationChange?: (duration: number) => void;
  autoPlay?: boolean;
  volume?: number;
  className?: string;
}

// Load YouTube IFrame API script
let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  apiLoadPromise = new Promise((resolve) => {
    const existingScript = document.getElementById('youtube-iframe-api');
    if (existingScript) {
      if (window.YT && window.YT.Player) {
        resolve();
      } else {
        window.onYouTubeIframeAPIReady = () => resolve();
      }
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();

    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  function YouTubePlayer(
    {
      videoId,
      onReady,
      onStateChange,
      onTimeUpdate,
      onError,
      onDurationChange,
      autoPlay = false,
      volume = 70,
      className,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const playerIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Expose player controls via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        playerRef.current?.playVideo();
      },
      pause: () => {
        playerRef.current?.pauseVideo();
      },
      seek: (time: number) => {
        playerRef.current?.seekTo(time, true);
      },
      getCurrentTime: () => {
        return playerRef.current?.getCurrentTime() || 0;
      },
      getDuration: () => {
        return playerRef.current?.getDuration() || 0;
      },
      setVolume: (vol: number) => {
        playerRef.current?.setVolume(vol * 100);
      },
      isReady: () => isReady,
    }));

    // Initialize player
    useEffect(() => {
      let mounted = true;

      const initPlayer = async () => {
        await loadYouTubeAPI();

        if (!mounted || !containerRef.current) return;

        // Create player element
        const playerElement = document.createElement('div');
        playerElement.id = playerIdRef.current;
        containerRef.current.appendChild(playerElement);

        playerRef.current = new window.YT.Player(playerIdRef.current, {
          videoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (!mounted) return;
              setIsReady(true);
              event.target.setVolume(volume);
              const duration = event.target.getDuration();
              onDurationChange?.(duration);
              onReady?.();
            },
            onStateChange: (event) => {
              if (!mounted) return;
              const playing = event.data === window.YT.PlayerState.PLAYING;
              setIsPlaying(playing);
              onStateChange?.(playing);

              // Start/stop time updates based on play state
              if (playing && !timeUpdateIntervalRef.current) {
                timeUpdateIntervalRef.current = setInterval(() => {
                  if (playerRef.current) {
                    const currentTime = playerRef.current.getCurrentTime();
                    const duration = playerRef.current.getDuration();
                    onTimeUpdate?.(currentTime, duration);
                  }
                }, 250);
              } else if (!playing && timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
                timeUpdateIntervalRef.current = null;
              }
            },
            onError: (event) => {
              if (!mounted) return;
              const errorMessages: Record<number, string> = {
                2: 'Invalid video ID',
                5: 'HTML5 player error',
                100: 'Video not found or private',
                101: 'Video cannot be embedded',
                150: 'Video cannot be embedded',
              };
              onError?.(errorMessages[event.data] || 'Unknown error');
            },
          },
        });
      };

      initPlayer();

      return () => {
        mounted = false;
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId]);

    // Update volume when prop changes
    useEffect(() => {
      if (isReady && playerRef.current) {
        playerRef.current.setVolume(volume);
      }
    }, [volume, isReady]);

    return (
      <div className={cn('relative', className)}>
        {/* Toggle button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Youtube className="w-4 h-4 text-red-500" />
            <span>YouTube Player</span>
            {isPlaying && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Playing
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVideo(!showVideo)}
            className="h-8 gap-1.5"
          >
            {showVideo ? (
              <>
                <VideoOff className="w-4 h-4" />
                Hide Video
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                Show Video
              </>
            )}
          </Button>
        </div>

        {/* Player container */}
        <div
          ref={containerRef}
          className={cn(
            'relative overflow-hidden rounded-xl bg-black transition-all duration-300',
            showVideo ? 'aspect-video opacity-100' : 'h-0 opacity-0'
          )}
          style={{
            // When hidden, make it tiny but keep it functional
            ...(showVideo ? {} : { position: 'absolute', width: 1, height: 1, overflow: 'hidden' }),
          }}
        />

        {/* Loading indicator */}
        {!isReady && (
          <div className="flex items-center justify-center py-4 text-sm text-slate-400">
            Loading YouTube player...
          </div>
        )}
      </div>
    );
  }
);
