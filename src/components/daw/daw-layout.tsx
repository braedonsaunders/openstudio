'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useRoom } from '@/hooks/useRoom';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { TransportBar } from './transport-bar';
import { TrackHeadersPanel } from './track-headers-panel';
import { ArrangementView } from './arrangement-view';
import { PanelDock } from './panel-dock';
import { BottomDock } from './bottom-dock';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { AIGenerator } from '../tracks/ai-generator';
import { UploadModal } from '../tracks/upload-modal';
import { YouTubeSearchModal } from '../tracks/youtube-search-modal';
import { YouTubePlayer, type YouTubePlayerRef } from '../youtube/youtube-player';
import { AudioSettingsModal, type AudioSettings } from '../settings/audio-settings-modal';
import type { BackingTrack, StemType } from '@/types';
import type { SunoGenerationConfig, SunoGenerationProgress } from '@/lib/ai/suno';

interface DAWLayoutProps {
  roomId: string;
}

export type PanelType = 'mixer' | 'queue' | 'analysis' | 'chat' | 'ai';

export function DAWLayout({ roomId }: DAWLayoutProps) {
  // Panel state
  const [activePanel, setActivePanel] = useState<PanelType>('mixer');
  const [isPanelDockVisible, setIsPanelDockVisible] = useState(true);
  const [isBottomDockVisible, setIsBottomDockVisible] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<SunoGenerationProgress | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [audioSettings, setAudioSettings] = useState<AudioSettings | undefined>();

  // Room hooks
  const {
    users,
    currentUser,
    isMaster,
    currentTrack,
    play,
    pause,
    seek,
    addTrack,
    removeTrack,
    skipToNext,
    skipToPrevious,
    sendMessage,
    muteUser,
    setUserVolume,
    leave,
  } = useRoom(roomId);

  const { toggleStem, setStemVolume, getAudioContext } = useAudioEngine();
  const { audioLevels, toggleStem: storeToggleStem, setStemVolume: storeStemVolume } = useRoomStore();
  const { isMuted, setMuted, isPlaying, setPlaying, setCurrentTime, setDuration, backingTrackVolume } = useAudioStore();

  // Audio analysis - initialize with audio context
  useAudioAnalysis({
    audioContext: getAudioContext(),
    roomId,
    userId: currentUser?.id,
    isMaster,
  });

  // YouTube player ref
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);

  // Check if current track is a YouTube track
  const isYouTubeTrack = !!currentTrack?.youtubeId;

  // YouTube playback controls (defined before keyboard shortcuts that use them)
  const handleYouTubePlay = useCallback(() => {
    youtubePlayerRef.current?.play();
  }, []);

  const handleYouTubePause = useCallback(() => {
    youtubePlayerRef.current?.pause();
  }, []);

  const handleYouTubeSeek = useCallback((time: number) => {
    youtubePlayerRef.current?.seek(time);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isMaster) {
            if (isYouTubeTrack) {
              isPlaying ? handleYouTubePause() : handleYouTubePlay();
            } else {
              isPlaying ? pause() : play();
            }
          }
          break;
        case 'ArrowLeft':
          if (isMaster && currentTrack) {
            const { currentTime } = useAudioStore.getState();
            const newTime = Math.max(0, currentTime - (e.shiftKey ? 30 : 5));
            if (isYouTubeTrack) {
              handleYouTubeSeek(newTime);
            } else {
              seek(newTime);
            }
          }
          break;
        case 'ArrowRight':
          if (isMaster && currentTrack) {
            const { currentTime, duration } = useAudioStore.getState();
            const newTime = Math.min(duration, currentTime + (e.shiftKey ? 30 : 5));
            if (isYouTubeTrack) {
              handleYouTubeSeek(newTime);
            } else {
              seek(newTime);
            }
          }
          break;
        case '[':
          if (isMaster) skipToPrevious();
          break;
        case ']':
          if (isMaster) skipToNext();
          break;
        case 'm':
        case 'M':
          setMuted(!isMuted);
          break;
        case 'q':
        case 'Q':
          setActivePanel('queue');
          break;
        case 'a':
        case 'A':
          setActivePanel('analysis');
          break;
        case 'c':
        case 'C':
          setActivePanel('chat');
          break;
        case '?':
          setShowShortcuts(true);
          break;
        case 'Escape':
          setShowShortcuts(false);
          break;
        case 'Tab':
          if (!e.shiftKey) {
            e.preventDefault();
            const panels: PanelType[] = ['mixer', 'queue', 'analysis', 'chat', 'ai'];
            const currentIndex = panels.indexOf(activePanel);
            setActivePanel(panels[(currentIndex + 1) % panels.length]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaster, isPlaying, isMuted, currentTrack, activePanel, play, pause, seek, setMuted, skipToNext, skipToPrevious, isYouTubeTrack, handleYouTubePlay, handleYouTubePause, handleYouTubeSeek]);

  // Handler functions
  const handleTrackSelect = useCallback(async (track: BackingTrack) => {
    useRoomStore.getState().setCurrentTrack(track);
  }, []);

  const handleUpload = useCallback(async (uploadedTrack: { id: string; name: string; artist?: string; url: string; duration: number }) => {
    // UploadModal handles the actual upload to R2, we just add the track
    const track: BackingTrack = {
      id: uploadedTrack.id,
      name: uploadedTrack.name,
      artist: uploadedTrack.artist,
      duration: uploadedTrack.duration,
      url: uploadedTrack.url,
      uploadedBy: 'user',
      uploadedAt: new Date().toISOString(),
    };
    await addTrack(track);
  }, [addTrack]);

  const handleYouTubeSelect = useCallback(async (video: { id: string; title: string; channelTitle: string; duration?: string }) => {
    // Parse duration string to seconds
    const parseDuration = (d?: string): number => {
      if (!d) return 0;
      const parts = d.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    // Create track with YouTube ID - playback will use YouTube IFrame API
    const track: BackingTrack = {
      id: video.id,
      name: video.title,
      artist: video.channelTitle,
      duration: parseDuration(video.duration),
      url: '', // No URL needed - YouTube player handles playback
      uploadedBy: 'youtube',
      uploadedAt: new Date().toISOString(),
      youtubeId: video.id,
    };

    await addTrack(track);
    setIsYouTubeModalOpen(false);
  }, [addTrack]);

  // YouTube player event handlers
  const handleYouTubeReady = useCallback(() => {
    if (youtubePlayerRef.current) {
      const duration = youtubePlayerRef.current.getDuration();
      if (duration > 0) setDuration(duration);
    }
  }, [setDuration]);

  const handleYouTubeStateChange = useCallback((playing: boolean) => {
    setPlaying(playing);
  }, [setPlaying]);

  const handleYouTubeTimeUpdate = useCallback((time: number, dur: number) => {
    setCurrentTime(time);
    if (dur > 0) setDuration(dur);
  }, [setCurrentTime, setDuration]);

  const handleYouTubeDurationChange = useCallback((duration: number) => {
    if (duration > 0) setDuration(duration);
  }, [setDuration]);

  const handleAIGenerate = useCallback(async (config: SunoGenerationConfig) => {
    setIsGenerating(true);
    setGenerationProgress({ stage: 'queued', progress: 0, message: 'Starting generation...' });

    try {
      const response = await fetch('/api/suno/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, roomId }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const { generationId } = await response.json();
      let complete = false;

      while (!complete) {
        await new Promise((r) => setTimeout(r, 2000));

        const statusRes = await fetch(`/api/suno/status/${generationId}`);
        const status = await statusRes.json();

        setGenerationProgress({
          stage: status.stage,
          progress: status.progress,
          message: status.message,
          estimatedTimeRemaining: status.estimatedTimeRemaining,
        });

        if (status.stage === 'complete') {
          complete = true;
          await addTrack(status.track);
        } else if (status.stage === 'error') {
          throw new Error(status.message);
        }
      }

      setIsAIModalOpen(false);
    } catch (error) {
      setGenerationProgress({
        stage: 'error',
        progress: 0,
        message: (error as Error).message,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [roomId, addTrack]);

  const handleSeparateTrack = useCallback(async () => {
    if (!currentTrack) return;

    setIsSeparating(true);
    setSeparationProgress(0);

    try {
      const response = await fetch('/api/sam/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: currentTrack.id,
          trackUrl: currentTrack.url,
        }),
      });

      if (!response.ok) {
        throw new Error('Separation failed');
      }

      const { jobId } = await response.json();
      let complete = false;

      while (!complete) {
        await new Promise((r) => setTimeout(r, 1000));

        const statusRes = await fetch(`/api/sam/status/${jobId}`);
        const status = await statusRes.json();

        setSeparationProgress(status.progress);

        if (status.status === 'completed') {
          complete = true;
          useRoomStore.getState().setCurrentTrack({
            ...currentTrack,
            stems: status.stems,
          });
          useRoomStore.getState().setStemsAvailable(true);
        } else if (status.status === 'failed') {
          throw new Error(status.error);
        }
      }
    } catch (error) {
      console.error('Separation failed:', error);
    } finally {
      setIsSeparating(false);
    }
  }, [currentTrack]);

  const handleToggleStem = useCallback((stem: StemType, enabled: boolean) => {
    toggleStem(stem, enabled);
    storeToggleStem(stem as 'vocals' | 'drums' | 'bass' | 'other');
  }, [toggleStem, storeToggleStem]);

  const handleStemVolume = useCallback((stem: StemType, volume: number) => {
    setStemVolume(stem, volume);
    storeStemVolume(stem as 'vocals' | 'drums' | 'bass' | 'other', volume);
  }, [setStemVolume, storeStemVolume]);

  const handleSettingsChange = useCallback((settings: AudioSettings) => {
    setAudioSettings(settings);
  }, []);

  return (
    <div className="daw-theme h-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden">
      {/* Transport Bar - Fixed Top */}
      <TransportBar
        roomId={roomId}
        onPlay={isYouTubeTrack ? handleYouTubePlay : play}
        onPause={isYouTubeTrack ? handleYouTubePause : pause}
        onSeek={isYouTubeTrack ? handleYouTubeSeek : seek}
        onPrevious={skipToPrevious}
        onNext={skipToNext}
        onMuteToggle={() => setMuted(!isMuted)}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        onLeave={leave}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Track Headers Panel - Left */}
        <TrackHeadersPanel
          users={users}
          currentUser={currentUser}
          audioLevels={audioLevels}
          isMaster={isMaster}
          onMuteUser={muteUser}
          onVolumeChange={setUserVolume}
          onMuteSelf={() => setMuted(!isMuted)}
        />

        {/* Arrangement View - Center */}
        <ArrangementView
          users={users}
          currentUser={currentUser}
          audioLevels={audioLevels}
          isMaster={isMaster}
          onSeek={isYouTubeTrack ? handleYouTubeSeek : seek}
        />

        {/* Panel Dock - Right */}
        {isPanelDockVisible && (
          <PanelDock
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            onClose={() => setIsPanelDockVisible(false)}
            // Queue props
            onTrackSelect={handleTrackSelect}
            onTrackRemove={removeTrack}
            onUpload={() => setIsUploadModalOpen(true)}
            onAIGenerate={() => setIsAIModalOpen(true)}
            onYouTubeSearch={() => setIsYouTubeModalOpen(true)}
            youtubePlayer={
              isYouTubeTrack && currentTrack?.youtubeId ? (
                <YouTubePlayer
                  ref={youtubePlayerRef}
                  videoId={currentTrack.youtubeId}
                  onReady={handleYouTubeReady}
                  onStateChange={handleYouTubeStateChange}
                  onTimeUpdate={handleYouTubeTimeUpdate}
                  onDurationChange={handleYouTubeDurationChange}
                  volume={backingTrackVolume * 100}
                />
              ) : undefined
            }
            // Mixer props
            onToggleStem={handleToggleStem}
            onStemVolumeChange={handleStemVolume}
            onSeparateTrack={handleSeparateTrack}
            isSeparating={isSeparating}
            separationProgress={separationProgress}
            // Chat props
            onSendMessage={sendMessage}
          />
        )}
      </div>

      {/* Bottom Dock (Collapsible) */}
      {isBottomDockVisible && (
        <BottomDock
          onClose={() => setIsBottomDockVisible(false)}
        />
      )}

      {/* Panel Toggle Button (when dock is hidden) */}
      {!isPanelDockVisible && (
        <button
          onClick={() => setIsPanelDockVisible(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 glass-panel rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Show panel dock"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}

      {/* Modals */}
      <AIGenerator
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerate={handleAIGenerate}
        isGenerating={isGenerating}
        progress={generationProgress}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />

      <YouTubeSearchModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onSelectTrack={handleYouTubeSelect}
        currentTrackId={currentTrack?.youtubeId}
      />

      <AudioSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsChange={handleSettingsChange}
        currentSettings={audioSettings}
      />

    </div>
  );
}
