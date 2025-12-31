import { createClient, User as SupabaseUser, Session, SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile, UserStats, UserInstrument, Achievement, UserAchievement } from '@/types/user';

// Lazy initialization to avoid issues during static page generation
let supabaseAuthInstance: SupabaseClient | null = null;

function getSupabaseAuth(): SupabaseClient {
  if (!supabaseAuthInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables not configured');
    }

    supabaseAuthInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseAuthInstance;
}

// Export getter for backward compatibility
export const supabaseAuth = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ============================================
// AUTH FUNCTIONS
// ============================================

export async function signUp(email: string, password: string, username: string, displayName: string) {
  // First check if username is available
  const { data: existingUser } = await supabaseAuth
    .from('user_profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existingUser) {
    throw new Error('Username already taken');
  }

  // Sign up with Supabase Auth
  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
      },
    },
  });

  if (error) throw error;

  // Profile, stats, and avatar are created by the database trigger on auth.users
  // No need to create them client-side

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Provide user-friendly error messages
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('Please verify your email address before signing in.');
    }
    throw error;
  }
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithDiscord() {
  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabaseAuth.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabaseAuth.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabaseAuth.auth.getSession();
  return session;
}

export async function getUser(): Promise<SupabaseUser | null> {
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAuth
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return transformProfile(data);
}

export async function getMyProfile(): Promise<UserProfile | null> {
  const user = await getUser();
  if (!user) return null;
  return getUserProfile(user.id);
}

export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.username !== undefined) dbUpdates.username = updates.username;
  if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.links) {
    dbUpdates.link_spotify = updates.links.spotify;
    dbUpdates.link_soundcloud = updates.links.soundcloud;
    dbUpdates.link_youtube = updates.links.youtube;
    dbUpdates.link_instagram = updates.links.instagram;
    dbUpdates.link_website = updates.links.website;
  }
  if (updates.privacy) {
    dbUpdates.profile_visibility = updates.privacy.profileVisibility;
    dbUpdates.show_stats = updates.privacy.showStats;
    dbUpdates.show_activity = updates.privacy.showActivity;
    dbUpdates.allow_friend_requests = updates.privacy.allowFriendRequests;
    dbUpdates.allow_room_invites = updates.privacy.allowRoomInvites;
  }
  if (updates.preferences) {
    dbUpdates.preferences = updates.preferences;
  }

  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAuth
    .from('user_profiles')
    .update(dbUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data ? transformProfile(data) : null;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await supabaseAuth
    .from('user_profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  return !data;
}


// ============================================
// STATS FUNCTIONS
// ============================================

export async function getUserStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabaseAuth
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    totalJamSeconds: data.total_jam_seconds,
    averageSessionSeconds: data.average_session_seconds,
    longestSessionSeconds: data.longest_session_seconds,
    totalSessions: data.total_sessions,
    sessionsThisWeek: data.sessions_this_week,
    sessionsThisMonth: data.sessions_this_month,
    uniqueCollaborators: data.unique_collaborators,
    reactionsReceived: data.reactions_received,
    reactionsGiven: data.reactions_given,
    messagesSent: data.messages_sent,
    roomsCreated: data.rooms_created,
    roomsJoined: data.rooms_joined,
    tracksUploaded: data.tracks_uploaded,
    tracksGenerated: data.tracks_generated,
    stemsSeparated: data.stems_separated,
    activityByHour: data.activity_by_hour || [],
    activityByDay: data.activity_by_day || [],
  };
}

export async function incrementStat(userId: string, stat: string, amount: number = 1): Promise<void> {
  // Use RPC for atomic increment
  const { error } = await supabaseAuth.rpc('increment_stat', {
    p_user_id: userId,
    p_stat: stat,
    p_amount: amount,
  });

  // Fallback to regular update if RPC doesn't exist
  if (error) {
    const { data: currentStats } = await supabaseAuth
      .from('user_stats')
      .select(stat)
      .eq('user_id', userId)
      .single();

    if (currentStats) {
      const statsRecord = currentStats as unknown as Record<string, number>;
      await supabaseAuth
        .from('user_stats')
        .update({ [stat]: (statsRecord[stat] || 0) + amount })
        .eq('user_id', userId);
    }
  }
}

