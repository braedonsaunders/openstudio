'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  FolderOpen,
  Radio,
  Music,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { RoomBrowser, MyRooms, CreateRoomModal } from '@/components/rooms';
import { generateRoomId } from '@/lib/utils';

type Tab = 'browse' | 'my-rooms';

// Theme toggle button
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      className={`relative p-2.5 rounded-xl transition-colors ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 0 : 180, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </motion.div>
    </motion.button>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading, isInitialized, initialize } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  const handleQuickJoin = () => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  };

  const handleQuickCreate = () => {
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}`);
  };

  // Show loading state while initializing
  if (isLoading || !isInitialized) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${
        isDark ? 'bg-[#050508] text-white' : 'bg-[#fafafa] text-slate-900'
      }`}>
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${
      isDark ? 'bg-[#050508] text-white' : 'bg-[#fafafa] text-slate-900'
    }`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl ${
        isDark ? 'bg-[#050508]/80' : 'bg-[#fafafa]/80'
      } border-b ${isDark ? 'border-gray-800' : 'border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="/"
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">OpenStudio</span>
          </motion.a>

          {/* Quick actions */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                className={`w-32 text-center text-sm tracking-widest uppercase ${
                  isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-slate-900/5 border-slate-900/10'
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickJoin()}
                maxLength={8}
              />
              {roomCode.trim() && (
                <button
                  onClick={handleQuickJoin}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-400"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome section */}
        {user && profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {profile.displayName}!
            </h1>
            <p className={`${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Ready to jam? Create a room or join an existing session.
            </p>
          </motion.div>
        )}

        {/* Quick action cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        >
          {/* Create Room Card */}
          <motion.button
            onClick={() => user ? setShowCreateModal(true) : handleQuickCreate()}
            className={`relative group p-6 rounded-2xl border text-left transition-all overflow-hidden ${
              isDark
                ? 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 hover:border-indigo-500/40'
                : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 hover:border-indigo-300'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-16 translate-x-16" />
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Create Room</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                {user ? 'Set up your own jam session' : 'Start jamming instantly'}
              </p>
            </div>
          </motion.button>

          {/* Quick Join Card */}
          <motion.div
            className={`p-6 rounded-2xl border ${
              isDark
                ? 'bg-gray-900/50 border-gray-800'
                : 'bg-white border-slate-200'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-3">Quick Join</h3>
            <div className="flex gap-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className={`flex-1 uppercase tracking-wider ${
                  isDark ? 'bg-gray-800 border-gray-700' : ''
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickJoin()}
                maxLength={8}
              />
              <Button
                onClick={handleQuickJoin}
                disabled={!roomCode.trim()}
                className="shrink-0"
              >
                Join
              </Button>
            </div>
          </motion.div>

          {/* Live Sessions Card */}
          <motion.button
            onClick={() => setActiveTab('browse')}
            className={`p-6 rounded-2xl border text-left transition-all ${
              isDark
                ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Browse Sessions</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Find live jams to join
            </p>
          </motion.button>
        </motion.div>

        {/* Tabs - only show if logged in */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex gap-2 mb-6"
          >
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'browse'
                  ? 'bg-indigo-500 text-white'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              Browse Rooms
            </button>
            <button
              onClick={() => setActiveTab('my-rooms')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'my-rooms'
                  ? 'bg-indigo-500 text-white'
                  : isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              My Rooms
            </button>
          </motion.div>
        )}

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {activeTab === 'browse' ? (
            <RoomBrowser />
          ) : (
            <MyRooms onCreateRoom={() => setShowCreateModal(true)} />
          )}
        </motion.div>
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
