'use client';

import { cn } from '@/lib/utils';
import { StemMixerPanel } from './stem-mixer-panel';
import { QueuePanel } from './queue-panel';
import { AnalysisPanel } from './analysis-panel';
import { ChatPanel } from './chat-panel';
import { AIPanel } from './ai-panel';
import type { PanelType } from './daw-layout';
import type { BackingTrack, StemType } from '@/types';
import {
  Sliders,
  ListMusic,
  Activity,
  MessageSquare,
  Sparkles,
  X,
  ChevronLeft,
} from 'lucide-react';

interface PanelDockProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  onClose: () => void;
  // Queue props
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onYouTubeSearch: () => void;
  youtubePlayer?: React.ReactNode;
  // Mixer props
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onSeparateTrack: () => void;
  isSeparating: boolean;
  separationProgress: number;
  // Chat props
  roomId: string;
  onSendMessage: (message: string) => void;
  // Layout props
  width?: number;
}

const panels: { id: PanelType; icon: typeof Sliders; label: string }[] = [
  { id: 'mixer', icon: Sliders, label: 'Mixer' },
  { id: 'queue', icon: ListMusic, label: 'Queue' },
  { id: 'analysis', icon: Activity, label: 'Analysis' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'ai', icon: Sparkles, label: 'AI' },
];

export function PanelDock({
  activePanel,
  onPanelChange,
  onClose,
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onYouTubeSearch,
  youtubePlayer,
  onToggleStem,
  onStemVolumeChange,
  onSeparateTrack,
  isSeparating,
  separationProgress,
  roomId,
  onSendMessage,
  width,
}: PanelDockProps) {
  // Navigate to AI panel when AI button is clicked
  const handleOpenAIPanel = () => onPanelChange('ai');
  return (
    <div
      className="bg-gray-50 dark:bg-[#0d0d14] border-l border-gray-200 dark:border-white/5 flex flex-col shrink-0 z-10 panel-slide-right"
      style={{ width: width ? `${width}px` : '320px' }}
    >
      {/* Tab Header */}
      <div className="h-12 flex items-center border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a]">
        <div className="flex-1 flex items-center gap-1 px-2">
          {panels.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onPanelChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                activePanel === id
                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/5'
              )}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="p-2 mr-2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg transition-colors"
          title="Close panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden relative">
        {activePanel === 'mixer' && (
          <StemMixerPanel
            onToggleStem={onToggleStem}
            onStemVolumeChange={onStemVolumeChange}
            onSeparateTrack={onSeparateTrack}
            isSeparating={isSeparating}
            separationProgress={separationProgress}
          />
        )}

        {/* Queue panel - always render but hide when not active to keep YouTube player mounted */}
        <div className={cn(
          'h-full',
          activePanel !== 'queue' && 'hidden'
        )}>
          <QueuePanel
            onTrackSelect={onTrackSelect}
            onTrackRemove={onTrackRemove}
            onUpload={onUpload}
            onAIGenerate={handleOpenAIPanel}
            onYouTubeSearch={onYouTubeSearch}
            youtubePlayer={youtubePlayer}
          />
        </div>

        {activePanel === 'analysis' && (
          <AnalysisPanel />
        )}

        {activePanel === 'chat' && (
          <ChatPanel roomId={roomId} onSendMessage={onSendMessage} />
        )}

        {activePanel === 'ai' && (
          <AIPanel
            onSeparateTrack={onSeparateTrack}
            isSeparating={isSeparating}
            separationProgress={separationProgress}
            roomId={roomId}
          />
        )}
      </div>
    </div>
  );
}
