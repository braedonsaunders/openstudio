'use client';

import { useCallback, useMemo } from 'react';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useRoomStore } from '@/stores/room-store';
import {
  RoomPermissions,
  RoomRole,
  RoomMember,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
} from '@/types/permissions';

/**
 * Hook for checking permissions in the current room
 *
 * Usage:
 * ```
 * const { can, role, isOwner } = usePermissions();
 *
 * // Check a specific permission
 * if (can('transport.play')) { ... }
 *
 * // Check if user has any transport permission
 * if (canTransport) { ... }
 * ```
 */
export function usePermissions() {
  const {
    myPermissions,
    myRole,
    members,
    defaultRole,
    can: storeCan,
    canAny,
    canAll,
  } = usePermissionsStore();

  const { isMaster, currentUser } = useRoomStore();

  // Fallback: if permission system not initialized, use legacy isMaster
  const can = useCallback(
    (permission: string): boolean => {
      // If permissions system is active, use it
      if (myPermissions) {
        return storeCan(permission);
      }

      // Legacy fallback: isMaster gets all permissions
      if (isMaster) {
        return true;
      }

      // Non-master users get basic permissions in legacy mode
      const basicPermissions = [
        'mixer.ownTrackVolume',
        'effects.ownEffects',
        'chat.sendMessages',
        'chat.sendReactions',
        'chat.voiceChat',
        'chat.videoChat',
      ];
      return basicPermissions.includes(permission);
    },
    [myPermissions, storeCan, isMaster]
  );

  // Role checks
  const isOwner = myRole === 'owner' || (myRole === null && isMaster);
  const isCoHost = myRole === 'co-host';
  const isPerformer = myRole === 'performer';
  const isMember = myRole === 'member';
  const isListener = myRole === 'listener';
  const isModerator = isOwner || isCoHost;

  // Category permission checks
  const canTransport = useMemo(
    () =>
      can('transport.play') ||
      can('transport.pause') ||
      can('transport.seek') ||
      can('transport.skipTrack'),
    [can]
  );

  const canManageTempo = useMemo(
    () =>
      can('tempo.setBpm') ||
      can('tempo.setKey') ||
      can('tempo.setScale') ||
      can('tempo.metronomeControl'),
    [can]
  );

  const canManageTracks = useMemo(
    () =>
      can('tracks.addToQueue') ||
      can('tracks.removeFromQueue') ||
      can('tracks.reorderQueue'),
    [can]
  );

  const canManageMixer = useMemo(
    () =>
      can('mixer.stemControl') ||
      can('mixer.masterVolume') ||
      can('mixer.otherUserVolume'),
    [can]
  );

  const canRecord = useMemo(() => can('recording.record'), [can]);

  const canUseAI = useMemo(
    () =>
      can('ai.stemSeparation') ||
      can('ai.generateMusic') ||
      can('ai.generateLyrics'),
    [can]
  );

  const canChat = useMemo(() => can('chat.sendMessages'), [can]);
  const canVoiceChat = useMemo(() => can('chat.voiceChat'), [can]);
  const canVideoChat = useMemo(() => can('chat.videoChat'), [can]);

  const canManageRoom = useMemo(
    () => can('room.manageUsers') || can('room.manageRoles'),
    [can]
  );

  // Get effective permissions for the current user
  const permissions = useMemo(
    () =>
      myRole
        ? getEffectivePermissions(myRole, undefined)
        : isMaster
        ? ROLE_PERMISSIONS.owner
        : ROLE_PERMISSIONS.member,
    [myRole, isMaster]
  );

  // Get a member by user ID
  const getMember = useCallback(
    (userId: string): RoomMember | undefined => {
      return members.find((m) => m.oduserId === userId);
    },
    [members]
  );

  // Check if current user can modify another user's role
  const canModifyUser = useCallback(
    (targetUserId: string): boolean => {
      if (!can('room.manageRoles')) return false;
      if (!currentUser) return false;

      // Can't modify yourself (except owner can change some of their own settings)
      if (targetUserId === currentUser.id && !isOwner) return false;

      const targetMember = getMember(targetUserId);
      if (!targetMember) return false;

      // Can't modify the owner (unless you are the owner)
      if (targetMember.role === 'owner' && !isOwner) return false;

      // Co-hosts can only modify performers, members, and listeners
      if (isCoHost && (targetMember.role === 'owner' || targetMember.role === 'co-host')) {
        return false;
      }

      return true;
    },
    [can, currentUser, isOwner, isCoHost, getMember]
  );

  // Get roles that the current user can assign
  const assignableRoles = useMemo((): RoomRole[] => {
    if (isOwner) {
      return ['co-host', 'performer', 'member', 'listener'];
    }
    if (isCoHost) {
      return ['performer', 'member', 'listener'];
    }
    return [];
  }, [isOwner, isCoHost]);

  return {
    // Core permission check
    can,
    canAny,
    canAll,

    // Role info
    role: myRole,
    isOwner,
    isCoHost,
    isPerformer,
    isMember,
    isListener,
    isModerator,

    // Category checks
    canTransport,
    canManageTempo,
    canManageTracks,
    canManageMixer,
    canRecord,
    canUseAI,
    canChat,
    canVoiceChat,
    canVideoChat,
    canManageRoom,

    // Full permissions object
    permissions,

    // Members management
    members,
    getMember,
    canModifyUser,
    assignableRoles,
    defaultRole,
  };
}

