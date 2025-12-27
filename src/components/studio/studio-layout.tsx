'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRoom } from '@/hooks/useRoom';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { UserCard } from '../room/user-card';
import { Chat } from '../room/chat';
import { TransportControls } from './transport-controls';
import { StemMixer } from './stem-mixer';
import { TrackQueue } from '../tracks/track-queue';
import { AIGenerator } from '../tracks/ai-generator';
import { UploadModal } from '../tracks/upload-modal';
import { YouTubeSearchModal } from '../tracks/youtube-search-modal';
import { AudioSettingsModal, type AudioSettings } from '../settings/audio-settings-modal';
import { ConnectionStatus } from '../audio/connection-status';
import { Button } from '../ui/button';
import {
  Settings,
  LogOut,
  Users,
  Music2,
  Sliders,
  Mic,
  MicOff,
  Music,
  Copy,
  Check,
} from 'lucide-react';
import type { BackingTrack, StemType } from '@/types';
import type { SunoGenerationConfig, SunoGenerationProgress } from '@/lib/ai/suno';

interface StudioLayoutProps {
  roomId: string;
}

export function StudioLayout({ roomId }: StudioLayoutProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'queue' | 'mixer'>('users');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<SunoGenerationProgress | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings | undefined>();

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
    sendMessage,
    muteUser,
    setUserVolume,
    leave,
  } = useRoom(roomId);

  const { toggleStem, setStemVolume } = useAudioEngine();
  const { audioLevels, toggleStem: storeToggleStem, setStemVolume: storeStemVolume } = useRoomStore();
  const { isMuted, setMuted } = useAudioStore();

  const handleCopyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const handleTrackSelect = useCallback(async (track: BackingTrack) => {
    useRoomStore.getState().setCurrentTrack(track);
  }, []);

  const handleUpload = useCallback(async (file: File, metadata: { name: string; artist?: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', metadata.name);
    if (metadata.artist) {
      formData.append('artist', metadata.artist);
    }
    formData.append('roomId', roomId);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const track = await response.json();
    await addTrack(track);
  }, [roomId, addTrack]);

  const handleYouTubeSelect = useCallback(async (video: { id: string; title: string; channelTitle: string; duration?: string }) => {
    // Get audio URL for the YouTube video
    const response = await fetch(`/api/youtube/audio?videoId=${video.id}`);
    if (!response.ok) {
      throw new Error('Could not load YouTube track');
    }

    const { audioUrl, duration } = await response.json();

    // Parse duration string to seconds
    const parseDuration = (d?: string): number => {
      if (!d) return 0;
      const parts = d.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    const track: BackingTrack = {
      id: video.id,
      name: video.title,
      artist: video.channelTitle,
      duration: duration || parseDuration(video.duration),
      url: audioUrl,
      uploadedBy: 'youtube',
      uploadedAt: new Date().toISOString(),
      youtubeId: video.id,
    };

    await addTrack(track);
  }, [addTrack]);

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
    // Apply settings to audio engine
    // This would be implemented in the audio engine
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-slate-900">OpenStudio</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Room:</span>
              <button
                onClick={handleCopyRoomId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                {roomId}
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
            <ConnectionStatus />
          </div>

          <div className="flex items-center gap-3">
            {/* Mute toggle */}
            <Button
              variant={isMuted ? 'danger' : 'secondary'}
              size="icon"
              onClick={() => setMuted(!isMuted)}
              className="relative"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>

            <Button variant="outline" size="sm" onClick={leave}>
              <LogOut className="w-4 h-4" />
              Leave
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar - Users/Queue/Mixer tabs */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Tab buttons */}
              <div className="flex border-b border-slate-200">
                <TabButton
                  active={activeTab === 'users'}
                  onClick={() => setActiveTab('users')}
                  icon={Users}
                  label={`Users (${users.length})`}
                />
                <TabButton
                  active={activeTab === 'queue'}
                  onClick={() => setActiveTab('queue')}
                  icon={Music2}
                  label="Queue"
                />
                <TabButton
                  active={activeTab === 'mixer'}
                  onClick={() => setActiveTab('mixer')}
                  icon={Sliders}
                  label="Mixer"
                />
              </div>

              {/* Tab content */}
              <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-5">
                {activeTab === 'users' && (
                  <div className="space-y-3">
                    {/* Local user */}
                    {currentUser && (
                      <UserCard
                        user={currentUser}
                        audioLevel={audioLevels.get('local') || 0}
                        isLocal
                        isMaster={isMaster}
                        onMute={(muted) => setMuted(muted)}
                      />
                    )}

                    {/* Remote users */}
                    {users
                      .filter((u) => u.id !== currentUser?.id)
                      .map((user) => (
                        <UserCard
                          key={user.id}
                          user={user}
                          audioLevel={audioLevels.get(user.id) || 0}
                          onMute={(muted) => muteUser(user.id, muted)}
                          onVolumeChange={(volume) => setUserVolume(user.id, volume)}
                        />
                      ))}
                  </div>
                )}

                {activeTab === 'queue' && (
                  <TrackQueue
                    onTrackSelect={handleTrackSelect}
                    onTrackRemove={removeTrack}
                    onUpload={() => setIsUploadModalOpen(true)}
                    onAIGenerate={() => setIsAIModalOpen(true)}
                    onYouTubeSearch={() => setIsYouTubeModalOpen(true)}
                  />
                )}

                {activeTab === 'mixer' && (
                  <StemMixer
                    onToggleStem={handleToggleStem}
                    onStemVolumeChange={handleStemVolume}
                    onSeparateTrack={handleSeparateTrack}
                    isSeparating={isSeparating}
                    separationProgress={separationProgress}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Main content - Transport and waveform */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <TransportControls
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onNext={skipToNext}
                onPrevious={() => {}}
              />
            </div>

            {/* Connection stats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <ConnectionStatus showDetails />
            </div>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="fixed bottom-6 right-6 z-50">
        <Chat onSendMessage={sendMessage} />
      </div>

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

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors',
        active
          ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
