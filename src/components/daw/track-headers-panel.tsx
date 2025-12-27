'use client';

import { cn } from '@/lib/utils';
import { TrackHeader } from './track-header';
import type { User } from '@/types';

interface TrackHeadersPanelProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onMuteUser: (userId: string, muted: boolean) => void;
  onVolumeChange: (userId: string, volume: number) => void;
  onMuteSelf: () => void;
}

// Track color palette
const TRACK_COLORS = [
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#a3e635', // Lime
  '#22d3ee', // Cyan
  '#a78bfa', // Violet
  '#fbbf24', // Yellow
  '#34d399', // Emerald
  '#f87171', // Red
  '#60a5fa', // Blue
  '#c084fc', // Purple
];

export function TrackHeadersPanel({
  users,
  currentUser,
  audioLevels,
  isMaster,
  onMuteUser,
  onVolumeChange,
  onMuteSelf,
}: TrackHeadersPanelProps) {
  // Assign colors to users based on their position
  const getUserColor = (index: number) => TRACK_COLORS[index % TRACK_COLORS.length];

  // Build ordered user list with current user first
  const orderedUsers = currentUser
    ? [currentUser, ...users.filter(u => u.id !== currentUser.id)]
    : users;

  return (
    <div className="w-60 bg-[#0d0d14] border-r border-white/5 flex flex-col shrink-0 z-10">
      {/* Header */}
      <div className="h-8 px-4 flex items-center border-b border-white/5 bg-[#12121a]">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tracks</span>
        <span className="ml-auto text-xs text-zinc-600">{users.length}</span>
      </div>

      {/* Timeline header alignment spacer */}
      <div className="h-8 border-b border-white/5" />

      {/* Track Headers List */}
      <div className="flex-1 overflow-y-auto">
        {orderedUsers.map((user, index) => {
          const isLocal = user.id === currentUser?.id;
          const level = audioLevels.get(isLocal ? 'local' : user.id) || 0;
          const trackColor = getUserColor(index);

          return (
            <TrackHeader
              key={user.id}
              user={user}
              isLocal={isLocal}
              isMaster={user.isMaster}
              audioLevel={level}
              trackColor={trackColor}
              trackNumber={index + 1}
              onMute={(muted) => {
                if (isLocal) {
                  onMuteSelf();
                } else {
                  onMuteUser(user.id, muted);
                }
              }}
              onVolumeChange={(volume) => onVolumeChange(user.id, volume)}
            />
          );
        })}

        {/* Empty state */}
        {users.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500">No other users in this room</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-10 px-4 flex items-center border-t border-white/5 bg-[#0d0d14]">
        <button className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Track</span>
        </button>
      </div>
    </div>
  );
}