// ============================================
// INSTRUMENTS FUNCTIONS
// ============================================

export async function getUserInstruments(userId: string): Promise<UserInstrument[]> {
  const { data, error } = await supabaseAuth
    .from('user_instruments')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });

  if (error || !data) return [];

  return data.map((inst) => ({
    id: inst.id,
    instrumentId: inst.instrument_id,
    category: inst.category,
    isPrimary: inst.is_primary,
    variant: inst.variant,
    finish: inst.finish,
    totalHours: inst.total_hours,
    totalSessions: inst.total_sessions,
    level: inst.level,
    xp: inst.xp,
    lastPlayedAt: inst.last_played_at,
  }));
}

export async function addUserInstrument(userId: string, instrumentId: string, category: string, isPrimary: boolean = false): Promise<UserInstrument> {
  // If setting as primary, unset other primaries first
  if (isPrimary) {
    await supabaseAuth
      .from('user_instruments')
      .update({ is_primary: false })
      .eq('user_id', userId);
  }

  const { data, error } = await supabaseAuth
    .from('user_instruments')
    .upsert(
      {
        user_id: userId,
        instrument_id: instrumentId,
        category,
        is_primary: isPrimary,
      },
      {
        onConflict: 'user_id,instrument_id',
      }
    )
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    instrumentId: data.instrument_id,
    category: data.category,
    isPrimary: data.is_primary,
    variant: data.variant,
    finish: data.finish,
    totalHours: data.total_hours,
    totalSessions: data.total_sessions,
    level: data.level,
    xp: data.xp,
    lastPlayedAt: data.last_played_at,
  };
}

export async function removeUserInstrument(userId: string, instrumentId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('user_instruments')
    .delete()
    .eq('user_id', userId)
    .eq('instrument_id', instrumentId);

  if (error) throw error;
}

// ============================================
// XP FUNCTIONS
// ============================================

// Helper to check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function addXP(userId: string, amount: number, reason: string, sourceType?: string, sourceId?: string): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
  // Only pass sourceId if it's a valid UUID (database expects uuid type)
  const validSourceId = sourceId && isValidUUID(sourceId) ? sourceId : null;

  const { data, error } = await supabaseAuth.rpc('add_user_xp', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_source_type: sourceType || null,
    p_source_id: validSourceId,
  });

  if (error) throw error;

  return {
    newXp: data[0].new_xp,
    newLevel: data[0].new_level,
    leveledUp: data[0].leveled_up,
  };
}

export async function updateStreak(userId: string): Promise<{ newStreak: number; streakContinued: boolean }> {
  const { data, error } = await supabaseAuth.rpc('update_user_streak', {
    p_user_id: userId,
  });

  if (error) throw error;

  return {
    newStreak: data[0].new_streak,
    streakContinued: data[0].streak_continued,
  };
}

// ============================================
// ACHIEVEMENTS FUNCTIONS
// ============================================

export async function getAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabaseAuth
    .from('achievements')
    .select('*')
    .order('sort_order');

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    icon: a.icon,
    xpReward: a.xp_reward,
    criteria: a.criteria,
    isHidden: a.is_hidden,
  }));
}

export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await supabaseAuth
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);

  if (error || !data) return [];

  return data.map((a) => ({
    achievementId: a.achievement_id,
    unlockedAt: a.unlocked_at,
  }));
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<void> {
  // Check if already unlocked
  const { data: existing } = await supabaseAuth
    .from('user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .maybeSingle();

  if (existing) return;

  // Get achievement XP reward
  const { data: achievement } = await supabaseAuth
    .from('achievements')
    .select('xp_reward')
    .eq('id', achievementId)
    .maybeSingle();

  // Unlock achievement
  const { error } = await supabaseAuth
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievementId,
    });

  if (error) throw error;

  // Award XP
  if (achievement) {
    await addXP(userId, achievement.xp_reward, `Achievement: ${achievementId}`, 'achievement', achievementId);
  }
}

