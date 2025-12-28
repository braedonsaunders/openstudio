'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrackHeader } from './track-header';
import { UserTrackHeader } from './user-track-header';
import { InactiveTrackHeader } from './inactive-track-header';
import { AddTrackModal } from './add-track-modal';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { Plus, Radio } from 'lucide-react';
import type { User } from '@/types';

interface LiveChannelsPanelProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onMuteUser: (userId: string, muted: boolean) => void;
  onVolumeChange: (userId: string, volume: number) => void;
  onMuteSelf: () => void;
  isGlobalMuted?: boolean;
  roomId?: string;
}

// Track color palette for remote users
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

export function LiveChannelsPanel({
  users,
  currentUser,
  audioLevels,
  isMaster,
  onMuteUser,
  onVolumeChange,
  onMuteSelf,
  isGlobalMuted,
  roomId,
}: LiveChannelsPanelProps) {
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);

  const {
    getTracksByUser,
    getInactiveTracks,
    trackLevels,
    removeTrack,
    assignTrackToUser,
  } = useUserTracksStore();

  // Load devices on mount - use getState() to avoid dependency issues
  useEffect(() => {
    const { devicesLoaded, loadDevices } = useUserTracksStore.getState();
    if (!devicesLoaded) {
      loadDevices();
    }
  }, []);

  // Initialize a default track for current user if they don't have any
  // Use getState() to avoid unstable store refs in effect dependencies
  useEffect(() => {
    if (currentUser) {
      const { getTracksByUser, addTrack } = useUserTracksStore.getState();
      const userTracks = getTracksByUser(currentUser.id);
      if (userTracks.length === 0) {
        addTrack(currentUser.id, 'Channel 1');
      }
    }
  }, [currentUser]);

  // Get local user tracks
  const localTracks = currentUser ? getTracksByUser(currentUser.id) : [];

  // Get inactive tracks (from users who left)
  const inactiveTracks = getInactiveTracks().filter((t) => t.userId !== currentUser?.id);

  // Remote users (excluding current user)
  const remoteUsers = users.filter((u) => u.id !== currentUser?.id);

  // Assign colors to remote users
  const getUserColor = (index: number) => TRACK_COLORS[index % TRACK_COLORS.length];

  // Count total channels for display
  const totalChannels = localTracks.length + remoteUsers.length + inactiveTracks.length;

  // Handle claiming an abandoned track
  const handleClaimTrack = async (trackId: string) => {
    if (!currentUser) return;
    assignTrackToUser(trackId, currentUser.id, currentUser.name);

    // Persist to database
    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/user-tracks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId,
            userId: currentUser.id,
            isActive: true,
          }),
        });
      } catch (err) {
        console.error('Failed to claim track:', err);
      }
    }
  };

  // Handle deleting an abandoned track
  const handleDeleteTrack = async (trackId: string) => {
    removeTrack(trackId);

    // Delete from database
    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/user-tracks?trackId=${trackId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete track:', err);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
            Live Channels
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-zinc-600">{totalChannels}</span>
      </div>

      {/* Channel Headers List */}
      <div className="flex-1 overflow-y-auto">
        {/* Local User Channels (Your channels) */}
        {currentUser && localTracks.length > 0 && (
          <div className="border-b border-gray-200 dark:border-white/10">
            <div className="px-3 py-1 bg-gray-100/50 dark:bg-white/[0.02]">
              <span className="text-[9px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                Your Channels
              </span>
            </div>
            {localTracks.map((track, index) => {
              const level = trackLevels.get(track.id) || audioLevels.get('local') || 0;
              return (
                <UserTrackHeader
                  key={track.id}
                  track={track}
                  audioLevel={level}
                  trackNumber={index + 1}
                  isFirst={index === 0}
                  userName={currentUser.name}
                  isGlobalMuted={isGlobalMuted}
                  onRemove={localTracks.length > 1 ? () => removeTrack(track.id) : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Remote User Channels */}
        {remoteUsers.length > 0 && (
          <div>
            <div className="px-3 py-1 bg-gray-100/50 dark:bg-white/[0.02]">
              <span className="text-[9px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                Other Musicians
              </span>
            </div>
            {remoteUsers.map((user, index) => {
              const level = audioLevels.get(user.id) || 0;
              const trackColor = getUserColor(index);
              const globalTrackNumber = localTracks.length + index + 1;

              return (
                <TrackHeader
                  key={user.id}
                  user={user}
                  isLocal={false}
                  isMaster={user.isMaster ?? false}
                  audioLevel={level}
                  trackColor={trackColor}
                  trackNumber={globalTrackNumber}
                  isGlobalMuted={isGlobalMuted}
                  onMute={(muted) => onMuteUser(user.id, muted)}
                  onVolumeChange={(volume) => onVolumeChange(user.id, volume)}
                />
              );
            })}
          </div>
        )}

        {/* Inactive Channels (from users who left) */}
        {inactiveTracks.length > 0 && (
          <div className="border-t border-gray-200 dark:border-white/10">
            <div className="px-3 py-1 bg-gray-100/50 dark:bg-white/[0.02]">
              <span className="text-[9px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
                Disconnected
              </span>
            </div>
            {inactiveTracks.map((track, index) => (
              <InactiveTrackHeader
                key={track.id}
                track={track}
                trackNumber={localTracks.length + remoteUsers.length + index + 1}
                onClaim={() => handleClaimTrack(track.id)}
                onDelete={() => handleDeleteTrack(track.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state for no channels */}
        {remoteUsers.length === 0 && localTracks.length === 0 && inactiveTracks.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-zinc-500">No channels yet</p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">Add a channel to get started</p>
          </div>
        )}
      </div>

      {/* Footer with Add Channel button */}
      <div className="h-10 px-3 flex items-center border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d0d14] shrink-0">
        <button
          onClick={() => setShowAddTrackModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Add Channel</span>
        </button>
      </div>

      {/* Add Track Modal */}
      <AddTrackModal
        isOpen={showAddTrackModal}
        onClose={() => setShowAddTrackModal(false)}
        userId={currentUser?.id || ''}
        userName={currentUser?.name}
        roomId={roomId}
      />
    </div>
  );
}
