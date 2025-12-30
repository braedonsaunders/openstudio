'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, ArrowRight, Zap, Radio, Sun, Moon, FolderOpen, Plus, AlertCircle } from 'lucide-react';
import { CreateRoomModal } from '@/components/rooms';
import { getRoom } from '@/lib/rooms/service';
import { SceneRenderer, SceneSelector } from '@/components/homepage';
import type { HomepageSceneType } from '@/types/avatar';

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
// Floating music notes ambient
function FloatingMusicNotes({ isDark }: { isDark: boolean }) {
  const notes = ['♪', '♫', '♬', '♩'];
  const colors = isDark
    ? ['#a855f7', '#ec4899', '#8b5cf6', '#f472b6']
    : ['#7c3aed', '#db2777', '#6d28d9', '#ec4899'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-xl"
          style={{
            left: `${10 + (i % 5) * 18}%`,
            bottom: '18%',
            color: colors[i % colors.length],
          }}
          animate={{
            y: [0, -250, -350],
            x: [0, (i % 2 === 0 ? 25 : -25), (i % 2 === 0 ? -15 : 15)],
            opacity: [0, 1, 0],
            rotate: [0, (i % 2 === 0 ? 15 : -15), 0],
          }}
          transition={{
            duration: 5 + (i % 4),
            delay: i * 0.7,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        >
          {notes[i % notes.length]}
        </motion.div>
      ))}
    </div>
  );
}

// Feature pill
function FeaturePill({ icon: Icon, text, delay, isDark }: { icon: React.ElementType; text: string; delay: number; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs backdrop-blur-md ${
        isDark
          ? 'bg-white/10 border border-white/20 text-white'
          : 'bg-white/70 border border-white/50 text-slate-700 shadow-lg'
      }`}
    >
      <Icon className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      <span className="font-medium">{text}</span>
    </motion.div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading, isInitialized } = useAuthStore();

  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentScene, setCurrentScene] = useState<HomepageSceneType>('beach');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (user) {
      // Open the create room modal directly for logged-in users
      setShowCreateModal(true);
    } else {
      // For guests, create a quick room and redirect
      setIsCreating(true);
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}`);
    }
  }, [router, user]);

  const handleJoinRoom = useCallback(async () => {
    const code = roomCode.trim();
    if (!code) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      const room = await getRoom(code);
      if (room) {
        // Room exists, navigate to it
        router.push(`/room/${code}`);
      } else {
        // Room doesn't exist, show error
        setJoinError(`Room "${code}" doesn't exist`);
      }
    } catch (err) {
      setJoinError('Failed to check room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  }, [router, roomCode]);

  const handleBrowseRooms = useCallback(() => {
    router.push('/lobby');
  }, [router]);

  const handleCreateInstead = useCallback(() => {
    setJoinError(null);
    setRoomCode('');
    setShowCreateModal(true);
  }, []);

  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-sky-300 to-amber-100 dark:from-indigo-950 dark:to-purple-900" />
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Scene with walking characters */}
      <SceneRenderer
        scene={currentScene}
        showSceneSelector={false}
        className="absolute inset-0"
      />

      {/* Floating music notes */}
      <FloatingMusicNotes isDark={isDark} />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                <Music className="w-4 h-4 text-white" />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg opacity-50 blur-lg -z-10"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              OpenStudio
            </span>
          </motion.div>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <SceneSelector
              currentScene={currentScene}
              onSceneChange={setCurrentScene}
            />
            <ThemeToggle />
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Main content - SHORTER and WIDER card */}
      <main className="absolute inset-0 flex items-center justify-center z-10 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className={`text-center px-10 py-6 max-w-2xl w-full mx-4 rounded-2xl backdrop-blur-xl ${
            isDark
              ? 'bg-black/40 border border-white/10 shadow-2xl'
              : 'bg-white/60 border border-white/50 shadow-2xl'
          }`}
        >
          {/* Live indicator + headline in one row */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`text-xs tracking-wide uppercase font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Live
            </span>
          </div>

          {/* Main headline - more compact */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-2 tracking-tight leading-none"
          >
            <span className={`${isDark ? 'text-white' : 'text-slate-800'}`}>Play </span>
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Together
            </span>
          </motion.h1>

          {/* Subtitle - single line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Real-time jamming worldwide • Ultra-low latency • Lightweight native app
          </motion.p>

          {/* CTA Section - more compact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="space-y-3"
          >
            {/* Welcome message for logged in users */}
            {user && profile && (
              <p className={`text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                Welcome back, {profile.displayName}!
              </p>
            )}

            {/* Main buttons - horizontal layout */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <motion.button
                onClick={handleCreateRoom}
                disabled={isCreating}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-5 py-2.5 text-sm font-semibold rounded-xl overflow-hidden shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  animate={{ opacity: isHovering ? 1 : 0.9 }}
                />
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-40 -z-10"
                  animate={{ opacity: isHovering ? 0.7 : 0.3, scale: isHovering ? 1.1 : 1 }}
                />
                <span className="relative flex items-center justify-center gap-1.5 text-white">
                  {isCreating ? (
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <>
                      {user ? <Plus className="w-4 h-4" /> : null}
                      <span>{user ? 'Create Room' : 'Start Jamming'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>

              <motion.button
                onClick={handleBrowseRooms}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Browse</span>
              </motion.button>

              {/* Join input inline */}
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>or</span>
                <Input
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setJoinError(null);
                  }}
                  placeholder="CODE"
                  className={`w-20 text-center text-xs tracking-widest uppercase h-9 ${
                    isDark
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-slate-500'
                      : 'bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  } ${joinError ? 'border-red-500' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && !isJoining && handleJoinRoom()}
                  maxLength={8}
                  disabled={isJoining}
                />
                {roomCode.trim() && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleJoinRoom}
                    disabled={isJoining}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    } ${isJoining ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isJoining ? (
                      <motion.div
                        className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                  </motion.button>
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
                  className={`flex items-center justify-center gap-2 mt-3 p-3 rounded-xl ${
                    isDark
                      ? 'bg-red-500/20 border border-red-500/30'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <AlertCircle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                  <span className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                    {joinError}
                  </span>
                  <button
                    onClick={handleCreateInstead}
                    className={`ml-2 text-sm font-medium underline hover:no-underline ${
                      isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'
                    }`}
                  >
                    Create a room instead?
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Feature pills - smaller */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="flex flex-wrap items-center justify-center gap-2 mt-4"
          >
            <FeaturePill icon={Zap} text="Low latency" delay={1.2} isDark={isDark} />
            <FeaturePill icon={Radio} text="AI stems" delay={1.3} isDark={isDark} />
            <FeaturePill icon={Music} text="Backing tracks" delay={1.4} isDark={isDark} />
          </motion.div>
        </motion.div>
      </main>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="absolute bottom-3 left-0 right-0 text-center z-20"
      >
        <p className={`text-[10px] tracking-wide font-medium ${isDark ? 'text-white/40' : 'text-slate-500/60'}`}>
          POWERED BY CLOUDFLARE CALLS
        </p>
      </motion.div>

      {/* Create Room Modal */}
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