/**
 * Hook specifically for transport controls
 */
export function useTransportPermissions() {
  const { can } = usePermissions();

  return {
    canPlay: can('transport.play'),
    canPause: can('transport.pause'),
    canSeek: can('transport.seek'),
    canSkip: can('transport.skipTrack'),
    canLoop: can('transport.loopControl'),
  };
}

/**
 * Hook specifically for tempo/key controls
 */
export function useTempoPermissions() {
  const { can } = usePermissions();

  return {
    canSetBpm: can('tempo.setBpm'),
    canSetSource: can('tempo.setSource'),
    canSetTimeSignature: can('tempo.setTimeSignature'),
    canSetKey: can('tempo.setKey'),
    canSetScale: can('tempo.setScale'),
    canMetronome: can('tempo.metronomeControl'),
  };
}

/**
 * Hook specifically for track management
 */
export function useTrackPermissions() {
  const { can } = usePermissions();

  return {
    canAdd: can('tracks.addToQueue'),
    canRemove: can('tracks.removeFromQueue'),
    canReorder: can('tracks.reorderQueue'),
    canEditMetadata: can('tracks.editMetadata'),
    canUpload: can('tracks.uploadBackingTrack'),
    canCreate: can('tracks.createSong'),
    canEditArrangement: can('tracks.editSongArrangement'),
    canDelete: can('tracks.deleteSong'),
  };
}

/**
 * Hook specifically for mixer controls
 */
export function useMixerPermissions() {
  const { can } = usePermissions();

  return {
    canStemControl: can('mixer.stemControl'),
    canStemToggle: can('mixer.stemToggle'),
    canMasterVolume: can('mixer.masterVolume'),
    canOwnVolume: can('mixer.ownTrackVolume'),
    canOtherVolume: can('mixer.otherUserVolume'),
    canMuteOthers: can('mixer.muteOtherUsers'),
  };
}

/**
 * Hook specifically for chat features
 */
export function useChatPermissions() {
  const { can } = usePermissions();

  return {
    canSendMessages: can('chat.sendMessages'),
    canReact: can('chat.sendReactions'),
    canShareLinks: can('chat.shareLinks'),
    canVoice: can('chat.voiceChat'),
    canVideo: can('chat.videoChat'),
    canScreenShare: can('chat.screenShare'),
  };
}

/**
 * Hook specifically for AI features
 */
export function useAIPermissions() {
  const { can } = usePermissions();

  return {
    canSeparateStems: can('ai.stemSeparation'),
    canGenerateMusic: can('ai.generateMusic'),
    canGenerateLyrics: can('ai.generateLyrics'),
    canUseAssistant: can('ai.useAssistant'),
  };
}

/**
 * Hook specifically for recording features
 */
export function useRecordingPermissions() {
  const { can } = usePermissions();

  return {
    canRecord: can('recording.record'),
    canCreateLoop: can('recording.createLoop'),
    canEditLoops: can('recording.editLoops'),
    canDeleteLoops: can('recording.deleteLoops'),
  };
}

export default usePermissions;
