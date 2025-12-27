'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import * as authApi from '@/lib/supabase/auth';
import { queueXPNotification } from '@/components/gamification/XPNotification';
import { XP_ACTIVITIES } from '@/types/user';
import { ALL_ACHIEVEMENTS } from '@/data/achievements';

interface SessionState {
  sessionId: string | null;
  roomId: string | null;
  startTime: number | null;
  collaborators: Set<string>;
  instrument?: string;
}

/**
 * Hook for tracking user statistics and activity throughout the app.
 * Handles session tracking, stat increments, XP gains, and achievement checks.
 */
export function useStatsTracker() {
  const { user, profile, stats, addXP, checkAndUnlockAchievements, refreshProfile } = useAuthStore();

  // Track current session state
  const sessionState = useRef<SessionState>({
    sessionId: null,
    roomId: null,
    startTime: null,
    collaborators: new Set(),
    instrument: undefined,
  });

  // Time-based reward intervals (in ms)
  const lastTimeReward = useRef<number>(0);

  /**
   * Start tracking a jam session
   */
  const startSession = useCallback(async (roomId: string, instrument?: string) => {
    if (!user) return;

    try {
      // Start session in database
      const session = await authApi.startSession(user.id, roomId, instrument);

      sessionState.current = {
        sessionId: session.id,
        roomId,
        startTime: Date.now(),
        collaborators: new Set(),
        instrument,
      };

      // Record activity for heatmap
      await authApi.recordActivity(user.id);

      // Increment rooms joined stat
      await authApi.incrementStat(user.id, 'rooms_joined', 1);

      // Award XP for joining
      const result = await addXP(XP_ACTIVITIES.JOIN_ROOM, 'Joined a jam room', 'room', roomId);

      queueXPNotification({
        amount: XP_ACTIVITIES.JOIN_ROOM,
        reason: 'Joined jam room',
        levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
      });

      // Check for achievements
      await checkAndUnlockAchievements();

      lastTimeReward.current = Date.now();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * End the current jam session
   */
  const endSession = useCallback(async () => {
    if (!user || !sessionState.current.sessionId) return;

    try {
      const collaboratorIds = Array.from(sessionState.current.collaborators);

      // End session in database
      const { durationSeconds } = await authApi.endSession(
        sessionState.current.sessionId,
        collaboratorIds
      );

      // Update stats
      const currentStats = stats;
      if (currentStats) {
        const newTotalSessions = currentStats.totalSessions + 1;
        const newTotalJamSeconds = currentStats.totalJamSeconds + durationSeconds;
        const newLongestSession = Math.max(currentStats.longestSessionSeconds, durationSeconds);

        // Calculate new unique collaborators
        const existingCollaborators = currentStats.uniqueCollaborators;
        const newCollaborators = collaboratorIds.filter(id => id !== user.id).length;
        const estimatedNewUnique = Math.min(
          existingCollaborators + newCollaborators,
          existingCollaborators + Math.ceil(newCollaborators * 0.3) // Assume 30% are new
        );

        await authApi.updateStats(user.id, {
          totalSessions: newTotalSessions,
          totalJamSeconds: newTotalJamSeconds,
          longestSessionSeconds: newLongestSession,
          uniqueCollaborators: estimatedNewUnique,
        });
      }

      // Award time-based XP
      const minutes = Math.floor(durationSeconds / 60);
      if (minutes >= 60) {
        await addXP(XP_ACTIVITIES.JAM_1_HOUR, 'Jammed for an hour!', 'session', sessionState.current.sessionId);
        queueXPNotification({ amount: XP_ACTIVITIES.JAM_1_HOUR, reason: 'Jammed for an hour!' });
      } else if (minutes >= 30) {
        await addXP(XP_ACTIVITIES.JAM_30_MINUTES, 'Jammed for 30 minutes', 'session', sessionState.current.sessionId);
        queueXPNotification({ amount: XP_ACTIVITIES.JAM_30_MINUTES, reason: 'Jammed for 30 minutes' });
      } else if (minutes >= 10) {
        await addXP(XP_ACTIVITIES.JAM_10_MINUTES, 'Jammed for 10 minutes', 'session', sessionState.current.sessionId);
        queueXPNotification({ amount: XP_ACTIVITIES.JAM_10_MINUTES, reason: 'Jammed for 10 minutes' });
      }

      // Create activity item
      await authApi.createActivityItem(user.id, 'session', {
        roomId: sessionState.current.roomId,
        durationSeconds,
        collaboratorCount: collaboratorIds.length,
        instrument: sessionState.current.instrument,
      });

      // Reset session state
      sessionState.current = {
        sessionId: null,
        roomId: null,
        startTime: null,
        collaborators: new Set(),
        instrument: undefined,
      };

      // Check for achievements
      await checkAndUnlockAchievements();

      // Refresh profile to get updated stats
      await refreshProfile();
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [user, stats, addXP, checkAndUnlockAchievements, refreshProfile]);

  /**
   * Track a collaborator joining the session
   */
  const trackCollaborator = useCallback(async (collaboratorId: string) => {
    if (!user || collaboratorId === user.id) return;

    const isNew = !sessionState.current.collaborators.has(collaboratorId);
    sessionState.current.collaborators.add(collaboratorId);

    // Update session with new collaborator
    if (sessionState.current.sessionId) {
      await authApi.updateSessionCollaborators(
        sessionState.current.sessionId,
        Array.from(sessionState.current.collaborators)
      );
    }

    // Award XP for new collaborator
    if (isNew) {
      const result = await addXP(XP_ACTIVITIES.JAM_WITH_NEW_PERSON, 'Jammed with a new musician', 'user', collaboratorId);
      queueXPNotification({
        amount: XP_ACTIVITIES.JAM_WITH_NEW_PERSON,
        reason: 'Jammed with a new musician',
        levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
      });
    }
  }, [user, profile, addXP]);

  /**
   * Track a chat message sent
   */
  const trackMessage = useCallback(async () => {
    if (!user) return;

    await authApi.incrementStat(user.id, 'messages_sent', 1);

    // Check if this is the first message
    if (stats?.messagesSent === 0) {
      const result = await addXP(XP_ACTIVITIES.FIRST_MESSAGE_IN_ROOM, 'Sent your first message', 'chat', sessionState.current.roomId || undefined);
      queueXPNotification({
        amount: XP_ACTIVITIES.FIRST_MESSAGE_IN_ROOM,
        reason: 'Sent your first message',
        levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
      });
    }

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, stats, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track a reaction sent
   */
  const trackReactionSent = useCallback(async (toUserId: string, reactionType: string) => {
    if (!user || !sessionState.current.roomId) return;

    await authApi.sendReaction(sessionState.current.roomId, user.id, toUserId, reactionType);

    const result = await addXP(XP_ACTIVITIES.GIVE_REACTION, 'Gave a reaction', 'reaction', reactionType);
    queueXPNotification({
      amount: XP_ACTIVITIES.GIVE_REACTION,
      reason: 'Gave a reaction',
      levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
    });

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track a reaction received
   */
  const trackReactionReceived = useCallback(async (reactionType: string) => {
    if (!user) return;

    // XP for receiving a fire reaction
    if (reactionType === 'fire') {
      const result = await addXP(XP_ACTIVITIES.RECEIVE_FIRE_REACTION, 'Received a fire reaction!', 'reaction', reactionType);
      queueXPNotification({
        amount: XP_ACTIVITIES.RECEIVE_FIRE_REACTION,
        reason: 'Received a fire reaction!',
        levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
      });
    }

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track a track upload
   */
  const trackTrackUpload = useCallback(async () => {
    if (!user) return;

    await authApi.incrementStat(user.id, 'tracks_uploaded', 1);

    const result = await addXP(XP_ACTIVITIES.UPLOAD_TRACK, 'Uploaded a track', 'track', undefined);
    queueXPNotification({
      amount: XP_ACTIVITIES.UPLOAD_TRACK,
      reason: 'Uploaded a track',
      levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
    });

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track an AI track generation
   */
  const trackAIGeneration = useCallback(async () => {
    if (!user) return;

    await authApi.incrementStat(user.id, 'tracks_generated', 1);

    const result = await addXP(XP_ACTIVITIES.GENERATE_AI_TRACK, 'Generated an AI track', 'ai', undefined);
    queueXPNotification({
      amount: XP_ACTIVITIES.GENERATE_AI_TRACK,
      reason: 'Generated an AI track',
      levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
    });

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track a room creation
   */
  const trackRoomCreated = useCallback(async (roomId: string) => {
    if (!user) return;

    await authApi.incrementStat(user.id, 'rooms_created', 1);

    const result = await addXP(XP_ACTIVITIES.CREATE_ROOM, 'Created a room', 'room', roomId);
    queueXPNotification({
      amount: XP_ACTIVITIES.CREATE_ROOM,
      reason: 'Created a room',
      levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
    });

    // Create activity item
    await authApi.createActivityItem(user.id, 'room_created', { roomId });

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track stem separation
   */
  const trackStemSeparation = useCallback(async () => {
    if (!user) return;

    await authApi.incrementStat(user.id, 'stems_separated', 1);

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, checkAndUnlockAchievements]);

  /**
   * Track a friend added
   */
  const trackFriendAdded = useCallback(async (friendId: string) => {
    if (!user) return;

    const result = await addXP(XP_ACTIVITIES.ADD_FRIEND, 'Added a friend', 'user', friendId);
    queueXPNotification({
      amount: XP_ACTIVITIES.ADD_FRIEND,
      reason: 'Added a friend',
      levelUp: result.leveledUp ? { oldLevel: profile?.level || 1, newLevel: result.newLevel } : undefined,
    });

    // Create activity item
    await authApi.createActivityItem(user.id, 'friend', { friendId });

    // Check for achievements
    await checkAndUnlockAchievements();
  }, [user, profile, addXP, checkAndUnlockAchievements]);

  /**
   * Track an achievement unlock
   */
  const trackAchievementUnlock = useCallback(async (achievementId: string) => {
    if (!user) return;

    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;

    queueXPNotification({
      amount: achievement.xpReward,
      reason: achievement.name,
      achievement: { id: achievementId, name: achievement.name },
    });

    // Create activity item
    await authApi.createActivityItem(user.id, 'achievement', {
      achievementId,
      name: achievement.name,
      xpReward: achievement.xpReward,
    });
  }, [user]);

  // Cleanup on unmount - end session if active
  useEffect(() => {
    return () => {
      if (sessionState.current.sessionId) {
        // Fire and forget - we're unmounting
        endSession();
      }
    };
  }, [endSession]);

  return {
    // Session tracking
    startSession,
    endSession,
    trackCollaborator,
    isInSession: () => sessionState.current.sessionId !== null,
    getSessionDuration: () => sessionState.current.startTime
      ? Math.floor((Date.now() - sessionState.current.startTime) / 1000)
      : 0,

    // Action tracking
    trackMessage,
    trackReactionSent,
    trackReactionReceived,
    trackTrackUpload,
    trackAIGeneration,
    trackRoomCreated,
    trackStemSeparation,
    trackFriendAdded,
    trackAchievementUnlock,
  };
}

export default useStatsTracker;
