'use client';

import { useState, useEffect } from 'react';
import { TrackHeader } from './track-header';
import { UserTrackHeader } from './user-track-header';
import { AddTrackModal } from './add-track-modal';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { Plus } from 'lucide-react';
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

export function TrackHeadersPanel({
  users,
  currentUser,
  audioLevels,
  isMaster,
  onMuteUser,
  onVolumeChange,
  onMuteSelf,
}: TrackHeadersPanelProps) {
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);

  const {
    getTracksByUser,
    trackLevels,
    addTrack,
    removeTrack,
    loadDevices,
    devicesLoaded,
  } = useUserTracksStore();

  // Load devices on mount
  useEffect(() => {
    if (!devicesLoaded) {
      loadDevices();
    }
  }, [devicesLoaded, loadDevices]);

  // Initialize a default track for current user if they don't have any
  useEffect(() => {
    if (currentUser) {
      const userTracks = getTracksByUser(currentUser.id);
      if (userTracks.length === 0) {
        addTrack(currentUser.id, 'Track 1');
      }
    }
  }, [currentUser, getTracksByUser, addTrack]);

  // Get local user tracks
  const localTracks = currentUser ? getTracksByUser(currentUser.id) : [];

  // Remote users (excluding current user)
  const remoteUsers = users.filter((u) => u.id !== currentUser?.id);

  // Assign colors to remote users
  const getUserColor = (index: number) => TRACK_COLORS[index % TRACK_COLORS.length];

  // Count total tracks for display
  const totalTracks = localTracks.length + remoteUsers.length;

  return (
    <div className="w-60 bg-[#0d0d14] border-r border-white/5 flex flex-col shrink-0 z-10">
      {/* Header */}
      <div className="h-8 px-4 flex items-center border-b border-white/5 bg-[#12121a]">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Tracks</span>
        <span className="ml-auto text-xs text-zinc-600">{totalTracks}</span>
      </div>

      {/* Timeline header alignment spacer */}
      <div className="h-8 border-b border-white/5" />

      {/* Track Headers List */}
      <div className="flex-1 overflow-y-auto">
        {/* Local User Tracks (Your tracks) */}
        {currentUser && localTracks.length > 0 && (
          <div className="border-b border-white/10">
            <div className="px-3 py-1.5 bg-white/[0.02]">
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Your Tracks
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
                  onRemove={localTracks.length > 1 ? () => removeTrack(track.id) : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Remote User Tracks */}
        {remoteUsers.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-white/[0.02]">
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
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
                  onMute={(muted) => onMuteUser(user.id, muted)}
                  onVolumeChange={(volume) => onVolumeChange(user.id, volume)}
                />
              );
            })}
          </div>
        )}

        {/* Empty state for no remote users */}
        {remoteUsers.length === 0 && localTracks.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500">No tracks yet</p>
            <p className="text-xs text-zinc-600 mt-1">Add a track to get started</p>
          </div>
        )}
      </div>

      {/* Footer with Add Track button */}
      <div className="h-12 px-3 flex items-center border-t border-white/5 bg-[#0d0d14]">
        <button
          onClick={() => setShowAddTrackModal(true)}
          className="flex items-center gap-2 px-3 py-2 w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/30 rounded-lg text-indigo-400 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">Add Track</span>
        </button>
      </div>

      {/* Add Track Modal */}
      <AddTrackModal
        isOpen={showAddTrackModal}
        onClose={() => setShowAddTrackModal(false)}
        userId={currentUser?.id || ''}
      />
    </div>
  );
}
