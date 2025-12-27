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
  const { jitterStats, webrtcStats, connectionQuality, performanceMetrics, settings } = useAudioStore();

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

  const qualityBadgeStyles = {
    excellent: 'bg-emerald-50 text-emerald-600',
    good: 'bg-lime-50 text-lime-600',
    fair: 'bg-amber-50 text-amber-600',
    poor: 'bg-red-50 text-red-600',
  };

  if (!showDetails) {
    return (
      <Tooltip
        content={
          <div className="space-y-1">
            <div>Connection: {qualityLabel[connectionQuality]}</div>
            <div>Latency: {formatLatency(jitterStats.roundTripTime)}</div>
            <div>Jitter: {formatLatency(jitterStats.averageJitter)}</div>
            <div>Buffer: {performanceMetrics.currentBufferSize} samples</div>
          </div>
        }
      >
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium',
            qualityBadgeStyles[connectionQuality],
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
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Connection Quality</span>
        <div className={cn('flex items-center gap-2 px-2.5 py-1 rounded-full text-sm font-medium', qualityBadgeStyles[connectionQuality])}>
          {getIcon()}
          <span>{qualityLabel[connectionQuality]}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Clock}
          label="Round Trip Time"
          value={formatLatency(jitterStats.roundTripTime)}
        />
        <StatCard
          icon={Activity}
          label="Jitter"
          value={formatLatency(jitterStats.averageJitter)}
        />
        <StatCard
          icon={Server}
          label="Buffer Size"
          value={`${performanceMetrics.currentBufferSize} samples`}
        />
        <StatCard
          label="Packet Loss"
          value={`${(jitterStats.packetLoss * 100).toFixed(2)}%`}
        />
      </div>

      {/* Buffer indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Buffer Latency</span>
          <span className="text-slate-700 font-medium">
            {performanceMetrics.audioContextLatency.toFixed(1)}ms
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', getConnectionQualityBg(connectionQuality))}
            style={{ width: `${Math.min((performanceMetrics.currentBufferSize / 2048) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>256</span>
          <span>512</span>
          <span>1024</span>
          <span>2048</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
