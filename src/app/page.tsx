'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { motion, useSpring } from 'framer-motion';
import { Music, ArrowRight, Zap, Radio, Sun, Moon, FolderOpen, Plus } from 'lucide-react';

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

// Circular audio visualizer ring
function AudioRing({ isDark }: { isDark: boolean }) {
  const bars = 64;
  const [heights, setHeights] = useState<number[]>(Array(bars).fill(20));

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(prev => prev.map((_, i) => {
        const base = 15 + Math.sin(Date.now() / 500 + i * 0.3) * 10;
        const mouseInfluence = Math.sin(Date.now() / 300 + i * 0.2) * 15;
        return base + mouseInfluence + Math.random() * 20;
      }));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const gradientColors = isDark
    ? 'rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.6)'
    : 'rgba(79, 70, 229, 0.6), rgba(147, 51, 234, 0.6), rgba(219, 39, 119, 0.5)';

  const glowColor = isDark
    ? 'rgba(139, 92, 246, 0.5)'
    : 'rgba(139, 92, 246, 0.3)';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-[500px] h-[500px] md:w-[600px] md:h-[600px]">
        {heights.map((height, i) => {
          const angle = (i / bars) * 360;
          const radian = (angle * Math.PI) / 180;
          const radius = 220;
          const x = Math.cos(radian) * radius;
          const y = Math.sin(radian) * radius;

          return (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 origin-bottom"
              style={{
                width: 3,
                height: height,
                x: x - 1.5,
                y: y,
                rotate: angle + 90,
                background: `linear-gradient(to top, ${gradientColors})`,
                boxShadow: `0 0 ${height / 3}px ${glowColor}`,
                borderRadius: 2,
              }}
              animate={{ height }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Pulsing concentric rings
function PulseRings({ isDark }: { isDark: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3, 4].map((ring) => (
        <motion.div
          key={ring}
          className={`absolute rounded-full border ${isDark ? 'border-white/5' : 'border-slate-900/5'}`}
          style={{
            width: 300 + ring * 150,
            height: 300 + ring * 150,
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 4,
            delay: ring * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Floating frequency particles - fixed positions for SSR
function FrequencyParticles({ isDark }: { isDark: boolean }) {
  const particles = useMemo(() => [
    { id: 0, x: 5, y: 15, size: 3, duration: 4, delay: 0 },
    { id: 1, x: 12, y: 45, size: 5, duration: 5, delay: 0.5 },
    { id: 2, x: 20, y: 75, size: 4, duration: 3.5, delay: 1 },
    { id: 3, x: 28, y: 25, size: 3, duration: 6, delay: 0.3 },
    { id: 4, x: 35, y: 60, size: 5, duration: 4.5, delay: 1.2 },
    { id: 5, x: 42, y: 10, size: 4, duration: 5.5, delay: 0.8 },
    { id: 6, x: 50, y: 85, size: 3, duration: 4, delay: 0.2 },
    { id: 7, x: 58, y: 35, size: 6, duration: 5, delay: 1.5 },
    { id: 8, x: 65, y: 55, size: 4, duration: 3, delay: 0.7 },
    { id: 9, x: 72, y: 20, size: 5, duration: 6.5, delay: 0.4 },
    { id: 10, x: 80, y: 70, size: 3, duration: 4.5, delay: 1.1 },
    { id: 11, x: 88, y: 40, size: 4, duration: 5, delay: 0.6 },
    { id: 12, x: 95, y: 80, size: 5, duration: 3.5, delay: 1.8 },
    { id: 13, x: 8, y: 65, size: 3, duration: 4, delay: 0.9 },
    { id: 14, x: 18, y: 30, size: 4, duration: 5.5, delay: 0.1 },
    { id: 15, x: 32, y: 90, size: 5, duration: 4, delay: 1.4 },
    { id: 16, x: 45, y: 50, size: 3, duration: 6, delay: 0.5 },
    { id: 17, x: 55, y: 8, size: 4, duration: 5, delay: 1.7 },
    { id: 18, x: 68, y: 78, size: 5, duration: 3.5, delay: 0.3 },
    { id: 19, x: 78, y: 42, size: 4, duration: 4.5, delay: 1 },
    { id: 20, x: 92, y: 18, size: 3, duration: 5, delay: 0.8 },
  ], []);

  const particleColor = isDark
    ? 'rgba(139, 92, 246, 0.8)'
    : 'rgba(124, 58, 237, 0.6)';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, ${particleColor}, transparent)`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Interactive cursor glow
function CursorGlow({ mouseX, mouseY, isDark }: { mouseX: number; mouseY: number; isDark: boolean }) {
  const springConfig = { damping: 25, stiffness: 200 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const glowColor = isDark
    ? 'rgba(99, 102, 241, 0.15)'
    : 'rgba(99, 102, 241, 0.1)';

  return (
    <motion.div
      className="fixed pointer-events-none z-0"
      style={{
        x,
        y,
        width: 400,
        height: 400,
        marginLeft: -200,
        marginTop: -200,
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }}
    />
  );
}

// Waveform line at bottom
function WaveformLine() {
  const points = 100;
  const [path, setPath] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      let d = 'M 0 50';
      for (let i = 0; i <= points; i++) {
        const xPos = (i / points) * 100;
        const yPos = 50 + Math.sin(Date.now() / 500 + i * 0.2) * 20 + Math.sin(Date.now() / 300 + i * 0.5) * 10;
        d += ` L ${xPos} ${yPos}`;
      }
      setPath(d);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none opacity-30">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="url(#waveGradient)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}

// Feature pill
function FeaturePill({ icon: Icon, text, delay, isDark }: { icon: React.ElementType; text: string; delay: number; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm ${
        isDark
          ? 'bg-white/5 border border-white/10 text-slate-300'
          : 'bg-slate-900/5 border border-slate-900/10 text-slate-600'
      }`}
    >
      <Icon className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
      <span>{text}</span>
    </motion.div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading, isInitialized, initialize } = useAuthStore();

  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    // If logged in, go to rooms page to use the create modal
    if (user) {
      router.push('/rooms');
    } else {
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}`);
    }
  }, [router, user]);

  const handleJoinRoom = useCallback(() => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  }, [router, roomCode]);

  const handleBrowseRooms = useCallback(() => {
    router.push('/rooms');
  }, [router]);

  return (
    <div className={`fixed inset-0 overflow-hidden transition-colors duration-500 ${
      isDark ? 'bg-[#050508] text-white' : 'bg-[#fafafa] text-slate-900'
    }`}>
      {/* Ambient background */}
      <div className="absolute inset-0">
        {/* Deep gradient */}
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDark
            ? 'bg-gradient-to-b from-indigo-950/20 via-transparent to-purple-950/20'
            : 'bg-gradient-to-b from-indigo-100/50 via-transparent to-purple-100/50'
        }`} />

        {/* Noise texture */}
        <div className={`absolute inset-0 ${isDark ? 'opacity-[0.015]' : 'opacity-[0.03]'}`} style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Interactive elements */}
      <CursorGlow mouseX={mousePos.x} mouseY={mousePos.y} isDark={isDark} />
      <FrequencyParticles isDark={isDark} />
      <PulseRings isDark={isDark} />
      <AudioRing isDark={isDark} />
      <WaveformLine />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl opacity-50 blur-lg -z-10"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="text-xl font-bold tracking-tight">OpenStudio</span>
          </motion.div>

          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ThemeToggle />
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Main content - centered */}
      <main className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center px-6 max-w-2xl mx-auto">
          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`text-sm tracking-wide uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Live Sessions Active
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-none"
          >
            <span className="block">Play</span>
            <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Together
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className={`text-lg md:text-xl mb-10 max-w-lg mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            Real-time jamming with musicians worldwide.
            <br />
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Sub-30ms latency. Zero downloads.</span>
          </motion.p>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="space-y-4"
          >
            {/* Welcome message for logged in users */}
            {user && profile && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-sm mb-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
              >
                Welcome back, {profile.displayName}!
              </motion.p>
            )}

            {/* Main buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Create/Start button */}
              <motion.button
                onClick={handleCreateRoom}
                disabled={isCreating}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-8 py-4 text-lg font-semibold rounded-2xl overflow-hidden"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Button glow */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  animate={{
                    opacity: isHovering ? 1 : 0.9,
                  }}
                />
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 -z-10"
                  animate={{
                    opacity: isHovering ? 0.8 : 0.4,
                    scale: isHovering ? 1.1 : 1,
                  }}
                />

                <span className="relative flex items-center justify-center gap-2 text-white">
                  {isCreating ? (
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      {user ? <Plus className="w-5 h-5" /> : null}
                      <span>{user ? 'Create Room' : 'Start Jamming'}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>

              {/* Browse Rooms button - only for logged in users */}
              {user && (
                <motion.button
                  onClick={handleBrowseRooms}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`group flex items-center gap-2 px-6 py-4 text-lg font-semibold rounded-2xl transition-all ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Browse Rooms</span>
                </motion.button>
              )}
            </div>

            {/* Join room input */}
            <div className="flex items-center justify-center gap-2">
              <span className={`text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>or join</span>
              <div className="relative">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className={`w-32 text-center text-sm tracking-widest uppercase ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-slate-900/5 border-slate-900/10 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20'
                  }`}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  maxLength={8}
                />
              </div>
              {roomCode.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleJoinRoom}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20'
                      : 'bg-slate-900/10 hover:bg-slate-900/20'
                  }`}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-12"
          >
            <FeaturePill icon={Zap} text="Sub-30ms latency" delay={1.1} isDark={isDark} />
            <FeaturePill icon={Radio} text="AI stem separation" delay={1.2} isDark={isDark} />
            <FeaturePill icon={Music} text="AI backing tracks" delay={1.3} isDark={isDark} />
          </motion.div>
        </div>
      </main>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="absolute bottom-6 left-0 right-0 text-center"
      >
        <p className={`text-xs tracking-wide ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
          POWERED BY CLOUDFLARE CALLS
        </p>
      </motion.div>

      {/* Corner decorations */}
      <div className={`absolute top-20 left-6 w-px h-20 bg-gradient-to-b from-transparent to-transparent ${isDark ? 'via-white/10' : 'via-slate-900/10'}`} />
      <div className={`absolute top-20 right-6 w-px h-20 bg-gradient-to-b from-transparent to-transparent ${isDark ? 'via-white/10' : 'via-slate-900/10'}`} />
      <div className={`absolute bottom-20 left-6 w-px h-20 bg-gradient-to-b from-transparent to-transparent ${isDark ? 'via-white/10' : 'via-slate-900/10'}`} />
      <div className={`absolute bottom-20 right-6 w-px h-20 bg-gradient-to-b from-transparent to-transparent ${isDark ? 'via-white/10' : 'via-slate-900/10'}`} />
    </div>
  );
}
