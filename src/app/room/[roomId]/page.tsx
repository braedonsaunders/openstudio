'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DAWLayout } from '@/components/daw';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useRoom } from '@/hooks/useRoom';
import { useAuthStore } from '@/stores/auth-store';
import {
  Music,
  User,
  Guitar,
  ArrowRight,
  Loader2,
  AlertCircle,
  Mic,
  Volume2,
} from 'lucide-react';

const instruments = [
  { id: 'guitar', label: 'Guitar', icon: '🎸' },
  { id: 'bass', label: 'Bass', icon: '🎸' },
  { id: 'drums', label: 'Drums', icon: '🥁' },
  { id: 'keyboard', label: 'Keyboard', icon: '🎹' },
  { id: 'vocals', label: 'Vocals', icon: '🎤' },
  { id: 'other', label: 'Other', icon: '🎵' },
];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const { user, profile, isInitialized, initialize } = useAuthStore();

  const [hasJoined, setHasJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [audioPermission, setAudioPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [audioLevel, setAudioLevel] = useState(0);

  // Initialize auth
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Pre-populate name from profile when auth is ready
  useEffect(() => {
    if (profile && !userName) {
      setUserName(profile.displayName);
    }
  }, [profile, userName]);

  const { join, isJoining, error, isConnected } = useRoom(roomId, {
    onUserJoined: (user) => {
      console.log('User joined:', user.name);
    },
    onUserLeft: (userId) => {
      console.log('User left:', userId);
    },
    onError: (err) => {
      console.error('Room error:', err);
    },
  });

  // Test audio on mount
  useEffect(() => {
    const testAudioPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setAudioPermission('granted');

        // Create analyzer to show audio level
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const level = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length / 255;
          setAudioLevel(level);

          if (audioPermission === 'granted') {
            requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();

        return () => {
          stream.getTracks().forEach((track) => track.stop());
          audioContext.close();
        };
      } catch (err) {
        setAudioPermission('denied');
      }
    };

    if (isTestingAudio) {
      testAudioPermission();
    }
  }, [isTestingAudio, audioPermission]);

  const handleJoin = useCallback(async () => {
    if (!userName.trim()) return;
    await join(userName.trim(), instrument || undefined);
    setHasJoined(true);
  }, [userName, instrument, join]);

  // Show DAW layout once joined
  if (hasJoined && isConnected) {
    return <DAWLayout roomId={roomId} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-indigo-500" />
          </div>
          <CardTitle className="text-2xl">Join Room</CardTitle>
          <CardDescription>
            Room code: <span className="text-gray-900 dark:text-white font-mono">{roomId}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Name input */}
          <Input
            label="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            disabled={isJoining}
          />

          {/* Instrument selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">Instrument (optional)</label>
            <div className="grid grid-cols-3 gap-2">
              {instruments.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => setInstrument(inst.id === instrument ? '' : inst.id)}
                  disabled={isJoining}
                  className={`
                    flex flex-col items-center gap-1 p-3 rounded-lg transition-all
                    ${instrument === inst.id
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                    ${isJoining && 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  <span className="text-xl">{inst.icon}</span>
                  <span className="text-xs">{inst.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio test */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-500 dark:text-gray-400">Audio Check</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTestingAudio(!isTestingAudio)}
              >
                {isTestingAudio ? 'Stop Test' : 'Test Audio'}
              </Button>
            </div>

            {isTestingAudio && (
              <div className="space-y-3 p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                {audioPermission === 'pending' && (
                  <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Requesting microphone access...</span>
                  </div>
                )}

                {audioPermission === 'denied' && (
                  <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Microphone access denied. Please enable it in your browser settings.</span>
                  </div>
                )}

                {audioPermission === 'granted' && (
                  <>
                    <div className="flex items-center gap-3">
                      <Mic className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">Microphone connected</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Input Level</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all duration-75"
                          style={{ width: `${audioLevel * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Speak or play your instrument to see the level meter move
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <Button
            onClick={handleJoin}
            disabled={!userName.trim() || isJoining}
            loading={isJoining}
            className="w-full"
            size="lg"
          >
            {isJoining ? 'Joining...' : 'Join Room'}
            {!isJoining && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
