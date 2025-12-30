'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  ArrowRight,
  Sun,
  Moon,
  Music,
  Users,
  Globe,
  Lock,
  Radio,
  Filter,
  RefreshCw,
  Send,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { useLobbyStore, type LobbyUser, type LobbyMessage } from '@/stores/lobby-store';
import { CreateRoomModal } from '@/components/rooms';
import { generateRoomId } from '@/lib/utils';
import { getPublicRooms, getRoom, ROOM_GENRES } from '@/lib/rooms/service';
import { ROOM_COLORS, ROOM_ICONS } from '@/types';
import type { RoomListItem } from '@/types';
import { INSTRUMENTS } from '@/types/user';

// Animated stars for night scene
function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
      })),
    []
  );

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {stars.map((star, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Animated clouds for day scene
function Clouds() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {[
        { x: '10%', y: '15%', scale: 0.7, duration: 120, delay: 0 },
        { x: '60%', y: '10%', scale: 0.5, duration: 100, delay: -40 },
        { x: '85%', y: '20%', scale: 0.6, duration: 140, delay: -20 },
      ].map((cloud, i) => (
        <motion.div
          key={i}
          className="absolute opacity-60"
          style={{ left: cloud.x, top: cloud.y, scale: cloud.scale }}
          animate={{ x: ['0%', '100vw'] }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg width="80" height="32" viewBox="0 0 120 50" fill="none">
            <ellipse cx="60" cy="35" rx="40" ry="15" fill="white" fillOpacity="0.7" />
            <ellipse cx="40" cy="28" rx="25" ry="18" fill="white" fillOpacity="0.8" />
            <ellipse cx="75" cy="30" rx="22" ry="15" fill="white" fillOpacity="0.7" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

// Theme toggle button
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      className={`relative p-2 rounded-lg transition-colors ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </motion.button>
  );
}

// Compact room card with description
function RoomCard({
  room,
  index,
  onClick,
  isDark,
}: {
  room: RoomListItem;
  index: number;
  onClick: () => void;
  isDark: boolean;
}) {
  const isLive = room.activeUsers && room.activeUsers > 0;
  const colorConfig = ROOM_COLORS.find((c) => c.value === room.color) || ROOM_COLORS[0];
  const iconConfig = ROOM_ICONS.find((i) => i.value === room.icon) || ROOM_ICONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className={`relative group cursor-pointer rounded-xl overflow-hidden ${
        isDark
          ? 'bg-gray-800/90 border border-white/10 hover:border-white/20'
          : 'bg-white/95 border border-gray-200 hover:border-gray-300'
      } backdrop-blur-sm shadow-sm hover:shadow-lg transition-all`}
    >
      {/* Header with color */}
      <div className={`h-2 bg-gradient-to-r ${colorConfig.gradient}`} />

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start gap-2.5 mb-2">
          <span className="text-xl flex-shrink-0">{iconConfig.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {room.name}
            </h3>
            {room.creatorName && (
              <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                by {room.creatorName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isLive && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                <motion.span
                  className="w-1.5 h-1.5 bg-green-400 rounded-full"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                Live
              </span>
            )}
            {room.isPublic ? (
              <Globe className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            ) : (
              <Lock className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            )}
          </div>
        </div>

        {/* Description */}
        <p className={`text-xs line-clamp-2 mb-3 min-h-[2.5rem] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {room.description || 'No description provided'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {room.genre && (
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                }`}
              >
                {room.genre}
              </span>
            )}
            <span
              className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              <Users className="w-3 h-3" />
              {room.activeUsers || 0}/{room.maxUsers}
            </span>
          </div>
          <ArrowRight className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} group-hover:translate-x-1 transition-transform`} />
        </div>
      </div>
    </motion.div>
  );
}

// Online user badge
function OnlineUserBadge({ user, isDark }: { user: LobbyUser; isDark: boolean }) {
  const instrument = user.instrument ? INSTRUMENTS[user.instrument] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 p-2 rounded-lg ${
        isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
      } transition-colors cursor-pointer`}
    >
      <div className="relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isDark ? 'bg-gradient-to-br from-indigo-500 to-purple-500' : 'bg-gradient-to-br from-indigo-400 to-purple-400'
          } text-white`}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {user.name}
          </span>
          {user.level && (
            <span className={`text-xs px-1 rounded ${isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
              Lv{user.level}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {instrument && (
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {instrument.icon} {instrument.name}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Chat message component
function ChatMessage({ message, isDark }: { message: LobbyMessage; isDark: boolean }) {
  if (message.type === 'join' || message.type === 'leave') {
    return (
      <div className={`text-xs text-center py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {message.content}
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-xs font-medium ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
          {message.userName}
          {message.userLevel && (
            <span className={`ml-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Lv{message.userLevel}
            </span>
          )}
        </span>
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{message.content}</p>
    </div>
  );
}

// Lobby chat panel
function LobbyChat({ isDark, className }: { isDark: boolean; className?: string }) {
  const { messages, sendMessage, isConnected } = useLobbyStore();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !isConnected) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div
      className={`rounded-xl overflow-hidden flex flex-col ${
        isDark ? 'bg-gray-800/80 border border-white/10' : 'bg-white border border-gray-200'
      } ${className || ''}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 flex-shrink-0 ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Lobby Chat
          </span>
          {messages.length > 0 && (
            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
              isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
            }`}>
              {messages.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            {/* Messages */}
            <div className={`flex-1 min-h-0 overflow-y-auto px-3 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
              {messages.length === 0 ? (
                <div className={`flex items-center justify-center h-full text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} isDark={isDark} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 flex gap-2 flex-shrink-0">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isConnected ? 'Type a message...' : 'Sign in to chat'}
                disabled={!isConnected}
                className={`flex-1 text-sm ${isDark ? 'bg-gray-900 border-gray-700' : ''}`}
              />
              <Button
                onClick={handleSend}
                disabled={!isConnected || !input.trim()}
                size="sm"
                className="px-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Online users panel
function OnlineUsersPanel({ isDark }: { isDark: boolean }) {
  const { users, totalOnline } = useLobbyStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const userList = Array.from(users.values());

  return (
    <div
      className={`rounded-xl overflow-hidden ${
        isDark ? 'bg-gray-800/80 border border-white/10' : 'bg-white border border-gray-200'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          <Users className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Online Now
          </span>
          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
            isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
          }`}>
            {totalOnline}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className={`max-h-64 overflow-y-auto p-2 space-y-1 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
              {userList.length === 0 ? (
                <div className={`text-center py-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No one else is here yet
                </div>
              ) : (
                userList.map((user) => (
                  <OnlineUserBadge key={user.id} user={user} isDark={isDark} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading: authLoading, isInitialized, instruments } = useAuthStore();
  const { connect, disconnect, isConnected, subscribeToRoom, getRoomUserCount, roomPresence } = useLobbyStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Connect to lobby presence when user is loaded
  useEffect(() => {
    if (user && profile && !isConnected) {
      const primaryInstrument = instruments.find((i) => i.isPrimary);
      const lobbyUser: LobbyUser = {
        id: user.id,
        name: profile.displayName || profile.username,
        username: profile.username,
        level: profile.level,
        instrument: primaryInstrument?.instrumentId,
        musicTags: profile.musicTags,
        joinedAt: new Date().toISOString(),
        isOnline: true,
      };
      connect(lobbyUser);
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [user, profile, isConnected, instruments]);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const publicRooms = await getPublicRooms();
      setRooms(publicRooms);

      // Subscribe to presence for each room
      publicRooms.forEach((room) => {
        subscribeToRoom(room.id);
      });
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subscribeToRoom]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Update rooms with live user counts
  const roomsWithPresence = useMemo(() => {
    return rooms.map((room) => ({
      ...room,
      activeUsers: getRoomUserCount(room.id) || room.activeUsers || 0,
    }));
  }, [rooms, getRoomUserCount, roomPresence]);

  const filteredRooms = useMemo(() => {
    let result = [...roomsWithPresence];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query) ||
          room.genre?.toLowerCase().includes(query) ||
          room.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedGenre) {
      result = result.filter((room) => room.genre === selectedGenre);
    }

    // Sort by live first, then by recent
    result.sort((a, b) => {
      const aLive = (a.activeUsers || 0) > 0 ? 1 : 0;
      const bLive = (b.activeUsers || 0) > 0 ? 1 : 0;
      if (bLive !== aLive) return bLive - aLive;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [roomsWithPresence, searchQuery, selectedGenre]);

  const handleQuickJoin = async () => {
    const code = roomCode.trim();
    if (!code) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const room = await getRoom(code);
      if (room) {
        router.push(`/room/${code}`);
      } else {
        setJoinError(`Room "${code}" doesn't exist`);
      }
    } catch (err) {
      setJoinError('Failed to check room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateInstead = () => {
    setJoinError(null);
    setRoomCode('');
    setShowCreateModal(true);
  };

  const handleCreateRoom = () => {
    if (user) {
      setShowCreateModal(true);
    } else {
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}`);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  if (!mounted) {
    return <div className={`min-h-screen ${isDark ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900' : 'bg-gradient-to-b from-sky-100 via-blue-50 to-white'}`} />;
  }

  if (authLoading && !isInitialized) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white' : 'bg-gradient-to-b from-sky-100 via-blue-50 to-white text-gray-900'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const liveCount = filteredRooms.filter((r) => r.activeUsers && r.activeUsers > 0).length;
  const totalMusicians = filteredRooms.reduce((sum, r) => sum + (r.activeUsers || 0), 0);

  return (
    <div className={`h-screen flex flex-col overflow-hidden relative ${isDark ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900' : 'bg-gradient-to-b from-sky-100 via-blue-50 to-white'}`}>
      {/* Animated background */}
      {isDark ? <Stars /> : <Clouds />}

      {/* Header */}
      <header className={`flex-shrink-0 z-50 backdrop-blur-xl ${isDark ? 'bg-slate-900/80 border-b border-white/10' : 'bg-white/80 border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              OpenStudio
            </span>
          </a>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 min-h-0 overflow-hidden max-w-7xl w-full mx-auto px-4 py-4 flex flex-col">
        {/* Compact Hero */}
        <div className={`flex-shrink-0 rounded-xl p-4 mb-4 ${isDark ? 'bg-gradient-to-r from-indigo-900/50 via-purple-900/50 to-pink-900/50 border border-white/10' : 'bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-gray-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              {user && profile && (
                <p className={`text-xs mb-1 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  Welcome back, {profile.displayName}!
                </p>
              )}
              <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  The Lobby
                </span>
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Find musicians, join rooms, and start jamming
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleCreateRoom}
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-0"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Room
              </Button>

              <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                <Input
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setJoinError(null);
                  }}
                  placeholder="CODE"
                  className={`w-20 text-center text-xs tracking-widest uppercase border-0 bg-transparent h-8 ${
                    isDark ? 'text-white placeholder:text-gray-500' : 'text-gray-900'
                  } ${joinError ? 'text-red-500' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && !isJoining && handleQuickJoin()}
                  maxLength={8}
                  disabled={isJoining}
                />
                {roomCode.trim() && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleQuickJoin}
                    disabled={isJoining}
                    className={`h-8 px-2 ${isJoining ? 'opacity-50' : ''}`}
                  >
                    {isJoining ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Join error message */}
            <AnimatePresence>
              {joinError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex items-center gap-2 mt-2 p-2 rounded-lg ${
                    isDark
                      ? 'bg-red-500/20 border border-red-500/30'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <AlertCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                  <span className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    {joinError}
                  </span>
                  <button
                    onClick={handleCreateInstead}
                    className={`ml-auto text-sm font-medium underline hover:no-underline whitespace-nowrap ${
                      isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'
                    }`}
                  >
                    Create instead?
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
            <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <Globe className="w-3.5 h-3.5" />
              <strong>{filteredRooms.length}</strong> rooms
            </span>
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-green-500">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <strong>{liveCount}</strong> live
              </span>
            )}
            <span className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users className="w-3.5 h-3.5" />
              <strong>{totalMusicians}</strong> musicians
            </span>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Left Sidebar - Online Users & Chat */}
          <div className="lg:w-72 flex flex-col gap-4 min-h-0">
            <OnlineUsersPanel isDark={isDark} />
            <LobbyChat isDark={isDark} className="flex-1 min-h-0" />
          </div>

          {/* Main Content - Rooms */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            {/* Search and Filters */}
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search rooms..."
                    className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark
                        ? 'bg-gray-800 border border-white/10 text-white placeholder:text-gray-500'
                        : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    showFilters
                      ? 'bg-purple-500 text-white'
                      : isDark
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                </button>

                <button
                  onClick={fetchRooms}
                  disabled={isLoading}
                  className={`p-2 rounded-lg transition-all ${
                    isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Genre filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-800/50 border border-white/10' : 'bg-white border border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Genre</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setSelectedGenre('')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            !selectedGenre
                              ? 'bg-purple-500 text-white'
                              : isDark
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          All
                        </button>
                        {ROOM_GENRES.map((genre) => (
                          <button
                            key={genre.value}
                            onClick={() => setSelectedGenre(genre.value)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              selectedGenre === genre.value
                                ? 'bg-purple-500 text-white'
                                : isDark
                                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {genre.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Room Grid */}
            {isLoading && rooms.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={`h-32 rounded-xl animate-pulse ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div
                  className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isDark ? 'bg-gray-800' : 'bg-gray-100'
                  }`}
                >
                  <Music className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>No rooms found</h3>
                <p className={`text-sm max-w-sm mx-auto mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {searchQuery || selectedGenre
                    ? 'Try adjusting your search or filters.'
                    : 'Be the first to create a room!'}
                </p>
                <Button onClick={handleCreateRoom}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Room
                </Button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredRooms.map((room, index) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    index={index}
                    onClick={() => handleJoinRoom(room.id)}
                    isDark={isDark}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
