'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Music,
  Zap,
  Users,
  Wifi,
  Sparkles,
  ArrowRight,
  Github,
  Headphones,
  Gauge,
  Globe,
  Check,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-900">OpenStudio</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Button>
            <Button size="sm" onClick={handleCreateRoom}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-white" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-40" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full text-indigo-600 text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Ultra-low latency jamming in your browser
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
              Jam with anyone,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                anywhere in the world
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              OpenStudio is a browser-based jamming studio with sub-30ms latency,
              AI-powered backing tracks, and real-time stem separation.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
              <Button
                size="lg"
                onClick={handleCreateRoom}
                loading={isCreating}
                className="w-full sm:w-auto"
              >
                Create Room
                <ArrowRight className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Enter room code"
                  className="flex-1 sm:w-44"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <Button
                  variant="outline"
                  onClick={handleJoinRoom}
                  disabled={!roomCode.trim()}
                >
                  Join
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 md:py-28 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for musicians, by musicians
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Every feature is designed to make remote jamming feel as natural as playing in the same room.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Gauge}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-100"
              title="Sub-30ms Latency"
              description="Ultra-low latency audio streaming powered by Cloudflare's global edge network and WebRTC."
            />
            <FeatureCard
              icon={Wifi}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-100"
              title="Adaptive Jitter Buffer"
              description="Intelligent buffer sizing that automatically adjusts to your network conditions for optimal performance."
            />
            <FeatureCard
              icon={Sparkles}
              iconColor="text-purple-600"
              iconBg="bg-purple-100"
              title="AI Stem Separation"
              description="Powered by Meta SAM, isolate vocals, drums, bass, and other instruments from any backing track."
            />
            <FeatureCard
              icon={Music}
              iconColor="text-pink-600"
              iconBg="bg-pink-100"
              title="AI Track Generation"
              description="Describe the backing track you want and let Suno AI create it. Endless mode keeps the music flowing."
            />
            <FeatureCard
              icon={Users}
              iconColor="text-amber-600"
              iconBg="bg-amber-100"
              title="SFU Architecture"
              description="Selective Forwarding Unit means you upload once, and everyone receives. No mesh network bottlenecks."
            />
            <FeatureCard
              icon={Globe}
              iconColor="text-cyan-600"
              iconBg="bg-cyan-100"
              title="Global Edge Network"
              description="Rooms are hosted at the nearest Cloudflare PoP to minimize latency for all participants."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Get started in seconds
            </h2>
            <p className="text-lg text-slate-600">
              No downloads, no plugins, no hassle
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <StepCard
              step={1}
              title="Create a Room"
              description="Click 'Create Room' to instantly generate a unique session. Share the code with your bandmates."
            />
            <StepCard
              step={2}
              title="Connect Your Gear"
              description="Plug in your audio interface and select your input. For best results, use wired ethernet."
            />
            <StepCard
              step={3}
              title="Start Jamming"
              description="Add backing tracks, use AI to generate new ones, and play together in real-time."
            />
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-20 md:py-28 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Headphones className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">
                    For the best experience
                  </h3>
                  <ul className="space-y-3">
                    <RequirementItem>
                      Use a <strong>wired ethernet connection</strong> (Wi-Fi jitter causes audio glitches)
                    </RequirementItem>
                    <RequirementItem>
                      Use a <strong>dedicated audio interface</strong> with ASIO/CoreAudio drivers
                    </RequirementItem>
                    <RequirementItem>
                      Use <strong>wired headphones</strong> to prevent feedback
                    </RequirementItem>
                    <RequirementItem>
                      Close other applications that might use your audio device
                    </RequirementItem>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Ready to jam?
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
            Create a room and start making music with friends around the world.
          </p>
          <Button size="lg" onClick={handleCreateRoom} loading={isCreating}>
            Create Room
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium">OpenStudio</span>
            </div>
            <p className="text-sm text-slate-500">
              Built with Next.js, Cloudflare Calls, and Supabase
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:shadow-slate-100 transition-shadow duration-300">
      <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-5`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 mx-auto bg-indigo-100 rounded-2xl flex items-center justify-center mb-5">
        <span className="text-xl font-bold text-indigo-600">{step}</span>
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function RequirementItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-slate-600">
      <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
