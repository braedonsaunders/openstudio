'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import { Card } from '@/components/ui/card';
import { getActivityFeed, getUserAvatar, type ActivityItem } from '@/lib/supabase/auth';
import type { Avatar } from '@/types/user';
import { ALL_ACHIEVEMENTS } from '@/data/achievements';
import {
  Trophy,
  TrendingUp,
  Users,
  Music,
  Home,
  Loader2,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

export function ActivityFeed({ limit = 20, showHeader = true, className = '' }: ActivityFeedProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [avatarCache, setAvatarCache] = useState<Record<string, Avatar | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadActivityFeed();
    }
  }, [user]);

  const loadActivityFeed = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const feed = await getActivityFeed(user.id, limit);
      setActivities(feed);

      // Fetch avatars
      const newCache = { ...avatarCache };
      for (const item of feed) {
        if (item.userId && !newCache[item.userId]) {
          const avatar = await getUserAvatar(item.userId);
          newCache[item.userId] = avatar;
        }
      }
      setAvatarCache(newCache);
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityContent = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'achievement': {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === activity.data.achievementId);
        return {
          icon: <Trophy className="w-5 h-5 text-yellow-500" />,
          text: `unlocked the achievement "${achievement?.name || activity.data.name}"`,
          highlight: `+${achievement?.xpReward || activity.data.xpReward} XP`,
        };
      }
      case 'level_up':
        return {
          icon: <TrendingUp className="w-5 h-5 text-purple-500" />,
          text: `reached Level ${activity.data.newLevel}`,
          highlight: activity.data.title as string,
        };
      case 'friend':
        return {
          icon: <Users className="w-5 h-5 text-indigo-500" />,
          text: 'made a new friend',
          highlight: null,
        };
      case 'session': {
        const duration = activity.data.durationSeconds as number;
        const minutes = Math.floor(duration / 60);
        const hours = Math.floor(minutes / 60);
        const timeStr = hours > 0
          ? `${hours}h ${minutes % 60}m`
          : `${minutes}m`;
        return {
          icon: <Music className="w-5 h-5 text-green-500" />,
          text: `completed a ${timeStr} jam session`,
          highlight: `${activity.data.collaboratorCount} musicians`,
        };
      }
      case 'room_created':
        return {
          icon: <Home className="w-5 h-5 text-blue-500" />,
          text: 'created a new room',
          highlight: null,
        };
      default:
        return {
          icon: <Activity className="w-5 h-5 text-gray-500" />,
          text: 'did something',
          highlight: null,
        };
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <Activity className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No activity yet</h3>
        <p className="text-sm text-gray-500">
          Activity from you and your friends will appear here
        </p>
      </Card>
    );
  }

  return (
    <div className={className}>
      {showHeader && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          Activity Feed
        </h3>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {activities.map((activity) => {
            const content = getActivityContent(activity);
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="cursor-pointer"
                      onClick={() => activity.user && router.push(`/profile/${activity.user.username}`)}
                    >
                      <AvatarDisplay
                        avatar={avatarCache[activity.userId]}
                        size="sm"
                        username={activity.user?.username || ''}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span
                          className="font-medium hover:underline cursor-pointer"
                          onClick={() => activity.user && router.push(`/profile/${activity.user.username}`)}
                        >
                          {activity.user?.displayName || 'Unknown'}
                        </span>{' '}
                        {content.text}
                      </p>
                      {content.highlight && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs rounded-full">
                          {content.icon}
                          {content.highlight}
                        </span>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>

                    {/* Icon */}
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      {content.icon}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default ActivityFeed;
