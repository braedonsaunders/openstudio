'use client';

import { cn, formatTime } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Waveform } from '../audio/waveform';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Volume2,
} from 'lucide-react';

interface TransportControlsProps {
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  className?: string;
}

export function TransportControls({
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrevious,
  className,
}: TransportControlsProps) {
  const { isPlaying, currentTime, duration, backingTrackVolume, setBackingTrackVolume } = useAudioStore();
  const { currentTrack, isMaster, queue } = useRoomStore();

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Track info */}
      {currentTrack && (
        <div className="text-center">
          <h3 className="font-semibold text-slate-900 text-lg truncate">{currentTrack.name}</h3>
          {currentTrack.artist && (
            <p className="text-sm text-slate-500 mt-1">{currentTrack.artist}</p>
          )}
        </div>
      )}

      {/* Waveform */}
      <Waveform
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={isMaster ? onSeek : undefined}
        className={cn(!isMaster && 'cursor-default')}
      />

      {/* Time display */}
      <div className="flex items-center justify-between text-sm text-slate-500 font-medium">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevious}
          disabled={!isMaster || queue.currentIndex <= 0}
          className="text-slate-600"
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isMaster || !currentTrack}
          className="w-16 h-16 rounded-full shadow-lg shadow-indigo-200"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7 ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          disabled={!isMaster || queue.currentIndex >= queue.tracks.length - 1}
          className="text-slate-600"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-9 h-9 text-slate-400 hover:text-slate-600">
            <Shuffle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-9 h-9 text-slate-400 hover:text-slate-600">
            <Repeat className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-32">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={backingTrackVolume}
            onChange={(e) => setBackingTrackVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Non-master notice */}
      {!isMaster && (
        <p className="text-xs text-slate-400 text-center">
          Only the room master can control playback
        </p>
      )}
    </div>
  );
}
