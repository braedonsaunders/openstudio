'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import {
  Crown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Guitar,
  Music,
  Users,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User } from '@/types';

interface RoomUsersPanelProps {
  users: User[];
  currentUser: User | null;
  isMaster: boolean;
  audioLevels: Map<string, number>;
  onMuteUser?: (userId: string, muted: boolean) => void;
  onVolumeChange?: (userId: string, volume: number) => void;
}

// Instrument icons
const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-3.5 h-3.5" />,
  bass: <Guitar className="w-3.5 h-3.5" />,
  drums: <Drum className="w-3.5 h-3.5" />,
  keys: <Piano className="w-3.5 h-3.5" />,
  piano: <Piano className="w-3.5 h-3.5" />,
  vocals: <Mic className="w-3.5 h-3.5" />,
  mic: <Mic className="w-3.5 h-3.5" />,
  other: <Music className="w-3.5 h-3.5" />,
};

// Instrument colors
const instrumentColors: Record<string, string> = {
  guitar: 'text-amber-500',
  bass: 'text-green-500',
  drums: 'text-orange-500',
  keys: 'text-purple-500',
  piano: 'text-purple-500',
  vocals: 'text-pink-500',
  mic: 'text-pink-500',
  other: 'text-blue-500',
};

function UserCard({
  user,
  isCurrentUser,
  isMasterUser,
  audioLevel,
  onMute,
  onVolumeChange,
  canControl,
}: {
  user: User;
  isCurrentUser: boolean;
  isMasterUser: boolean;
  audioLevel: number;
  onMute?: () => void;
  onVolumeChange?: (volume: number) => void;
  canControl: boolean;
}) {
  const instrument = user.instrument || 'other';
  const instrumentIcon = instrumentIcons[instrument.toLowerCase()] || instrumentIcons.other;
  const instrumentColor = instrumentColors[instrument.toLowerCase()] || instrumentColors.other;
  const isActive = audioLevel > 0.1;
  const isMuted = user.isMuted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'relative p-3 rounded-xl border transition-all',
        isActive
          ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/30'
          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10',
        isCurrentUser && 'ring-2 ring-indigo-500/50'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar with activity indicator */}
        <div className="relative">
          <AvatarDisplay
            avatar={null}
            username={user.name}
            size="md"
            showEffects={isActive}
            showFrame
          />

          {/* Audio activity ring */}
          {isActive && (
            <motion.div
              className="absolute -inset-1 rounded-full border-2 border-indigo-500/50"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}

          {/* Muted indicator */}
          {isMuted && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <MicOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
              {user.name}
            </span>
            {isCurrentUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-500 font-medium">
                YOU
              </span>
            )}
            {isMasterUser && (
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            )}
          </div>

          {/* Instrument + status */}
          <div className="flex items-center gap-2 mt-0.5">
            <div className={cn('flex items-center gap-1', instrumentColor)}>
              {instrumentIcon}
              <span className="text-xs capitalize">{instrument}</span>
            </div>

            {isActive && (
              <motion.div
                className="flex gap-0.5"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-indigo-500 rounded-full"
                    animate={{
                      height: audioLevel > (i + 1) * 0.3 ? [4, 10, 4] : 4,
                    }}
                    transition={{
                      duration: 0.2,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Controls (if can control) */}
        {canControl && !isCurrentUser && (
          <div className="flex items-center gap-1">
            <button
              onClick={onMute}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isMuted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/20'
              )}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Audio level bar */}
      <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          animate={{ width: `${audioLevel * 100}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </motion.div>
  );
}

export function RoomUsersPanel({
  users,
  currentUser,
  isMaster,
  audioLevels,
  onMuteUser,
  onVolumeChange,
}: RoomUsersPanelProps) {
  // Combine current user with other users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Sort users: current user first, then master, then by name
  const sortedUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      if (a.isMaster && !b.isMaster) return -1;
      if (!a.isMaster && b.isMaster) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allUsers, currentUser]);

  const activeUsers = useMemo(() => {
    return sortedUsers.filter((u) => (audioLevels.get(u.id) || 0) > 0.1);
  }, [sortedUsers, audioLevels]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Room Members
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
      </div>

      {/* Users list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allUsers.length === 0 ? (
          <div className="h-full flex items-center justify-center">
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
            {sortedUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isCurrentUser={user.id === currentUser?.id}
                isMasterUser={user.isMaster || false}
                audioLevel={audioLevels.get(user.id) || 0}
                onMute={() => onMuteUser?.(user.id, !user.isMuted)}
                onVolumeChange={(vol) => onVolumeChange?.(user.id, vol)}
                canControl={isMaster}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Quick actions */}
      {isMaster && allUsers.length > 1 && (
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
    </div>
  );
}
