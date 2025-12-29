'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getUserProfile, getUserStats, getUserInstruments, getUserAchievements, searchUsers } from '@/lib/supabase/auth';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLevelTitle, xpProgress, INSTRUMENTS } from '@/types/user';
import type { UserProfile, UserStats, UserInstrument, UserAchievement } from '@/types/user';
import { ALL_ACHIEVEMENTS, ACHIEVEMENT_TIERS } from '@/data/achievements';
import {
  ArrowLeft,
  Settings,
  UserPlus,
  UserMinus,
  MessageSquare,
  Trophy,
  Clock,
  Users,
  Music,
  Flame,
  Calendar,
  Globe,
  ExternalLink,
  BarChart3,
  Shield,
  Crown,
} from 'lucide-react';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const { user, profile: currentUserProfile, friends, sendFriendRequest, removeFriend } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [instruments, setInstruments] = useState<UserInstrument[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isPendingFriend, setIsPendingFriend] = useState(false);

  const isOwnProfile = currentUserProfile?.username === username;

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        // Search for user by username
        const users = await searchUsers(username, 1);
        const foundUser = users.find(u => u.username === username);

        if (foundUser) {
          const userProfile = await getUserProfile(foundUser.id);
          const userStats = await getUserStats(foundUser.id);
          const userInstruments = await getUserInstruments(foundUser.id);
          const userAchievements = await getUserAchievements(foundUser.id);

          setProfileUserId(foundUser.id);
          setProfile(userProfile);
          setStats(userStats);
          setInstruments(userInstruments);
          setAchievements(userAchievements);

          // Check friendship status
          if (friends.find(f => f.id === foundUser.id)) {
            setIsFriend(true);
          }
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [username, friends]);

  const handleAddFriend = async () => {
    if (!profile) return;
    await sendFriendRequest(profile.id);
    setIsPendingFriend(true);
  };

  const handleRemoveFriend = async () => {
    if (!profile) return;
    await removeFriend(profile.id);
    setIsFriend(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">User not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">The user @{username} does not exist.</p>
          <Button onClick={() => router.push('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const progress = xpProgress(profile.totalXp);
  const levelTitle = getLevelTitle(profile.level);
  const primaryInstrument = instruments.find(i => i.isPrimary);

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          {isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
          {/* Avatar */}
          <div className="relative">
            <UserAvatar userId={profileUserId || undefined} username={profile.username} size={180} />
            {profile.currentDailyStreak >= 7 && (
              <div className="absolute -bottom-2 -right-2 bg-orange-500 rounded-full p-1.5">
                <Flame className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{profile.displayName}</h1>
              {profile.isVerified && (
                <span title="Verified Musician">
                  <Crown className="w-6 h-6 text-yellow-500" />
                </span>
              )}
              {profile.accountType === 'admin' && (
                <span title="Admin">
                  <Shield className="w-6 h-6 text-red-500" />
                </span>
              )}
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-3">@{profile.username}</p>

            {profile.bio && (
              <p className="text-gray-700 dark:text-gray-300 mb-4 max-w-lg">{profile.bio}</p>
            )}

            {/* Level & XP */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">{levelTitle}</span>
                <span className="text-gray-500">Level {profile.level}</span>
              </div>
              <div className="w-64 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {progress.current.toLocaleString()} / {progress.required.toLocaleString()} XP
              </p>
            </div>

            {/* Primary Instrument */}
            {primaryInstrument && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
                <Music className="w-4 h-4" />
                <span>
                  {INSTRUMENTS[primaryInstrument.instrumentId]?.icon}{' '}
                  {INSTRUMENTS[primaryInstrument.instrumentId]?.name || primaryInstrument.instrumentId}
                </span>
                <span className="text-gray-400 dark:text-gray-600">Level {primaryInstrument.level}</span>
              </div>
            )}

            {/* Social Links */}
            {Object.entries(profile.links).some(([, v]) => v) && (
              <div className="flex items-center gap-3 mb-4">
                {profile.links.website && (
                  <a
                    href={profile.links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {profile.links.spotify && (
                  <a
                    href={profile.links.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 dark:text-gray-400 hover:text-green-500 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {!isOwnProfile && user && (
              <div className="flex items-center gap-3">
                {isFriend ? (
                  <Button variant="outline" onClick={handleRemoveFriend}>
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove Friend
                  </Button>
                ) : isPendingFriend ? (
                  <Button variant="outline" disabled>
                    Request Sent
                  </Button>
                ) : (
                  <Button onClick={handleAddFriend}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                )}
                <Button variant="ghost">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        {stats && profile.privacy.showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Clock}
              label="Total Jam Time"
              value={formatTime(stats.totalJamSeconds)}
            />
            <StatCard
              icon={Music}
              label="Sessions"
              value={stats.totalSessions.toLocaleString()}
            />
            <StatCard
              icon={Users}
              label="Collaborators"
              value={stats.uniqueCollaborators.toLocaleString()}
            />
            <StatCard
              icon={Flame}
              label="Day Streak"
              value={profile.currentDailyStreak.toString()}
              highlight={profile.currentDailyStreak >= 7}
            />
          </div>
        )}

        {/* Tabs Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Instruments */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-500" />
              Instruments
            </h3>
            <div className="space-y-3">
              {instruments.length > 0 ? (
                instruments.map((inst) => (
                  <div
                    key={inst.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      inst.isPrimary ? 'bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {INSTRUMENTS[inst.instrumentId]?.icon || '🎵'}
                      </span>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {INSTRUMENTS[inst.instrumentId]?.name || inst.instrumentId}
                          {inst.isPrimary && (
                            <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">Primary</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Level {inst.level} • {Math.round(inst.totalHours)}h played
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No instruments added yet</p>
              )}
            </div>
          </Card>

          {/* Recent Achievements */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Achievements
              <span className="text-sm text-gray-500 font-normal">({achievements.length})</span>
            </h3>
            <div className="space-y-3">
              {achievements.slice(0, 5).map((ua) => {
                const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
                const tier = achievement?.tier || 'bronze';
                const tierStyle = ACHIEVEMENT_TIERS[tier];

                return (
                  <div
                    key={ua.achievementId}
                    className={`flex items-center gap-3 p-3 rounded-lg ${tierStyle.bgColor} border ${tierStyle.borderColor}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${tierStyle.bgColor}`}>
                      {achievement?.icon || '🏆'}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${tierStyle.textColor}`}>
                        {achievement?.name || ua.achievementId.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(ua.unlockedAt).toLocaleDateString()} • +{achievement?.xpReward || 0} XP
                      </p>
                    </div>
                  </div>
                );
              })}
              {achievements.length === 0 && (
                <p className="text-gray-500">No achievements yet</p>
              )}
              {achievements.length > 5 && (
                <Button variant="ghost" className="w-full" onClick={() => router.push('/achievements')}>
                  View all {achievements.length} achievements
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Activity Heatmap */}
        {stats && profile.privacy.showActivity && (
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-500" />
              Activity
            </h3>
            <div className="flex items-end justify-between gap-1 h-24">
              {stats.activityByHour.map((value, hour) => {
                const maxValue = Math.max(...stats.activityByHour, 1);
                const height = (value / maxValue) * 100;
                return (
                  <div
                    key={hour}
                    className="flex-1 bg-green-500/20 rounded-sm relative group"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-green-500 rounded-sm transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {hour}:00 - {value} sessions
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>12 AM</span>
              <span>6 AM</span>
              <span>12 PM</span>
              <span>6 PM</span>
              <span>12 AM</span>
            </div>
          </Card>
        )}

        {/* Member Since */}
        <div className="mt-8 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4" />
          Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? 'border-orange-500/50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          highlight ? 'bg-orange-500/20' : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          <Icon className={`w-5 h-5 ${highlight ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`} />
        </div>
        <div>
          <p className={`text-xl font-bold ${highlight ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
            {value}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </Card>
  );
}
