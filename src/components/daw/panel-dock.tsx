'use client';

import { cn } from '@/lib/utils';
import { EnhancedRoomUsersPanel } from './room-users-panel-enhanced';
import { AnalysisPanel } from './analysis-panel';
import { ChatPanel } from './chat-panel';
import { AIPanel } from './ai-panel';
import { SetlistPanel } from './setlist-panel';
import type { PanelType } from './daw-layout';
import type { StemType, User, QualityPresetName, OpusEncodingSettings } from '@/types';
import {
  Users,
  Activity,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  Music2,
} from 'lucide-react';

interface PanelDockProps {
  activePanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
  onClose: () => void;
  // Mixer props
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  // Chat/Room props
  roomId: string;
  userId: string;
  userName?: string;
  onSendMessage: (message: string) => void;
  // Room users props
  users: User[];
  currentUser: User | null;
  isMaster: boolean;
  audioLevels: Map<string, number>;
  onMuteUser?: (userId: string, muted: boolean) => void;
  onVolumeChange?: (userId: string, volume: number) => void;
  // Quality/latency settings props
  onPresetChange?: (preset: QualityPresetName) => void;
  onCustomSettingsChange?: (settings: Partial<OpusEncodingSettings>) => void;
  onJitterModeChange?: (mode: 'live-jamming' | 'balanced' | 'stable') => void;
  onLowLatencyModeChange?: (enabled: boolean) => void;
  onAcceptOptimization?: (type: string) => void;
  onDismissOptimization?: (type: string) => void;
  // Layout props
  width?: number;
}

const panels: { id: PanelType; icon: typeof Users; label: string }[] = [
  { id: 'users', icon: Users, label: 'Members' },
  { id: 'setlist', icon: Music2, label: 'Setlist' },
  { id: 'analysis', icon: Activity, label: 'Analysis' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'ai', icon: Sparkles, label: 'AI' },
];

export function PanelDock({
  activePanel,
  onPanelChange,
  onClose,
  onToggleStem,
  onStemVolumeChange,
  roomId,
  userId,
  userName,
  onSendMessage,
  users,
  currentUser,
  isMaster,
  audioLevels,
  onMuteUser,
  onVolumeChange,
  onPresetChange,
  onCustomSettingsChange,
  onJitterModeChange,
  onLowLatencyModeChange,
  onAcceptOptimization,
  onDismissOptimization,
  width,
}: PanelDockProps) {
  // Redirect old panel types to new ones
  const validPanel = activePanel === 'queue' ? 'setlist' : activePanel === 'mixer' ? 'users' : activePanel;
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
                validPanel === id
                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/5'
              )}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
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
        {validPanel === 'users' && (
          <EnhancedRoomUsersPanel
            users={users}
            currentUser={currentUser}
            isMaster={isMaster}
            audioLevels={audioLevels}
            onMuteUser={onMuteUser}
            onVolumeChange={onVolumeChange}
            onPresetChange={onPresetChange}
            onCustomSettingsChange={onCustomSettingsChange}
            onJitterModeChange={onJitterModeChange}
            onLowLatencyModeChange={onLowLatencyModeChange}
            onAcceptOptimization={onAcceptOptimization}
            onDismissOptimization={onDismissOptimization}
          />
        )}

        {validPanel === 'setlist' && (
          <SetlistPanel
            roomId={roomId}
            userId={userId}
            userName={userName}
          />
        )}

        {validPanel === 'analysis' && (
          <AnalysisPanel />
        )}

        {validPanel === 'chat' && (
          <ChatPanel roomId={roomId} onSendMessage={onSendMessage} />
        )}

        {validPanel === 'ai' && (
          <AIPanel />
        )}
      </div>
    </div>
  );
}
