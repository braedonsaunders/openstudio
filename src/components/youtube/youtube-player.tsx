'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Video, VideoOff, Youtube, Music2, Loader2 } from 'lucide-react';

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
  getAudioElement: () => HTMLAudioElement | null;
}

interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
  onStateChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: string) => void;
  onDurationChange?: (duration: number) => void;
  onAudioElementReady?: (audioElement: HTMLAudioElement) => void;
  onEnded?: () => void;
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

interface AudioStreamInfo {
  audioUrl: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
}

async function fetchAudioStream(videoId: string): Promise<AudioStreamInfo | null> {
  try {
    const response = await fetch(`/api/youtube/audio?videoId=${videoId}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.useAudioElement && data.audioUrl) {
      return {
        audioUrl: data.audioUrl,
        title: data.title,
        author: data.author,
        duration: data.duration,
        thumbnailUrl: data.thumbnailUrl,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch audio stream:', error);
    return null;
  }
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
      onAudioElementReady,
      onEnded,
      autoPlay = false,
      volume = 70,
      className,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playerIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [isReady, setIsReady] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [useAudioElement, setUseAudioElement] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [audioStreamInfo, setAudioStreamInfo] = useState<AudioStreamInfo | null>(null);

    // Expose player controls via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        if (useAudioElement && audioRef.current) {
          audioRef.current.play();
        } else {
          playerRef.current?.playVideo();
        }
      },
      pause: () => {
        if (useAudioElement && audioRef.current) {
          audioRef.current.pause();
        } else {
          playerRef.current?.pauseVideo();
        }
      },
      seek: (time: number) => {
        if (useAudioElement && audioRef.current) {
          audioRef.current.currentTime = time;
        } else {
          playerRef.current?.seekTo(time, true);
        }
      },
      getCurrentTime: () => {
        if (useAudioElement && audioRef.current) {
          return audioRef.current.currentTime;
        }
        return playerRef.current?.getCurrentTime() || 0;
      },
      getDuration: () => {
        if (useAudioElement && audioRef.current) {
          return audioRef.current.duration || 0;
        }
        return playerRef.current?.getDuration() || 0;
      },
      setVolume: (vol: number) => {
        if (useAudioElement && audioRef.current) {
          audioRef.current.volume = vol;
        } else {
          playerRef.current?.setVolume(vol * 100);
        }
      },
      isReady: () => isReady,
      getAudioElement: () => audioRef.current,
    }));

    // Try to fetch audio stream first, fallback to iframe
    useEffect(() => {
      let mounted = true;
      setIsLoading(true);
      setIsReady(false);

      const init = async () => {
        // Try to get audio stream URL
        const streamInfo = await fetchAudioStream(videoId);

        if (!mounted) return;

        if (streamInfo) {
          console.log('Using audio element for YouTube playback');
          setAudioStreamInfo(streamInfo);
          setUseAudioElement(true);
          setIsLoading(false);
        } else {
          console.log('Falling back to YouTube IFrame player');
          setUseAudioElement(false);
          await initIframePlayer();
        }
      };

      const initIframePlayer = async () => {
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
              setIsLoading(false);
              event.target.setVolume(volume);
              const duration = event.target.getDuration();
              onDurationChange?.(duration);
              onReady?.();
            },
            onStateChange: (event) => {
              if (!mounted) return;
              const playing = event.data === window.YT.PlayerState.PLAYING;
              const ended = event.data === window.YT.PlayerState.ENDED;
              setIsPlaying(playing);
              onStateChange?.(playing);

              // Fire onEnded callback when video ends
              if (ended) {
                onEnded?.();
              }

              // Start/stop time updates based on play state
              if (playing && !timeUpdateIntervalRef.current) {
                timeUpdateIntervalRef.current = setInterval(() => {
                  if (playerRef.current) {
                    const currentTime = playerRef.current.getCurrentTime();
                    const duration = playerRef.current.getDuration();
                    onTimeUpdate?.(currentTime, duration);
                  }
                }, 50);
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

      init();

      return () => {
        mounted = false;
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
        playerRef.current?.destroy();
        playerRef.current = null;
        audioRef.current = null;
      };
    }, [videoId]);

    // Handle audio element setup
    useEffect(() => {
      if (!useAudioElement || !audioStreamInfo) return;

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = audioStreamInfo.audioUrl;
      audio.volume = volume / 100;
      audioRef.current = audio;

      const handleCanPlay = () => {
        setIsReady(true);
        onDurationChange?.(audio.duration);
        onReady?.();
        onAudioElementReady?.(audio);
        if (autoPlay) {
          audio.play().catch(console.error);
        }
      };

      const handlePlay = () => {
        setIsPlaying(true);
        onStateChange?.(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
        onStateChange?.(false);
      };

      const handleTimeUpdate = () => {
        onTimeUpdate?.(audio.currentTime, audio.duration);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        onStateChange?.(false);
        onEnded?.();
      };

      const handleError = () => {
        console.error('Audio element error:', audio.error);
        onError?.('Failed to load audio stream');
        // Could fallback to iframe here if needed
      };

      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.pause();
        audio.src = '';
      };
    }, [useAudioElement, audioStreamInfo, volume, autoPlay, onReady, onStateChange, onTimeUpdate, onDurationChange, onError, onEnded, onAudioElementReady]);

    // Update volume when prop changes
    useEffect(() => {
      if (!isReady) return;

      if (useAudioElement && audioRef.current) {
        audioRef.current.volume = volume / 100;
      } else if (playerRef.current) {
        playerRef.current.setVolume(volume);
      }
    }, [volume, isReady, useAudioElement]);

    return (
      <div className={cn('relative', className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {useAudioElement ? (
              <Music2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Youtube className="w-4 h-4 text-red-500" />
            )}
            <span>{useAudioElement ? 'Audio Stream' : 'YouTube'}</span>
            {isPlaying && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Playing
              </span>
            )}
          </div>
          {!useAudioElement && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVideo(!showVideo)}
              className="h-7 gap-1.5 text-xs"
            >
              {showVideo ? (
                <>
                  <VideoOff className="w-3.5 h-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Video className="w-3.5 h-3.5" />
                  Show
                </>
              )}
            </Button>
          )}
        </div>

        {/* Thumbnail for audio mode */}
        {useAudioElement && audioStreamInfo?.thumbnailUrl && (
          <div className="relative rounded-lg overflow-hidden bg-black/50 mb-2">
            <img
              src={audioStreamInfo.thumbnailUrl}
              alt="Video thumbnail"
              className="w-full h-auto opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {isPlaying ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-emerald-500 rounded-full animate-pulse"
                      style={{
                        height: `${12 + Math.random() * 12}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Music2 className="w-8 h-8 text-white/80" />
              )}
            </div>
          </div>
        )}

        {/* IFrame player container */}
        {!useAudioElement && (
          <div
            ref={containerRef}
            className={cn(
              'relative overflow-hidden rounded-xl bg-black transition-all duration-300',
              showVideo ? 'aspect-video opacity-100' : 'h-0 opacity-0'
            )}
            style={{
              ...(showVideo ? {} : { position: 'absolute', width: 1, height: 1, overflow: 'hidden' }),
            }}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        )}
      </div>
    );
  }
);
