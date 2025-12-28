'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_TIERS,
  getAchievementProgress,
  getTotalPossibleXP,
  type AchievementCategory,
  type AchievementDefinition,
} from '@/data/achievements';
import {
  ArrowLeft,
  Trophy,
  Lock,
  Check,
  Filter,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { motion, AnimatePresence } from 'framer-motion';

type FilterType = 'all' | 'unlocked' | 'locked' | AchievementCategory;

export default function AchievementsPage() {
  const router = useRouter();
  const { profile, stats, unlockedAchievements, friends, instruments } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementDefinition | null>(null);

  // Create a set of unlocked achievement IDs for quick lookup
  const unlockedIds = useMemo(() => {
    return new Set(unlockedAchievements.map(a => a.achievementId));
  }, [unlockedAchievements]);

  // Build stats object for progress calculation
  const progressStats = useMemo(() => ({
    totalSessions: stats?.totalSessions || 0,
    uniqueCollaborators: stats?.uniqueCollaborators || 0,
    totalJamSeconds: stats?.totalJamSeconds || 0,
    longestSessionSeconds: stats?.longestSessionSeconds || 0,
    messagesSent: stats?.messagesSent || 0,
    friendsCount: friends?.length || 0,
    reactionsReceived: stats?.reactionsReceived || 0,
    reactionsGiven: stats?.reactionsGiven || 0,
    roomsCreated: stats?.roomsCreated || 0,
    roomsJoined: stats?.roomsJoined || 0,
    tracksUploaded: stats?.tracksUploaded || 0,
    tracksGenerated: stats?.tracksGenerated || 0,
    stemsSeparated: stats?.stemsSeparated || 0,
    dailyStreak: profile?.currentDailyStreak || 0,
    instrumentsPlayed: instruments?.length || 0,
  }), [stats, friends, profile, instruments]);

  // Filter and search achievements
  const filteredAchievements = useMemo(() => {
    let achievements = ALL_ACHIEVEMENTS;

    // Apply category/status filter
    if (filter === 'unlocked') {
      achievements = achievements.filter(a => unlockedIds.has(a.id));
    } else if (filter === 'locked') {
      achievements = achievements.filter(a => !unlockedIds.has(a.id));
    } else if (filter !== 'all' && ACHIEVEMENT_CATEGORIES[filter as AchievementCategory]) {
      achievements = achievements.filter(a => a.category === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      achievements = achievements.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
      );
    }

    return achievements;
  }, [filter, searchQuery, unlockedIds]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const totalAchievements = ALL_ACHIEVEMENTS.filter(a => !a.isHidden).length;
    const unlockedCount = unlockedAchievements.length;
    const totalXP = getTotalPossibleXP();
    const earnedXP = unlockedAchievements.reduce((sum, ua) => {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === ua.achievementId);
      return sum + (achievement?.xpReward || 0);
    }, 0);

    return {
      count: unlockedCount,
      total: totalAchievements,
      percentage: (unlockedCount / totalAchievements) * 100,
      earnedXP,
      totalXP,
    };
  }, [unlockedAchievements]);

  // Get unlock date for an achievement
  const getUnlockDate = (achievementId: string): string | null => {
    const ua = unlockedAchievements.find(a => a.achievementId === achievementId);
    return ua?.unlockedAt || null;
  };

  if (!profile) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Achievements
          </h1>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Overall Progress Card */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/25">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {overallProgress.count} / {overallProgress.total} Achievements
              </h2>
              <div className="w-full max-w-md mx-auto md:mx-0 mb-2">
                <Progress value={overallProgress.percentage} className="h-3" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {overallProgress.earnedXP.toLocaleString()} / {overallProgress.totalXP.toLocaleString()} XP earned from achievements
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {Math.round(overallProgress.percentage)}%
              </div>
              <p className="text-sm text-gray-500">Complete</p>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            <FilterButton
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All
            </FilterButton>
            <FilterButton
              active={filter === 'unlocked'}
              onClick={() => setFilter('unlocked')}
            >
              <Check className="w-4 h-4" />
              Unlocked ({unlockedAchievements.length})
            </FilterButton>
            <FilterButton
              active={filter === 'locked'}
              onClick={() => setFilter('locked')}
            >
              <Lock className="w-4 h-4" />
              Locked
            </FilterButton>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key as AchievementCategory)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === key
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>

        {/* Achievements Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          <AnimatePresence mode="popLayout">
            {filteredAchievements.map((achievement) => {
              const isUnlocked = unlockedIds.has(achievement.id);
              const unlockDate = getUnlockDate(achievement.id);
              const progress = getAchievementProgress(achievement, progressStats);
              const tier = achievement.tier || 'bronze';
              const tierStyle = ACHIEVEMENT_TIERS[tier];

              return (
                <motion.div
                  key={achievement.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Card
                    className={`h-full p-4 cursor-pointer transition-all hover:shadow-lg flex flex-col ${
                      isUnlocked
                        ? `${tierStyle.bgColor} ${tierStyle.borderColor} border-2`
                        : achievement.isHidden && !isUnlocked
                        ? 'opacity-75'
                        : ''
                    }`}
                    onClick={() => setSelectedAchievement(achievement)}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                        isUnlocked
                          ? tierStyle.bgColor
                          : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        {achievement.isHidden && !isUnlocked ? (
                          <span className="text-gray-400">?</span>
                        ) : (
                          achievement.icon
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold truncate ${
                            isUnlocked ? tierStyle.textColor : 'text-gray-900 dark:text-white'
                          }`}>
                            {achievement.isHidden && !isUnlocked
                              ? 'Hidden Achievement'
                              : achievement.name}
                          </h3>
                          {isUnlocked && (
                            <Check className={`w-4 h-4 shrink-0 ${tierStyle.textColor}`} />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
                          {achievement.isHidden && !isUnlocked
                            ? achievement.hint || 'Keep exploring to discover this achievement...'
                            : achievement.description}
                        </p>

                        {/* Progress bar for locked achievements */}
                        {!isUnlocked && !achievement.isHidden && progress.target > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{Math.floor(progress.current)} / {progress.target}</span>
                              <span>{Math.round(progress.percentage)}%</span>
                            </div>
                            <Progress value={progress.percentage} className="h-1.5" />
                          </div>
                        )}

                        {/* XP Reward */}
                        <div className="flex items-center gap-2 mt-auto pt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isUnlocked
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {isUnlocked ? 'Earned' : '+'}{achievement.xpReward} XP
                          </span>
                          {unlockDate && (
                            <span className="text-xs text-gray-500">
                              {new Date(unlockDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No achievements found
            </h3>
            <p className="text-gray-500">
              Try adjusting your filters or search query
            </p>
          </div>
        )}
      </main>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <AchievementDetail
                achievement={selectedAchievement}
                isUnlocked={unlockedIds.has(selectedAchievement.id)}
                unlockDate={getUnlockDate(selectedAchievement.id)}
                progress={getAchievementProgress(selectedAchievement, progressStats)}
                onClose={() => setSelectedAchievement(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        active
          ? 'bg-indigo-500 text-white'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function AchievementDetail({
  achievement,
  isUnlocked,
  unlockDate,
  progress,
  onClose,
}: {
  achievement: AchievementDefinition;
  isUnlocked: boolean;
  unlockDate: string | null;
  progress: { current: number; target: number; percentage: number };
  onClose: () => void;
}) {
  const tier = achievement.tier || 'bronze';
  const tierStyle = ACHIEVEMENT_TIERS[tier];
  const category = ACHIEVEMENT_CATEGORIES[achievement.category];

  return (
    <Card className={`p-6 ${isUnlocked ? tierStyle.bgColor : ''}`}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${
          isUnlocked
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/25'
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          {isUnlocked ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              {achievement.icon}
            </motion.span>
          ) : (
            <Lock className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${tierStyle.bgColor} ${tierStyle.textColor}`}>
              {tier}
            </span>
            <span className="text-xs text-gray-500">
              {category.icon} {category.name}
            </span>
          </div>
          <h2 className={`text-xl font-bold ${isUnlocked ? tierStyle.textColor : 'text-gray-900 dark:text-white'}`}>
            {achievement.name}
          </h2>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {achievement.description}
      </p>

      {/* Progress */}
      {!isUnlocked && progress.target > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Progress</span>
            <span>{Math.floor(progress.current)} / {progress.target}</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>
      )}

      {/* Reward */}
      <div className={`p-4 rounded-lg ${isUnlocked ? 'bg-green-500/10' : 'bg-indigo-500/10'} mb-6`}>
        <div className="flex items-center gap-3">
          <Sparkles className={`w-5 h-5 ${isUnlocked ? 'text-green-500' : 'text-indigo-500'}`} />
          <div>
            <p className={`font-semibold ${isUnlocked ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {isUnlocked ? 'Earned' : 'Reward'}: +{achievement.xpReward} XP
            </p>
            {unlockDate && (
              <p className="text-sm text-gray-500">
                Unlocked on {new Date(unlockDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Close Button */}
      <Button onClick={onClose} className="w-full">
        Close
      </Button>
    </Card>
  );
}
