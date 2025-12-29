'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UserMenu } from '@/components/auth/UserMenu';
import { getLevelTitle, xpProgress } from '@/types/user';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Users,
  MessageSquare,
  Music,
  Trophy,
  Flame,
  Zap,
  TrendingUp,
  Calendar,
  Target,
  Upload,
  Sparkles,
  FolderOpen,
  Heart,
} from 'lucide-react';

// Days of week for heatmap
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Hours for activity chart
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function StatsPage() {
  const router = useRouter();
  const { profile, stats, instruments, unlockedAchievements, friends } = useAuthStore();

  // Calculate derived stats
  const derivedStats = useMemo(() => {
    if (!stats || !profile) return null;

    const totalHours = Math.floor(stats.totalJamSeconds / 3600);
    const totalMinutes = Math.floor((stats.totalJamSeconds % 3600) / 60);
    const avgSessionMinutes = stats.totalSessions > 0
      ? Math.round((stats.totalJamSeconds / stats.totalSessions) / 60)
      : 0;
    const longestSessionHours = Math.floor(stats.longestSessionSeconds / 3600);
    const longestSessionMinutes = Math.floor((stats.longestSessionSeconds % 3600) / 60);

    return {
      totalHours,
      totalMinutes,
      avgSessionMinutes,
      longestSessionHours,
      longestSessionMinutes,
    };
  }, [stats, profile]);

  // Get max value for activity heatmap
  const maxActivityByHour = useMemo(() => {
    if (!stats?.activityByHour) return 1;
    return Math.max(...stats.activityByHour, 1);
  }, [stats]);

  const maxActivityByDay = useMemo(() => {
    if (!stats?.activityByDay) return 1;
    return Math.max(...stats.activityByDay, 1);
  }, [stats]);

  if (!profile) {
    router.push('/');
    return null;
  }

  const progress = xpProgress(profile.totalXp);
  const levelTitle = getLevelTitle(profile.level);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Statistics
          </h1>
          <UserMenu />
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-8">
        {/* Level & XP Card */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="text-4xl font-bold text-white">{profile.level}</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {levelTitle}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-3">
                Level {profile.level} - {profile.totalXp.toLocaleString()} total XP
              </p>
              <div className="w-full max-w-md mx-auto md:mx-0 mb-2">
                <Progress value={progress.percentage} className="h-3" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {progress.current.toLocaleString()} / {progress.required.toLocaleString()} XP to Level {profile.level + 1}
              </p>
            </div>
            {profile.currentDailyStreak > 0 && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
                  <Flame className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-orange-500">{profile.currentDailyStreak}</p>
                <p className="text-xs text-gray-500">Day Streak</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Clock className="w-6 h-6 text-blue-500" />}
            label="Total Jam Time"
            value={derivedStats ? `${derivedStats.totalHours}h ${derivedStats.totalMinutes}m` : '0h 0m'}
            color="blue"
          />
          <StatCard
            icon={<Music className="w-6 h-6 text-green-500" />}
            label="Sessions"
            value={stats?.totalSessions || 0}
            color="green"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-purple-500" />}
            label="Collaborators"
            value={stats?.uniqueCollaborators || 0}
            color="purple"
          />
          <StatCard
            icon={<Trophy className="w-6 h-6 text-yellow-500" />}
            label="Achievements"
            value={unlockedAchievements.length}
            color="yellow"
          />
        </div>

        {/* Detailed Stats */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Jam Session Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-500" />
              Jam Session Stats
            </h3>
            <div className="space-y-4">
              <StatRow
                label="Total Sessions"
                value={stats?.totalSessions || 0}
                icon={<Target className="w-4 h-4" />}
              />
              <StatRow
                label="Sessions This Week"
                value={stats?.sessionsThisWeek || 0}
                icon={<Calendar className="w-4 h-4" />}
              />
              <StatRow
                label="Sessions This Month"
                value={stats?.sessionsThisMonth || 0}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatRow
                label="Average Session"
                value={`${derivedStats?.avgSessionMinutes || 0} min`}
                icon={<Clock className="w-4 h-4" />}
              />
              <StatRow
                label="Longest Session"
                value={`${derivedStats?.longestSessionHours || 0}h ${derivedStats?.longestSessionMinutes || 0}m`}
                icon={<Zap className="w-4 h-4" />}
              />
            </div>
          </Card>

          {/* Social Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Social Stats
            </h3>
            <div className="space-y-4">
              <StatRow
                label="Friends"
                value={friends.length}
                icon={<Users className="w-4 h-4" />}
              />
              <StatRow
                label="Unique Collaborators"
                value={stats?.uniqueCollaborators || 0}
                icon={<Heart className="w-4 h-4" />}
              />
              <StatRow
                label="Messages Sent"
                value={stats?.messagesSent || 0}
                icon={<MessageSquare className="w-4 h-4" />}
              />
              <StatRow
                label="Reactions Given"
                value={stats?.reactionsGiven || 0}
                icon={<Flame className="w-4 h-4" />}
              />
              <StatRow
                label="Reactions Received"
                value={stats?.reactionsReceived || 0}
                icon={<Sparkles className="w-4 h-4" />}
              />
            </div>
          </Card>

          {/* Room Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-500" />
              Room Stats
            </h3>
            <div className="space-y-4">
              <StatRow
                label="Rooms Created"
                value={stats?.roomsCreated || 0}
                icon={<FolderOpen className="w-4 h-4" />}
              />
              <StatRow
                label="Rooms Joined"
                value={stats?.roomsJoined || 0}
                icon={<Users className="w-4 h-4" />}
              />
            </div>
          </Card>

          {/* Creation Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              Creation Stats
            </h3>
            <div className="space-y-4">
              <StatRow
                label="Tracks Uploaded"
                value={stats?.tracksUploaded || 0}
                icon={<Upload className="w-4 h-4" />}
              />
              <StatRow
                label="AI Tracks Generated"
                value={stats?.tracksGenerated || 0}
                icon={<Sparkles className="w-4 h-4" />}
              />
              <StatRow
                label="Stems Separated"
                value={stats?.stemsSeparated || 0}
                icon={<Music className="w-4 h-4" />}
              />
            </div>
          </Card>
        </div>

        {/* Activity Heatmaps */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Activity by Hour */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Activity by Hour
            </h3>
            <div className="flex flex-wrap gap-1">
              {HOURS.map((hour) => {
                const activity = stats?.activityByHour?.[hour] || 0;
                const intensity = activity / maxActivityByHour;
                return (
                  <div
                    key={hour}
                    className="relative group"
                  >
                    <div
                      className="w-6 h-8 rounded-sm transition-all hover:scale-110"
                      style={{
                        backgroundColor: intensity > 0
                          ? `rgba(99, 102, 241, ${0.2 + intensity * 0.8})`
                          : 'rgba(156, 163, 175, 0.2)',
                      }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {hour}:00 - {activity} sessions
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>12AM</span>
              <span>6AM</span>
              <span>12PM</span>
              <span>6PM</span>
              <span>12AM</span>
            </div>
          </Card>

          {/* Activity by Day */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Activity by Day
            </h3>
            <div className="space-y-2">
              {DAYS.map((day, index) => {
                const activity = stats?.activityByDay?.[index] || 0;
                const percentage = (activity / maxActivityByDay) * 100;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-10 text-sm text-gray-500 dark:text-gray-400">{day}</span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {activity}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Instruments */}
        {instruments.length > 0 && (
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-500" />
              Your Instruments
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {instruments.map((inst) => (
                <div
                  key={inst.id}
                  className={`p-4 rounded-xl ${
                    inst.isPrimary
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{inst.variant || '🎵'}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {inst.instrumentId}
                      </p>
                      {inst.isPrimary && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400">Primary</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Level {inst.level}</span>
                    <span>{Math.round(inst.totalHours)}h played</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Streak Info */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Streak Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-2">
                <Flame className="w-8 h-8 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.currentDailyStreak}
              </p>
              <p className="text-sm text-gray-500">Current Streak</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.longestDailyStreak}
              </p>
              <p className="text-sm text-gray-500">Longest Streak</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.lastActiveDate
                  ? new Date(profile.lastActiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'N/A'}
              </p>
              <p className="text-sm text-gray-500">Last Active</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </Card>
  );
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
