'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { searchUsers, getUserAvatar, getFollowers, getFollowing, followUser, unfollowUser } from '@/lib/supabase/auth';
import type { UserProfile, Avatar } from '@/types/user';
import { getLevelTitle } from '@/types/user';
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Search,
  Clock,
  Check,
  X,
  MessageSquare,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'friends' | 'pending' | 'find' | 'followers' | 'following';

interface UserWithAvatar extends UserProfile {
  avatar?: Avatar | null;
}

export default function FriendsPage() {
  const router = useRouter();
  const {
    user,
    profile,
    friends,
    pendingFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    refreshFriends,
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserWithAvatar[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [avatarCache, setAvatarCache] = useState<Record<string, Avatar | null>>({});
  const [selectedUser, setSelectedUser] = useState<UserWithAvatar | null>(null);

  // Fetch followers and following
  useEffect(() => {
    if (user && activeTab === 'followers') {
      getFollowers(user.id).then(setFollowers);
    } else if (user && activeTab === 'following') {
      getFollowing(user.id).then(setFollowing);
    }
  }, [user, activeTab]);

  // Fetch avatars for friends
  useEffect(() => {
    const fetchAvatars = async () => {
      const allUsers = [...friends, ...pendingFriendRequests];
      for (const u of allUsers) {
        if (!avatarCache[u.id]) {
          const avatar = await getUserAvatar(u.id);
          setAvatarCache(prev => ({ ...prev, [u.id]: avatar }));
        }
      }
    };
    fetchAvatars();
  }, [friends, pendingFriendRequests, avatarCache]);

  // Search for users
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsers(searchQuery, 20);
        // Filter out current user and existing friends
        const filteredResults = results.filter(
          u => u.id !== user?.id && !friends.find(f => f.id === u.id)
        );

        // Fetch avatars for results
        const resultsWithAvatars: UserWithAvatar[] = await Promise.all(
          filteredResults.map(async (u) => ({
            ...u,
            avatar: avatarCache[u.id] || await getUserAvatar(u.id),
          }))
        );

        setSearchResults(resultsWithAvatars);

        // Update avatar cache
        const newCache = { ...avatarCache };
        for (const u of resultsWithAvatars) {
          if (u.avatar) newCache[u.id] = u.avatar;
        }
        setAvatarCache(newCache);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user, friends, avatarCache]);

  const handleAcceptRequest = async (friendId: string) => {
    await acceptFriendRequest(friendId);
    await refreshFriends();
  };

  const handleDeclineRequest = async (friendId: string) => {
    await removeFriend(friendId);
    await refreshFriends();
  };

  const handleSendRequest = async (userId: string) => {
    await sendFriendRequest(userId);
    // Remove from search results
    setSearchResults(prev => prev.filter(u => u.id !== userId));
  };

  const handleRemoveFriend = async (friendId: string) => {
    await removeFriend(friendId);
    setSelectedUser(null);
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;
    await followUser(user.id, userId);
    setFollowing(prev => [...prev, searchResults.find(u => u.id === userId)!]);
  };

  const handleUnfollow = async (userId: string) => {
    if (!user) return;
    await unfollowUser(user.id, userId);
    setFollowing(prev => prev.filter(u => u.id !== userId));
  };

  if (!profile) {
    router.push('/');
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'friends', label: 'Friends', icon: Users, count: friends.length },
    { id: 'pending', label: 'Pending', icon: Clock, count: pendingFriendRequests.length },
    { id: 'find', label: 'Find Friends', icon: UserPlus },
    { id: 'followers', label: 'Followers', icon: UserCheck },
    { id: 'following', label: 'Following', icon: UserPlus },
  ];

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
            <Users className="w-5 h-5 text-indigo-500" />
            Friends
          </h1>
          <UserMenu />
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 sm:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{friends.length}</p>
            <p className="text-sm text-gray-500">Friends</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{followers.length}</p>
            <p className="text-sm text-gray-500">Followers</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{following.length}</p>
            <p className="text-sm text-gray-500">Following</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Friends List */}
        {activeTab === 'friends' && (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No friends yet</h3>
                <p className="text-gray-500 mb-4">Find musicians to jam with and add them as friends!</p>
                <Button onClick={() => setActiveTab('find')}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Find Friends
                </Button>
              </Card>
            ) : (
              friends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  user={friend}
                  avatar={avatarCache[friend.id]}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/profile/${friend.username}`)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser({ ...friend, avatar: avatarCache[friend.id] })}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </>
                  }
                  onClick={() => setSelectedUser({ ...friend, avatar: avatarCache[friend.id] })}
                />
              ))
            )}
          </div>
        )}

        {/* Pending Requests */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {pendingFriendRequests.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No pending requests</h3>
                <p className="text-gray-500">Friend requests will appear here</p>
              </Card>
            ) : (
              pendingFriendRequests.map((requester) => (
                <FriendCard
                  key={requester.id}
                  user={requester}
                  avatar={avatarCache[requester.id]}
                  subtitle="Wants to be your friend"
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(requester.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeclineRequest(requester.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  }
                />
              ))
            )}
          </div>
        )}

        {/* Find Friends */}
        {activeTab === 'find' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by username or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((searchUser) => (
                    <motion.div
                      key={searchUser.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <FriendCard
                        user={searchUser}
                        avatar={searchUser.avatar}
                        actions={
                          <Button
                            size="sm"
                            onClick={() => handleSendRequest(searchUser.id)}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add Friend
                          </Button>
                        }
                        onClick={() => router.push(`/profile/${searchUser.username}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 && !isSearching ? (
                <Card className="p-8 text-center">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
                  <p className="text-gray-500">Try a different search term</p>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Find Musicians</h3>
                  <p className="text-gray-500">Search for musicians by username or display name</p>
                </Card>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Followers */}
        {activeTab === 'followers' && (
          <div className="space-y-3">
            {followers.length === 0 ? (
              <Card className="p-8 text-center">
                <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No followers yet</h3>
                <p className="text-gray-500">Jam more and share your profile to get followers!</p>
              </Card>
            ) : (
              followers.map((follower) => (
                <FriendCard
                  key={follower.id}
                  user={follower}
                  avatar={avatarCache[follower.id]}
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/profile/${follower.username}`)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  }
                  onClick={() => router.push(`/profile/${follower.username}`)}
                />
              ))
            )}
          </div>
        )}

        {/* Following */}
        {activeTab === 'following' && (
          <div className="space-y-3">
            {following.length === 0 ? (
              <Card className="p-8 text-center">
                <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Not following anyone</h3>
                <p className="text-gray-500">Follow musicians to see their activity</p>
              </Card>
            ) : (
              following.map((followedUser) => (
                <FriendCard
                  key={followedUser.id}
                  user={followedUser}
                  avatar={avatarCache[followedUser.id]}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnfollow(followedUser.id)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/profile/${followedUser.username}`)}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </>
                  }
                  onClick={() => router.push(`/profile/${followedUser.username}`)}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Friend Details"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <AvatarDisplay
                avatar={selectedUser.avatar || null}
                size="lg"
                username={selectedUser.username}
                showEffects
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedUser.displayName}
                </h3>
                <p className="text-gray-500">@{selectedUser.username}</p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">
                  {getLevelTitle(selectedUser.level)} - Level {selectedUser.level}
                </p>
              </div>
            </div>

            {selectedUser.bio && (
              <p className="text-gray-600 dark:text-gray-300">{selectedUser.bio}</p>
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                className="flex-1"
                onClick={() => router.push(`/profile/${selectedUser.username}`)}
              >
                View Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRemoveFriend(selectedUser.id)}
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Unfriend
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FriendCard({
  user,
  avatar,
  subtitle,
  actions,
  onClick,
}: {
  user: UserProfile;
  avatar?: Avatar | null;
  subtitle?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      onClick={onClick}
    >
      <AvatarDisplay avatar={avatar || null} size="md" username={user.username} />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {user.displayName}
        </h4>
        <p className="text-sm text-gray-500 truncate">
          {subtitle || `@${user.username} - Level ${user.level}`}
        </p>
      </div>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </Card>
  );
}
