'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-8 h-8 text-indigo-500" />
            <span className="text-xl font-bold text-white">OpenStudio</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              <Github className="w-4 h-4 mr-2" />
              GitHub
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateRoom}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full text-indigo-400 text-sm mb-6">
              <Zap className="w-4 h-4" />
              Ultra-low latency jamming in your browser
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Jam with anyone,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
                anywhere in the world
              </span>
            </h1>

            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              OpenStudio is a browser-based jamming studio with sub-30ms latency,
              AI-powered backing tracks, and real-time stem separation.
              No downloads required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={handleCreateRoom}
                loading={isCreating}
                className="w-full sm:w-auto min-w-[160px]"
              >
                Create Room
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Enter room code"
                  className="w-full sm:w-56"
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

      {/* Features */}
      <section className="py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Built for musicians, by musicians
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Every feature is designed to make remote jamming feel as natural as playing in the same room.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card variant="bordered">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
                <Gauge className="w-6 h-6 text-indigo-500" />
              </div>
              <CardHeader>
                <CardTitle>Sub-30ms Latency</CardTitle>
                <CardDescription>
                  Ultra-low latency audio streaming powered by Cloudflare&apos;s global edge network and WebRTC.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="bordered">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <Wifi className="w-6 h-6 text-green-500" />
              </div>
              <CardHeader>
                <CardTitle>Adaptive Jitter Buffer</CardTitle>
                <CardDescription>
                  Intelligent buffer sizing that automatically adjusts to your network conditions for optimal performance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="bordered">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              <CardHeader>
                <CardTitle>AI Stem Separation</CardTitle>
                <CardDescription>
                  Powered by Meta SAM, isolate vocals, drums, bass, and other instruments from any backing track.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="bordered">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4">
                <Music className="w-6 h-6 text-pink-500" />
              </div>
              <CardHeader>
                <CardTitle>AI Track Generation</CardTitle>
                <CardDescription>
                  Describe the backing track you want and let Suno AI create it. Endless mode keeps the music flowing.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="bordered">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-yellow-500" />
              </div>
              <CardHeader>
                <CardTitle>SFU Architecture</CardTitle>
                <CardDescription>
                  Selective Forwarding Unit means you upload once, and everyone receives. No mesh network bottlenecks.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="bordered">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-cyan-500" />
              </div>
              <CardHeader>
                <CardTitle>Global Edge Network</CardTitle>
                <CardDescription>
                  Rooms are hosted at the nearest Cloudflare PoP to minimize latency for all participants.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              How it works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Get jamming in less than 30 seconds
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-indigo-500">1</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Create a Room</h3>
              <p className="text-gray-400">
                Click &quot;Create Room&quot; to instantly generate a unique session. Share the code with your bandmates.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-indigo-500">2</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Your Gear</h3>
              <p className="text-gray-400">
                Plug in your audio interface and select your input. For best results, use wired ethernet.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-indigo-500">3</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Start Jamming</h3>
              <p className="text-gray-400">
                Add backing tracks, use AI to generate new ones, and play together in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <Card variant="bordered" className="max-w-3xl mx-auto">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Headphones className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    For the best experience
                  </h3>
                  <ul className="space-y-2 text-gray-400">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                      Use a <strong className="text-white">wired ethernet connection</strong> (Wi-Fi jitter causes audio glitches)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                      Use a <strong className="text-white">dedicated audio interface</strong> with ASIO/CoreAudio drivers
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                      Use <strong className="text-white">wired headphones</strong> to prevent feedback
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                      Close other applications that might use your audio device
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to jam?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Create a room and start making music with friends around the world.
          </p>
          <Button size="lg" onClick={handleCreateRoom} loading={isCreating}>
            Create Room
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Music className="w-5 h-5" />
              <span>OpenStudio</span>
            </div>
            <p className="text-sm text-gray-500">
              Built with Next.js, Cloudflare Calls, and Supabase
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