// ============================================
// FRIENDS FUNCTIONS
// ============================================

export async function sendFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('friendships')
    .insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    });

  if (error) throw error;
}

export async function acceptFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('friendships')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('friend_id', userId)
    .eq('user_id', friendId);

  if (error) throw error;

  // Create reverse friendship
  await supabaseAuth
    .from('friendships')
    .upsert({
      user_id: userId,
      friend_id: friendId,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  // Validate UUIDs to prevent filter injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId) || !uuidRegex.test(friendId)) {
    throw new Error('Invalid user ID format');
  }

  // Delete both directions of the friendship using separate queries
  // This is safer than using .or() with string interpolation
  await Promise.all([
    supabaseAuth
      .from('friendships')
      .delete()
      .eq('user_id', userId)
      .eq('friend_id', friendId),
    supabaseAuth
      .from('friendships')
      .delete()
      .eq('user_id', friendId)
      .eq('friend_id', userId),
  ]);
}

export async function getFriends(userId: string): Promise<{ friends: UserProfile[]; pending: UserProfile[] }> {
  // Get accepted friends
  const { data: friendships } = await supabaseAuth
    .from('friendships')
    .select(`
      friend_id,
      status,
      jams_together,
      total_time_together_seconds,
      friend:friend_id(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'accepted');

  // Get pending requests
  const { data: pendingRequests } = await supabaseAuth
    .from('friendships')
    .select(`
      user_id,
      requester:user_id(*)
    `)
    .eq('friend_id', userId)
    .eq('status', 'pending');

  const friends = (friendships || [])
    .filter((f) => f.friend)
    .map((f) => transformProfile(f.friend as unknown as Record<string, unknown>));

  const pending = (pendingRequests || [])
    .filter((r) => r.requester)
    .map((r) => transformProfile(r.requester as unknown as Record<string, unknown>));

  return { friends, pending };
}

// ============================================
// CHAT FUNCTIONS
// ============================================

export async function saveChatMessage(
  roomId: string,
  userId: string,
  content: string,
  messageType: 'text' | 'system' | 'reaction' | 'join' | 'leave' = 'text',
  reactionType?: string,
  targetUserId?: string
): Promise<void> {
  // Prevent saving blank messages (except reactions which have emoji content)
  const trimmedContent = content?.trim();
  if (!trimmedContent && messageType === 'text') return;

  const { error } = await supabaseAuth
    .from('room_chat_messages')
    .insert({
      room_id: roomId,
      user_id: userId,
      content: trimmedContent || content,
      message_type: messageType,
      reaction_type: reactionType,
      target_user_id: targetUserId,
    });

  if (error) throw error;
}

export async function getRoomChatMessages(roomId: string, limit: number = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAuth
    .from('room_chat_messages')
    .select(`
      *,
      user:user_id(id, username, display_name)
    `)
    .eq('room_id', roomId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((msg) => ({
    id: msg.id,
    roomId: msg.room_id,
    userId: msg.user_id,
    user: msg.user ? transformProfile(msg.user as Record<string, unknown>) : undefined,
    content: msg.content,
    messageType: msg.message_type,
    reactionType: msg.reaction_type,
    targetUserId: msg.target_user_id,
    createdAt: msg.created_at,
    isDeleted: msg.is_deleted,
  }));
}

export async function deleteRoomChatMessages(roomId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('room_chat_messages')
    .delete()
    .eq('room_id', roomId);

  if (error) throw error;
}

// ============================================
// SAVED ROOMS FUNCTIONS
// ============================================

export async function saveRoom(room: Partial<SavedRoom> & { code: string; name: string; ownerId: string }): Promise<SavedRoom> {
  const { data, error } = await supabaseAuth
    .from('saved_rooms')
    .upsert({
      owner_id: room.ownerId,
      code: room.code,
      name: room.name,
      description: room.description || '',
      room_type: room.roomType || 'private',
      max_users: room.maxUsers || 10,
      genre: room.genre,
      skill_level: room.skillLevel,
      min_level: room.minLevel || 0,
      theme: room.theme || 'default',
      banner_url: room.bannerUrl,
      welcome_message: room.welcomeMessage,
      rules: room.rules,
      tags: room.tags || [],
      settings: room.settings || {},
    })
    .select()
    .single();

  if (error) throw error;
  return transformSavedRoom(data);
}

export async function getSavedRoom(code: string): Promise<SavedRoom | null> {
  const { data, error } = await supabaseAuth
    .from('saved_rooms')
    .select(`
      *,
      owner:owner_id(*)
    `)
    .eq('code', code)
    .single();

  if (error || !data) return null;
  return transformSavedRoom(data);
}

export async function getPublicRooms(limit: number = 20): Promise<SavedRoom[]> {
  const { data, error } = await supabaseAuth
    .from('saved_rooms')
    .select(`
      *,
      owner:owner_id(*)
    `)
    .eq('room_type', 'public')
    .order('last_active_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(transformSavedRoom);
}

export async function getUserSavedRooms(userId: string): Promise<SavedRoom[]> {
  const { data, error } = await supabaseAuth
    .from('saved_rooms')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map(transformSavedRoom);
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAuth
    .from('user_profiles')
    .select('account_type')
    .eq('id', userId)
    .single();

  return data?.account_type === 'admin';
}

export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabaseAuth
    .from('user_profiles')
    .update({ account_type: isAdmin ? 'admin' : 'free' })
    .eq('id', userId);

  if (error) throw error;
}

export async function banUser(userId: string, reason: string, expiresAt?: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('user_profiles')
    .update({
      is_banned: true,
      ban_reason: reason,
      ban_expires_at: expiresAt,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function unbanUser(userId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('user_profiles')
    .update({
      is_banned: false,
      ban_reason: null,
      ban_expires_at: null,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function getAllUsers(limit: number = 50, offset: number = 0): Promise<{ users: UserProfile[]; total: number }> {
  const { data, error, count } = await supabaseAuth
    .from('user_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { users: [], total: 0 };

  return {
    users: data.map(transformProfile),
    total: count || 0,
  };
}

export async function searchUsers(query: string, limit: number = 20): Promise<UserProfile[]> {
  // Sanitize search query to prevent filter injection
  // Remove any special characters that could be used for injection
  const sanitizedQuery = query.replace(/[%_'"\\;,()]/g, '');

  if (!sanitizedQuery.trim()) {
    return [];
  }

  const { data, error } = await supabaseAuth
    .from('user_profiles')
    .select('*')
    .or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
    .limit(limit);

  if (error || !data) return [];
  return data.map(transformProfile);
}

export async function getAdminStats(): Promise<{
  totalUsers: number;
  activeToday: number;
  totalRooms: number;
  totalJamHours: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalUsers },
    { count: activeToday },
    { count: totalRooms },
    { data: jamStats },
  ] = await Promise.all([
    supabaseAuth.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabaseAuth.from('user_profiles').select('*', { count: 'exact', head: true }).gte('last_online_at', today),
    supabaseAuth.from('saved_rooms').select('*', { count: 'exact', head: true }),
    supabaseAuth.from('user_stats').select('total_jam_seconds'),
  ]);

  const totalJamSeconds = (jamStats || []).reduce((sum, s) => sum + (s.total_jam_seconds || 0), 0);

  return {
    totalUsers: totalUsers || 0,
    activeToday: activeToday || 0,
    totalRooms: totalRooms || 0,
    totalJamHours: Math.round(totalJamSeconds / 3600),
  };
}

export async function logAdminAction(adminId: string, action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
  await supabaseAuth
    .from('admin_audit_log')
    .insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformProfile(data: Record<string, unknown>): UserProfile {
  return {
    id: data.id as string,
    username: data.username as string,
    displayName: data.display_name as string,
    bio: (data.bio as string) || '',
    accountType: (data.account_type as 'free' | 'pro' | 'admin') || 'free',
    isVerified: data.is_verified as boolean || false,
    isBanned: data.is_banned as boolean || false,
    banReason: data.ban_reason as string | undefined,
    banExpiresAt: data.ban_expires_at as string | undefined,
    totalXp: data.total_xp as number || 0,
    level: data.level as number || 1,
    currentDailyStreak: data.current_daily_streak as number || 0,
    longestDailyStreak: data.longest_daily_streak as number || 0,
    lastActiveDate: data.last_active_date as string | undefined,
    streakFreezes: data.streak_freezes as number || 0,
    links: {
      spotify: data.link_spotify as string | undefined,
      soundcloud: data.link_soundcloud as string | undefined,
      youtube: data.link_youtube as string | undefined,
      instagram: data.link_instagram as string | undefined,
      website: data.link_website as string | undefined,
    },
    privacy: {
      profileVisibility: (data.profile_visibility as 'public' | 'friends' | 'private') || 'public',
      showStats: data.show_stats as boolean ?? true,
      showActivity: data.show_activity as boolean ?? true,
      allowFriendRequests: data.allow_friend_requests as boolean ?? true,
      allowRoomInvites: data.allow_room_invites as boolean ?? true,
    },
    preferences: (data.preferences as UserPreferences) || {
      defaultSampleRate: 48000,
      defaultBufferSize: 256,
      autoJitterBuffer: true,
      theme: 'dark',
      accentColor: '#6366f1',
      compactMode: false,
      showTutorialTips: true,
      emailNotifications: true,
      soundNotifications: true,
    },
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastOnlineAt: data.last_online_at as string | undefined,
  };
}

function transformSavedRoom(data: Record<string, unknown>): SavedRoom {
  return {
    id: data.id as string,
    ownerId: data.owner_id as string,
    owner: data.owner ? transformProfile(data.owner as Record<string, unknown>) : undefined,
    code: data.code as string,
    name: data.name as string,
    description: (data.description as string) || '',
    roomType: (data.room_type as SavedRoom['roomType']) || 'private',
    maxUsers: data.max_users as number || 10,
    genre: data.genre as string | undefined,
    skillLevel: data.skill_level as SavedRoom['skillLevel'] | undefined,
    minLevel: data.min_level as number || 0,
    minReputation: data.min_reputation as number || 0,
    theme: (data.theme as string) || 'default',
    bannerUrl: data.banner_url as string | undefined,
    welcomeMessage: data.welcome_message as string | undefined,
    rules: data.rules as string | undefined,
    tags: (data.tags as string[]) || [],
    settings: (data.settings as RoomAudioSettings) || {
      sampleRate: 48000,
      bitDepth: 24,
      bufferSize: 256,
      autoJitterBuffer: true,
      backingTrackVolume: 0.8,
      masterVolume: 1.0,
    },
    totalSessions: data.total_sessions as number || 0,
    totalUniqueVisitors: data.total_unique_visitors as number || 0,
    totalJamSeconds: data.total_jam_seconds as number || 0,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    lastActiveAt: data.last_active_at as string | undefined,
  };
}

// ============================================
// NOTIFICATIONS FUNCTIONS
// ============================================

export async function getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
  const { data, error } = await supabaseAuth
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    linkType: n.link_type,
    linkId: n.link_id,
    isRead: n.is_read,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message?: string,
  linkType?: string,
  linkId?: string
): Promise<void> {
  const { error } = await supabaseAuth
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      link_type: linkType,
      link_id: linkId,
    });

  if (error) throw error;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAuth
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

// ============================================
// ACTIVITY FEED FUNCTIONS
// ============================================

export interface ActivityItem {
  id: string;
  userId: string;
  user?: UserProfile;
  type: 'achievement' | 'level_up' | 'friend' | 'session' | 'room_created';
  data: Record<string, unknown>;
  createdAt: string;
}

export async function getActivityFeed(userId: string, limit: number = 50): Promise<ActivityItem[]> {
  // Get friend IDs
  const { data: friendships } = await supabaseAuth
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  const friendIds = friendships?.map(f => f.friend_id) || [];
  const userIds = [userId, ...friendIds];

  const { data, error } = await supabaseAuth
    .from('activity_feed')
    .select(`
      *,
      user:user_id(id, username, display_name)
    `)
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((item) => ({
    id: item.id,
    userId: item.user_id,
    user: item.user ? transformProfile(item.user as Record<string, unknown>) : undefined,
    type: item.type,
    data: item.data || {},
    createdAt: item.created_at,
  }));
}

export async function createActivityItem(
  userId: string,
  type: ActivityItem['type'],
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAuth
    .from('activity_feed')
    .insert({
      user_id: userId,
      type,
      data,
    });

  if (error) throw error;
}

// ============================================
// SESSION TRACKING FUNCTIONS
// ============================================

export interface SessionRecord {
  id: string;
  userId: string;
  roomId: string;
  joinedAt: string;
  leftAt?: string;
  durationSeconds?: number;
  instrument?: string;
  collaboratorIds: string[];
}

export async function startSession(
  userId: string,
  roomId: string,
  _instrument?: string
): Promise<SessionRecord> {
  // Note: instrument and collaborator_ids columns may not exist in the schema
  // We only insert the core fields that definitely exist
  const { data, error } = await supabaseAuth
    .from('session_history')
    .insert({
      user_id: userId,
      room_id: roomId,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    roomId: data.room_id,
    joinedAt: data.joined_at,
    leftAt: data.left_at,
    durationSeconds: data.duration_seconds,
    instrument: data.instrument || _instrument,
    collaboratorIds: data.collaborator_ids || [],
  };
}

export async function endSession(
  sessionId: string,
  _collaboratorIds: string[]
): Promise<{ durationSeconds: number }> {
  const now = new Date();

  // Get the session to calculate duration
  const { data: session } = await supabaseAuth
    .from('session_history')
    .select('joined_at')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  const joinedAt = new Date(session.joined_at);
  const durationSeconds = Math.floor((now.getTime() - joinedAt.getTime()) / 1000);

  // Note: collaborator_ids column may not exist in older schemas
  // Stats for unique collaborators are tracked separately via updateStats
  const { error } = await supabaseAuth
    .from('session_history')
    .update({
      left_at: now.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', sessionId);

  if (error) throw error;

  return { durationSeconds };
}

export async function updateSessionCollaborators(
  sessionId: string,
  _collaboratorIds: string[]
): Promise<void> {
  // Note: collaborator_ids column may not exist in older schemas
  // This function is kept for API compatibility but is a no-op
  // Unique collaborators are tracked via updateStats in endSession
  if (!sessionId) return;
}

// ============================================
// STATS UPDATE FUNCTIONS
// ============================================

export async function updateStats(
  userId: string,
  updates: Partial<{
    totalJamSeconds: number;
    totalSessions: number;
    longestSessionSeconds: number;
    uniqueCollaborators: number;
    reactionsReceived: number;
    reactionsGiven: number;
    messagesSent: number;
    roomsCreated: number;
    roomsJoined: number;
    tracksUploaded: number;
    tracksGenerated: number;
    stemsSeparated: number;
    activityByHour: number[];
    activityByDay: number[];
  }>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.totalJamSeconds !== undefined) dbUpdates.total_jam_seconds = updates.totalJamSeconds;
  if (updates.totalSessions !== undefined) dbUpdates.total_sessions = updates.totalSessions;
  if (updates.longestSessionSeconds !== undefined) dbUpdates.longest_session_seconds = updates.longestSessionSeconds;
  if (updates.uniqueCollaborators !== undefined) dbUpdates.unique_collaborators = updates.uniqueCollaborators;
  if (updates.reactionsReceived !== undefined) dbUpdates.reactions_received = updates.reactionsReceived;
  if (updates.reactionsGiven !== undefined) dbUpdates.reactions_given = updates.reactionsGiven;
  if (updates.messagesSent !== undefined) dbUpdates.messages_sent = updates.messagesSent;
  if (updates.roomsCreated !== undefined) dbUpdates.rooms_created = updates.roomsCreated;
  if (updates.roomsJoined !== undefined) dbUpdates.rooms_joined = updates.roomsJoined;
  if (updates.tracksUploaded !== undefined) dbUpdates.tracks_uploaded = updates.tracksUploaded;
  if (updates.tracksGenerated !== undefined) dbUpdates.tracks_generated = updates.tracksGenerated;
  if (updates.stemsSeparated !== undefined) dbUpdates.stems_separated = updates.stemsSeparated;
  if (updates.activityByHour !== undefined) dbUpdates.activity_by_hour = updates.activityByHour;
  if (updates.activityByDay !== undefined) dbUpdates.activity_by_day = updates.activityByDay;

  const { error } = await supabaseAuth
    .from('user_stats')
    .update(dbUpdates)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function recordActivity(userId: string): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Get current activity arrays
  const { data: stats } = await supabaseAuth
    .from('user_stats')
    .select('activity_by_hour, activity_by_day')
    .eq('user_id', userId)
    .single();

  if (!stats) return;

  const activityByHour = stats.activity_by_hour || new Array(24).fill(0);
  const activityByDay = stats.activity_by_day || new Array(7).fill(0);

  activityByHour[hour] = (activityByHour[hour] || 0) + 1;
  activityByDay[day] = (activityByDay[day] || 0) + 1;

  await updateStats(userId, { activityByHour, activityByDay });
}

// ============================================
// FOLLOWING FUNCTIONS
// ============================================

export async function followUser(userId: string, targetUserId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('follows')
    .insert({
      follower_id: userId,
      following_id: targetUserId,
    });

  if (error) throw error;
}

export async function unfollowUser(userId: string, targetUserId: string): Promise<void> {
  const { error } = await supabaseAuth
    .from('follows')
    .delete()
    .eq('follower_id', userId)
    .eq('following_id', targetUserId);

  if (error) throw error;
}

export async function getFollowers(userId: string): Promise<UserProfile[]> {
  const { data, error } = await supabaseAuth
    .from('follows')
    .select(`
      follower:follower_id(*)
    `)
    .eq('following_id', userId);

  if (error || !data) return [];

  return data
    .filter(f => f.follower)
    .map(f => transformProfile(f.follower as unknown as Record<string, unknown>));
}

export async function getFollowing(userId: string): Promise<UserProfile[]> {
  const { data, error } = await supabaseAuth
    .from('follows')
    .select(`
      following:following_id(*)
    `)
    .eq('follower_id', userId);

  if (error || !data) return [];

  return data
    .filter(f => f.following)
    .map(f => transformProfile(f.following as unknown as Record<string, unknown>));
}

export async function isFollowing(userId: string, targetUserId: string): Promise<boolean> {
  const { data } = await supabaseAuth
    .from('follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('following_id', targetUserId)
    .single();

  return !!data;
}

// ============================================
// REACTION FUNCTIONS
// ============================================

export async function sendReaction(
  roomId: string,
  fromUserId: string,
  toUserId: string,
  reactionType: string
): Promise<void> {
  // Save the reaction as a chat message
  await saveChatMessage(roomId, fromUserId, reactionType, 'reaction', reactionType, toUserId);

  // Increment receiver's reactions received
  await incrementStat(toUserId, 'reactions_received', 1);

  // Increment sender's reactions given
  await incrementStat(fromUserId, 'reactions_given', 1);
}

// Import types that are needed
import type { SavedRoom, RoomAudioSettings, UserPreferences, ChatMessage, Notification } from '@/types/user';
