import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile, Avatar, UserStats, UserInstrument, Achievement, UserAchievement, Friendship, Notification } from '@/types/user';
import * as authApi from '@/lib/supabase/auth';

interface AuthState {
  // Auth state
  user: SupabaseUser | null;
  profile: UserProfile | null;
  avatar: Avatar | null;
  stats: UserStats | null;
  instruments: UserInstrument[];
  achievements: Achievement[];
  unlockedAchievements: UserAchievement[];
  friends: UserProfile[];
  pendingFriendRequests: UserProfile[];
  notifications: Notification[];
  unreadNotificationCount: number;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;

  // Actions - Auth
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;

  // Actions - Profile
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateAvatar: (avatar: Avatar) => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Actions - Instruments
  addInstrument: (instrumentId: string, category: string, isPrimary?: boolean) => Promise<void>;
  setPrimaryInstrument: (instrumentId: string) => Promise<void>;

  // Actions - XP & Achievements
  addXP: (amount: number, reason: string, sourceType?: string, sourceId?: string) => Promise<{ leveledUp: boolean; newLevel: number }>;
  checkAndUnlockAchievements: () => Promise<string[]>;
  refreshAchievements: () => Promise<void>;

  // Actions - Social
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriendRequest: (friendId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  refreshFriends: () => Promise<void>;

  // Actions - Notifications
  markNotificationRead: (notificationId: string) => Promise<void>;
  clearNotifications: () => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  user: null,
  profile: null,
  avatar: null,
  stats: null,
  instruments: [],
  achievements: [],
  unlockedAchievements: [],
  friends: [],
  pendingFriendRequests: [],
  notifications: [],
  unreadNotificationCount: 0,
  isLoading: false,
  isInitialized: false,
};

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    (set, get) => ({
      ...initialState,

        initialize: async () => {
          // Prevent concurrent calls - check both isInitialized and isLoading
          const state = get();
          if (state.isInitialized || state.isLoading) return;

          set({ isLoading: true });

          try {
            const user = await authApi.getUser();

            if (user) {
              // Fetch user data with individual error handling to prevent one failure from blocking all
              const results = await Promise.allSettled([
                authApi.getUserProfile(user.id),
                authApi.getUserAvatar(user.id),
                authApi.getUserStats(user.id),
                authApi.getUserInstruments(user.id),
                authApi.getAllAchievements(),
                authApi.getUserAchievements(user.id),
                authApi.getFriends(user.id),
              ]);

              const profile = results[0].status === 'fulfilled' ? results[0].value : null;
              const avatar = results[1].status === 'fulfilled' ? results[1].value : null;
              const stats = results[2].status === 'fulfilled' ? results[2].value : null;
              const instruments = results[3].status === 'fulfilled' ? results[3].value : [];
              const achievements = results[4].status === 'fulfilled' ? results[4].value : [];
              const unlockedAchievements = results[5].status === 'fulfilled' ? results[5].value : [];
              const friendsResult = results[6].status === 'fulfilled' ? results[6].value : { friends: [], pending: [] };

              // Update streak (non-blocking)
              if (profile) {
                authApi.updateStreak(user.id).catch(() => {});
              }

              set({
                user,
                profile,
                avatar,
                stats,
                instruments,
                achievements,
                unlockedAchievements,
                friends: friendsResult.friends,
                pendingFriendRequests: friendsResult.pending,
                isLoading: false,
                isInitialized: true,
              });
            } else {
              // No user session - mark as initialized but not loading
              set({ isLoading: false, isInitialized: true });
            }
          } catch (error) {
            console.error('Failed to initialize auth:', error);
            set({ isLoading: false, isInitialized: true });
          }
        },

        signUp: async (email, password, username, displayName) => {
          set({ isLoading: true });

          try {
            const result = await authApi.signUp(email, password, username, displayName);

            // Check if email confirmation is required
            if (result.user && !result.session) {
              // Email confirmation required - don't initialize yet
              throw new Error('Please check your email to confirm your account before signing in.');
            }

            // After signup, initialize to load profile
            set({ isInitialized: false }); // Reset to allow re-initialization
            await get().initialize();
          } finally {
            set({ isLoading: false });
          }
        },

        signIn: async (email, password) => {
          set({ isLoading: true });

          try {
            const { user } = await authApi.signIn(email, password);

            if (user) {
              // Set user immediately so modal can close, then fetch profile data
              set({
                user,
                isInitialized: true,
                isLoading: false,
              });

              // Fetch profile data - this updates the store when complete
              // Using void to indicate intentionally not awaiting
              void get().refreshProfile().catch(() => {});

              // Also fetch other data in background
              Promise.allSettled([
                authApi.getUserInstruments(user.id),
                authApi.getAllAchievements(),
                authApi.getUserAchievements(user.id),
                authApi.getFriends(user.id),
              ]).then((results) => {
                const instruments = results[0].status === 'fulfilled' ? results[0].value : [];
                const achievements = results[1].status === 'fulfilled' ? results[1].value : [];
                const unlockedAchievements = results[2].status === 'fulfilled' ? results[2].value : [];
                const friendsResult = results[3].status === 'fulfilled' ? results[3].value : { friends: [], pending: [] };

                useAuthStore.setState({
                  instruments,
                  achievements,
                  unlockedAchievements,
                  friends: friendsResult.friends,
                  pendingFriendRequests: friendsResult.pending,
                });
              }).catch(() => {});
            } else {
              set({ isLoading: false, isInitialized: true });
            }
          } catch (error) {
            set({ isLoading: false, isInitialized: true });
            throw error;
          }
        },

        signInWithGoogle: async () => {
          set({ isLoading: true });
          try {
            await authApi.signInWithGoogle();
          } finally {
            set({ isLoading: false });
          }
        },

        signInWithDiscord: async () => {
          set({ isLoading: true });
          try {
            await authApi.signInWithDiscord();
          } finally {
            set({ isLoading: false });
          }
        },

        signOut: async () => {
          set({ isLoading: true });
          try {
            await authApi.signOut();
            get().reset();
          } finally {
            set({ isLoading: false });
          }
        },

        updateProfile: async (updates) => {
          const { user, profile } = get();
          if (!user || !profile) return;

          const updatedProfile = await authApi.updateProfile(user.id, updates);
          if (updatedProfile) {
            set({ profile: updatedProfile });
          }
        },

        updateAvatar: async (avatar) => {
          const { user } = get();
          if (!user) return;

          await authApi.updateAvatar(user.id, avatar);
          set({ avatar });
        },

        refreshProfile: async () => {
          const { user } = get();
          if (!user) return;

          const [profile, avatar, stats] = await Promise.all([
            authApi.getUserProfile(user.id),
            authApi.getUserAvatar(user.id),
            authApi.getUserStats(user.id),
          ]);

          set({ profile, avatar, stats });
        },

        addInstrument: async (instrumentId, category, isPrimary = false) => {
          const { user, instruments } = get();
          if (!user) return;

          const newInstrument = await authApi.addUserInstrument(user.id, instrumentId, category, isPrimary);

          const updatedInstruments = isPrimary
            ? [newInstrument, ...instruments.filter((i) => i.instrumentId !== instrumentId).map((i) => ({ ...i, isPrimary: false }))]
            : [...instruments.filter((i) => i.instrumentId !== instrumentId), newInstrument];

          set({ instruments: updatedInstruments });

          // Check for achievement
          if (!get().unlockedAchievements.find((a) => a.achievementId === 'finding_your_voice')) {
            await get().checkAndUnlockAchievements();
          }
        },

        setPrimaryInstrument: async (instrumentId) => {
          const { user, instruments } = get();
          if (!user) return;

          const instrument = instruments.find((i) => i.instrumentId === instrumentId);
          if (!instrument) return;

          await authApi.addUserInstrument(user.id, instrumentId, instrument.category, true);

          set({
            instruments: instruments.map((i) => ({
              ...i,
              isPrimary: i.instrumentId === instrumentId,
            })),
          });
        },

        addXP: async (amount, reason, sourceType, sourceId) => {
          const { user, profile } = get();
          if (!user || !profile) return { leveledUp: false, newLevel: profile?.level || 1 };

          const result = await authApi.addXP(user.id, amount, reason, sourceType, sourceId);

          set({
            profile: {
              ...profile,
              totalXp: result.newXp,
              level: result.newLevel,
            },
          });

          return { leveledUp: result.leveledUp, newLevel: result.newLevel };
        },

        checkAndUnlockAchievements: async () => {
          const { user, profile, stats, unlockedAchievements, achievements, instruments, friends } = get();
          if (!user || !profile || !stats) return [];

          const unlockedIds = new Set(unlockedAchievements.map((a) => a.achievementId));
          const newlyUnlocked: string[] = [];

          for (const achievement of achievements) {
            if (unlockedIds.has(achievement.id)) continue;

            let shouldUnlock = false;
            const criteria = achievement.criteria;

            switch (criteria.type) {
              case 'rooms_joined':
                shouldUnlock = stats.roomsJoined >= (criteria.count || 1);
                break;
              case 'messages_sent':
                shouldUnlock = stats.messagesSent >= (criteria.count || 1);
                break;
              case 'instrument_set':
                shouldUnlock = instruments.some((i) => i.isPrimary);
                break;
              case 'sessions_completed':
                shouldUnlock = stats.totalSessions >= (criteria.count || 1);
                break;
              case 'total_jam_hours':
                shouldUnlock = stats.totalJamSeconds / 3600 >= (criteria.count || 1);
                break;
              case 'friends_count':
                shouldUnlock = friends.length >= (criteria.count || 1);
                break;
              case 'unique_collaborators':
                shouldUnlock = stats.uniqueCollaborators >= (criteria.count || 1);
                break;
              case 'rooms_created':
                shouldUnlock = stats.roomsCreated >= (criteria.count || 1);
                break;
              case 'daily_streak':
                shouldUnlock = profile.currentDailyStreak >= (criteria.count || 1);
                break;
              case 'founding_member':
                const year = new Date(profile.createdAt).getFullYear();
                shouldUnlock = (criteria.years as number[])?.includes(year);
                break;
            }

            if (shouldUnlock) {
              await authApi.unlockAchievement(user.id, achievement.id);
              newlyUnlocked.push(achievement.id);
            }
          }

          if (newlyUnlocked.length > 0) {
            await get().refreshAchievements();
          }

          return newlyUnlocked;
        },

        refreshAchievements: async () => {
          const { user } = get();
          if (!user) return;

          const unlockedAchievements = await authApi.getUserAchievements(user.id);
          set({ unlockedAchievements });
        },

        sendFriendRequest: async (friendId) => {
          const { user } = get();
          if (!user) return;

          await authApi.sendFriendRequest(user.id, friendId);
        },

        acceptFriendRequest: async (friendId) => {
          const { user } = get();
          if (!user) return;

          await authApi.acceptFriendRequest(user.id, friendId);
          await get().refreshFriends();
        },

        removeFriend: async (friendId) => {
          const { user, friends } = get();
          if (!user) return;

          await authApi.removeFriend(user.id, friendId);
          set({ friends: friends.filter((f) => f.id !== friendId) });
        },

        refreshFriends: async () => {
          const { user } = get();
          if (!user) return;

          const { friends, pending } = await authApi.getFriends(user.id);
          set({ friends, pendingFriendRequests: pending });
        },

        markNotificationRead: async (notificationId) => {
          const { notifications } = get();
          set({
            notifications: notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
            ),
            unreadNotificationCount: Math.max(0, get().unreadNotificationCount - 1),
          });
        },

        clearNotifications: async () => {
          set({ notifications: [], unreadNotificationCount: 0 });
        },

        reset: () => {
          set(initialState);
        },
      })
  )
);

// Subscribe to auth state changes - this runs synchronously when the module loads
// to ensure the listener is registered before INITIAL_SESSION fires
if (typeof window !== 'undefined') {
  authApi.supabaseAuth.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();

    if (event === 'SIGNED_IN' && session?.user) {
      // Only initialize if not already initialized or loading
      // The signIn() method handles its own state updates for email/password login
      // This handler is mainly for OAuth flows where signIn() wasn't called directly
      const currentState = useAuthStore.getState();
      if (!currentState.isInitialized && !currentState.isLoading) {
        await useAuthStore.getState().initialize();
      }
    } else if (event === 'SIGNED_OUT') {
      store.reset();
    } else if (event === 'INITIAL_SESSION') {
      // Handle initial session on page load - this fires when Supabase has
      // finished restoring the session from localStorage
      if (!store.isInitialized && !store.isLoading) {
        if (session?.user) {
          // User is logged in - load their data
          await store.initialize();
        } else {
          // No user session - mark as initialized (not loading, just no user)
          useAuthStore.setState({ isInitialized: true });
        }
      }
    }
  });
}
