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
import { ConnectionStatus } from '../audio/connection-status';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Settings,
  LogOut,
  Users,
  Music2,
  Sliders,
  Mic,
  MicOff,
} from 'lucide-react';
import type { BackingTrack, StemType } from '@/types';
import type { SunoGenerationConfig, SunoGenerationProgress } from '@/lib/ai/suno';
import type { SAMProgress } from '@/lib/ai/sam';

interface StudioLayoutProps {
  roomId: string;
}

export function StudioLayout({ roomId }: StudioLayoutProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'queue' | 'mixer'>('users');
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<SunoGenerationProgress | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);

  const {
    users,
    currentUser,
    isMaster,
    queue,
    currentTrack,
    isConnected,
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

  const handleTrackSelect = useCallback(async (track: BackingTrack) => {
    // Load and select track
    useRoomStore.getState().setCurrentTrack(track);
  }, []);

  const handleUpload = useCallback(async (file: File, metadata: { name: string; artist?: string }) => {
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', metadata.name);
    if (metadata.artist) {
      formData.append('artist', metadata.artist);
    }
    formData.append('roomId', roomId);

    // Upload to API
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

      // Poll for progress
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
          // Update track with stems
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

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">OpenStudio</h1>
            <div className="h-4 w-px bg-gray-700" />
            <span className="text-sm text-gray-400">Room: {roomId}</span>
            <ConnectionStatus />
          </div>

          <div className="flex items-center gap-4">
            {/* Mute toggle */}
            <Button
              variant={isMuted ? 'danger' : 'ghost'}
              size="icon"
              onClick={() => setMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>

            <Button variant="outline" size="sm" onClick={leave}>
              <LogOut className="w-4 h-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left sidebar - Users/Queue/Mixer tabs */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <Card variant="elevated" className="sticky top-24">
              {/* Tab buttons */}
              <div className="flex border-b border-gray-700 mb-4">
                <button
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                    activeTab === 'users'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Users className="w-4 h-4" />
                  Users ({users.length})
                </button>
                <button
                  onClick={() => setActiveTab('queue')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                    activeTab === 'queue'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Music2 className="w-4 h-4" />
                  Queue
                </button>
                <button
                  onClick={() => setActiveTab('mixer')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                    activeTab === 'mixer'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  <Sliders className="w-4 h-4" />
                  Mixer
                </button>
              </div>

              {/* Tab content */}
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
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
            </Card>
          </div>

          {/* Main content - Transport and waveform */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
            <Card variant="elevated" className="p-8">
              <TransportControls
                onPlay={play}
                onPause={pause}
                onSeek={seek}
                onNext={skipToNext}
                onPrevious={() => {}}
              />
            </Card>

            {/* Connection stats */}
            <Card variant="bordered" className="mt-6">
              <ConnectionStatus showDetails />
            </Card>
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
    </div>
  );
}
