'use client';

import { cn, formatLatency, getConnectionQualityColor, getConnectionQualityBg } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { Wifi, WifiOff, Activity, Clock, Server } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function ConnectionStatus({ className, showDetails = false }: ConnectionStatusProps) {
  const { jitterStats, webrtcStats, connectionQuality, currentBufferSize } = useAudioStore();

  const getIcon = () => {
    switch (connectionQuality) {
      case 'excellent':
      case 'good':
        return <Wifi className="w-4 h-4" />;
      case 'fair':
        return <Wifi className="w-4 h-4 animate-pulse" />;
      case 'poor':
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const qualityLabel = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  };

  if (!showDetails) {
    return (
      <Tooltip
        content={
          <div className="space-y-1">
            <div>Connection: {qualityLabel[connectionQuality]}</div>
            <div>Latency: {formatLatency(jitterStats.roundTripTime)}</div>
            <div>Jitter: {formatLatency(jitterStats.averageJitter)}</div>
            <div>Buffer: {currentBufferSize} samples</div>
          </div>
        }
      >
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-sm',
            getConnectionQualityColor(connectionQuality),
            className
          )}
        >
          {getIcon()}
          <span className="hidden sm:inline">{qualityLabel[connectionQuality]}</span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className={cn('space-y-3 p-4 bg-gray-800/50 rounded-xl', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Connection Quality</span>
        <div className={cn('flex items-center gap-2', getConnectionQualityColor(connectionQuality))}>
          {getIcon()}
          <span className="font-medium">{qualityLabel[connectionQuality]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            Round Trip Time
          </div>
          <div className="text-sm font-medium text-white">
            {formatLatency(jitterStats.roundTripTime)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Activity className="w-3 h-3" />
            Jitter
          </div>
          <div className="text-sm font-medium text-white">
            {formatLatency(jitterStats.averageJitter)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Server className="w-3 h-3" />
            Buffer Size
          </div>
          <div className="text-sm font-medium text-white">
            {currentBufferSize} samples
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Packet Loss
          </div>
          <div className="text-sm font-medium text-white">
            {(jitterStats.packetLoss * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Buffer indicator */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Buffer Latency</span>
          <span className="text-gray-300">
            {((currentBufferSize / 48000) * 1000).toFixed(1)}ms
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', getConnectionQualityBg(connectionQuality))}
            style={{ width: `${(currentBufferSize / 1024) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>128</span>
          <span>256</span>
          <span>512</span>
          <span>1024</span>
        </div>
      </div>
    </div>
  );
}
