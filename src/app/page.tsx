'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import {
  Music,
  Users,
  Wifi,
  Sparkles,
  ArrowRight,
  Headphones,
  Gauge,
  Globe,
  Radio,
  Waves,
  Music2,
} from 'lucide-react';

// Floating music note component
function FloatingNote({ delay, duration, x, size }: { delay: number; duration: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute text-white/10 pointer-events-none"
      initial={{ y: '100vh', x, opacity: 0, rotate: -20 }}
      animate={{
        y: '-100vh',
        opacity: [0, 0.3, 0.3, 0],
        rotate: 20,
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <Music2 style={{ width: size, height: size }} />
    </motion.div>
  );
}

// Audio visualizer bar
function VisualizerBar({ index, isActive }: { index: number; isActive: boolean }) {
  const randomHeight = useCallback(() => Math.random() * 100 + 20, []);
  const [height, setHeight] = useState(randomHeight());

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setHeight(randomHeight());
    }, 100 + index * 20);
    return () => clearInterval(interval);
  }, [isActive, index, randomHeight]);

  return (
    <motion.div
      className="w-1 md:w-1.5 rounded-full bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500"
      animate={{ height: isActive ? height : 4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    />
  );
}

// Audio visualizer component
function AudioVisualizer({ isActive }: { isActive: boolean }) {
  const bars = Array.from({ length: 32 }, (_, i) => i);

  return (
    <div className="flex items-end justify-center gap-0.5 md:gap-1 h-24 md:h-32">
      {bars.map((i) => (
        <VisualizerBar key={i} index={i} isActive={isActive} />
      ))}
    </div>
  );
}

// Feature card with animation
function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-6 h-6 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// Step card with animation
function StepCard({
  step,
  title,
  description,
  index,
}: {
  step: number;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className="text-center"
    >
      <motion.div
        className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <span className="text-2xl font-bold text-white">{step}</span>
      </motion.div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [visualizerActive, setVisualizerActive] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: containerRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Parallax transforms
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);
  const featuresY = useTransform(smoothProgress, [0.1, 0.4], [100, 0]);

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}`);
  }, [router]);

  const handleJoinRoom = useCallback(() => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  }, [router, roomCode]);

  // Fixed floating notes positions (avoid hydration mismatch)
  const floatingNotes = [
    { id: 0, delay: 0, duration: 18, x: 100, size: 24 },
    { id: 1, delay: 2, duration: 22, x: 250, size: 32 },
    { id: 2, delay: 4, duration: 16, x: 400, size: 28 },
    { id: 3, delay: 6, duration: 20, x: 550, size: 36 },
    { id: 4, delay: 8, duration: 24, x: 700, size: 22 },
    { id: 5, delay: 10, duration: 17, x: 850, size: 30 },
    { id: 6, delay: 12, duration: 21, x: 1000, size: 26 },
    { id: 7, delay: 14, duration: 19, x: 1150, size: 34 },
    { id: 8, delay: 1, duration: 23, x: 175, size: 28 },
    { id: 9, delay: 3, duration: 15, x: 475, size: 38 },
    { id: 10, delay: 5, duration: 25, x: 775, size: 20 },
    { id: 11, delay: 7, duration: 18, x: 1075, size: 32 },
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px]"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]"
          animate={{
            x: [0, -40, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[80px]"
          animate={{
            x: [0, 60, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating notes */}
        {floatingNotes.map((note) => (
          <FloatingNote key={note.id} {...note} />
        ))}

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              OpenStudio
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section
        className="relative min-h-[85vh] flex items-center justify-center px-6"
        style={{ y: heroY, opacity: heroOpacity }}
      >
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-medium mb-8 backdrop-blur-sm"
          >
            <Radio className="w-4 h-4 text-green-400 animate-pulse" />
            <span className="text-slate-300">Live jamming in your browser</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight"
          >
            <span className="text-white">Create music </span>
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              together
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed"
          >
            Real-time jamming studio with sub-30ms latency, AI-powered backing tracks,
            and stem separation. No plugins, no downloads.
          </motion.p>

          {/* Audio Visualizer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-10"
          >
            <AudioVisualizer isActive={visualizerActive} />
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto"
          >
            <Button
              size="lg"
              onClick={handleCreateRoom}
              loading={isCreating}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Start Jamming
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Room code"
                className="flex-1 sm:w-36 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <Button
                variant="outline"
                onClick={handleJoinRoom}
                disabled={!roomCode.trim()}
                className="border-white/10 hover:bg-white/10 hover:border-white/20"
              >
                Join
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Waves className="w-6 h-6 text-slate-600" />
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <motion.section className="relative py-24 px-6" style={{ y: featuresY }}>
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Built for musicians
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-slate-400 max-w-xl mx-auto"
            >
              Every feature designed to make remote jamming feel like playing in the same room.
            </motion.p>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Gauge}
              title="Sub-30ms Latency"
              description="Ultra-low latency audio streaming powered by Cloudflare's global edge network."
              index={0}
            />
            <FeatureCard
              icon={Wifi}
              title="Adaptive Buffer"
              description="Intelligent jitter buffer that adjusts to your network conditions automatically."
              index={1}
            />
            <FeatureCard
              icon={Sparkles}
              title="AI Stem Separation"
              description="Isolate vocals, drums, bass, and more from any track with Meta SAM."
              index={2}
            />
            <FeatureCard
              icon={Music}
              title="AI Track Generation"
              description="Describe any backing track and let Suno AI create it instantly."
              index={3}
            />
            <FeatureCard
              icon={Users}
              title="SFU Architecture"
              description="Upload once, everyone receives. No mesh network bottlenecks."
              index={4}
            />
            <FeatureCard
              icon={Globe}
              title="Global Network"
              description="Rooms hosted at the nearest edge PoP to minimize latency worldwide."
              index={5}
            />
          </div>
        </div>
      </motion.section>

      {/* How it works */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Get started in seconds
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-slate-400"
            >
              No downloads, no plugins, no hassle
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <StepCard
              step={1}
              title="Create a Room"
              description="Generate a unique session and share the code with your bandmates."
              index={0}
            />
            <StepCard
              step={2}
              title="Connect Gear"
              description="Plug in your audio interface. Use wired ethernet for best results."
              index={1}
            />
            <StepCard
              step={3}
              title="Start Jamming"
              description="Add backing tracks, use AI generation, and play together live."
              index={2}
            />
          </div>
        </div>
      </section>

      {/* Pro tips */}
      <section className="relative py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                <Headphones className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Pro tips</h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                    Use wired ethernet — Wi-Fi jitter causes audio glitches
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                    Use a dedicated audio interface with low-latency drivers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-400" />
                    Wired headphones prevent feedback loops
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 px-6">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to jam?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Create a room and start making music with friends around the world.
            </p>
            <Button
              size="lg"
              onClick={handleCreateRoom}
              loading={isCreating}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300"
            >
              <Music className="w-4 h-4 mr-2" />
              Create Room
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-300">OpenStudio</span>
          </div>
          <p className="text-sm text-slate-600">
            Built with Next.js, Cloudflare Calls & Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
