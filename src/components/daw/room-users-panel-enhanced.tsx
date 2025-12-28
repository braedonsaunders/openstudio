'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Users,
  Settings2,
  Activity,
} from 'lucide-react';
import type { User, UserPerformanceInfo, JamCompatibility, QualityPresetName, OpusEncodingSettings } from '@/types';
import { UserPerformanceCard } from './user-performance-card';
import { JamCompatibilityIndicator } from './jam-compatibility-indicator';
import { QualitySettingsPanel } from './quality-settings-panel';
import { usePerformanceSyncStore } from '@/stores/performance-sync-store';

interface EnhancedRoomUsersPanelProps {
  users: User[];
  currentUser: User | null;
  isMaster: boolean;
  audioLevels: Map<string, number>;
  onMuteUser?: (userId: string, muted: boolean) => void;
  onVolumeChange?: (userId: string, volume: number) => void;
  onPresetChange?: (preset: QualityPresetName) => void;
  onCustomSettingsChange?: (settings: Partial<OpusEncodingSettings>) => void;
  onJitterModeChange?: (mode: 'live-jamming' | 'balanced' | 'stable') => void;
  onLowLatencyModeChange?: (enabled: boolean) => void;
  onAcceptOptimization?: (type: string) => void;
  onDismissOptimization?: (type: string) => void;
}

export function EnhancedRoomUsersPanel({
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
}: EnhancedRoomUsersPanelProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');

  // Get performance data from store
  const {
    participantPerformance,
    jamCompatibility,
    activePreset,
    localPerformance,
  } = usePerformanceSyncStore();

  // Combine current user with other users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Sort users: current user first, then master, then by latency (lowest first)
  const sortedUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;

      // Sort by latency if we have performance data
      const perfA = participantPerformance.get(a.id);
      const perfB = participantPerformance.get(b.id);
      if (perfA && perfB) {
        return perfA.rttToMaster - perfB.rttToMaster;
      }

      return a.name.localeCompare(b.name);
    });
  }, [allUsers, currentUser, participantPerformance]);

  const activeUsers = useMemo(() => {
    return sortedUsers.filter((u) => (audioLevels.get(u.id) || 0) > 0.1);
  }, [sortedUsers, audioLevels]);

  // Get current jitter mode and low latency mode from local performance
  const currentJitterMode = localPerformance?.jitterBufferMode || 'balanced';
  const currentLowLatencyMode = activePreset === 'ultra-low-latency' || activePreset === 'low-latency';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header with tabs */}
      <div className="border-b border-gray-200 dark:border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Room
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-zinc-500">
              {allUsers.length} {allUsers.length === 1 ? 'member' : 'members'}
            </span>
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-500 font-medium">
                  {activeUsers.length} active
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab buttons */}
        <div className="px-4 pb-2 flex gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              activeTab === 'users'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
            )}
          >
            <Users className="w-3 h-3 inline-block mr-1" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              activeTab === 'settings'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
            )}
          >
            <Settings2 className="w-3 h-3 inline-block mr-1" />
            Quality
          </button>
        </div>
      </div>

      {/* Jam compatibility indicator (always visible) */}
      {jamCompatibility && activeTab === 'users' && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5">
          <JamCompatibilityIndicator
            compatibility={jamCompatibility}
            onAcceptOptimization={(type) => onAcceptOptimization?.(type)}
            onDismissOptimization={(type) => onDismissOptimization?.(type)}
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'users' ? (
          /* Users list */
          <div className="p-3 space-y-2">
            {allUsers.length === 0 ? (
              <div className="h-full flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    Waiting for musicians to join...
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {sortedUsers.map((user) => {
                  const performance = participantPerformance.get(user.id) ||
                    (user.id === currentUser?.id ? localPerformance : undefined);

                  return (
                    <UserPerformanceCard
                      key={user.id}
                      user={user}
                      performance={performance || undefined}
                      isCurrentUser={user.id === currentUser?.id}
                      isMasterUser={user.isMaster || false}
                      audioLevel={audioLevels.get(user.id) || 0}
                      onMute={() => onMuteUser?.(user.id, !user.isMuted)}
                      canControl={isMaster}
                      expanded={expandedUserId === user.id}
                      onToggleExpand={() => {
                        setExpandedUserId(expandedUserId === user.id ? null : user.id);
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        ) : (
          /* Quality settings */
          <div className="p-3">
            <QualitySettingsPanel
              activePreset={activePreset}
              onPresetChange={(preset) => onPresetChange?.(preset)}
              onCustomSettingsChange={onCustomSettingsChange}
              jitterMode={currentJitterMode}
              onJitterModeChange={(mode) => onJitterModeChange?.(mode)}
              lowLatencyMode={currentLowLatencyMode}
              onLowLatencyModeChange={(enabled) => onLowLatencyModeChange?.(enabled)}
            />
          </div>
        )}
      </div>

      {/* Quick actions for master */}
      {isMaster && allUsers.length > 1 && activeTab === 'users' && (
        <div className="p-3 border-t border-gray-200 dark:border-white/5">
          <div className="flex gap-2">
            <button
              onClick={() => {
                allUsers.forEach((u) => {
                  if (u.id !== currentUser?.id) {
                    onMuteUser?.(u.id, true);
                  }
                });
              }}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              Mute All
            </button>
            <button
              onClick={() => {
                allUsers.forEach((u) => {
                  onMuteUser?.(u.id, false);
                });
              }}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              Unmute All
            </button>
          </div>
        </div>
      )}

      {/* Network stats footer */}
      {localPerformance && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>Your latency: {Math.round(localPerformance.totalLatency)}ms</span>
              </div>
            </div>
            <div>
              Score: {localPerformance.qualityScore}/100
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
