'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import {
  Crown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Guitar,
  Music,
  Wifi,
  WifiOff,
  Activity,
  Clock,
  Zap,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  UserX,
  Ban,
  Shield,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User, UserPerformanceInfo, LatencyBreakdown } from '@/types';
import { getConnectionQualityColor } from '@/stores/performance-sync-store';
import { QUALITY_PRESETS } from '@/lib/audio/quality-presets';
import { RoomRole, ROLE_INFO } from '@/types/permissions';

interface UserPerformanceCardProps {
  user: User;
  performance?: UserPerformanceInfo;
  isCurrentUser: boolean;
  isMasterUser: boolean;
  audioLevel: number;
  onMute?: () => void;
  canControl: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  // Role management props
  role?: RoomRole;
  roleInfo?: typeof ROLE_INFO[RoomRole];
  canManageRole?: boolean;
  isRoleDropdownOpen?: boolean;
  onToggleRoleDropdown?: () => void;
  assignableRoles?: RoomRole[];
  onRoleChange?: (role: RoomRole) => void;
  onCustomizePermissions?: () => void;
  onKickUser?: () => void;
  onBanUser?: () => void;
  hasCustomPermissions?: boolean;
}

// Instrument icons
const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-3.5 h-3.5" />,
  bass: <Guitar className="w-3.5 h-3.5" />,
  drums: <Drum className="w-3.5 h-3.5" />,
  keys: <Piano className="w-3.5 h-3.5" />,
  piano: <Piano className="w-3.5 h-3.5" />,
  vocals: <Mic className="w-3.5 h-3.5" />,
  mic: <Mic className="w-3.5 h-3.5" />,
  other: <Music className="w-3.5 h-3.5" />,
};

// Instrument colors
const instrumentColors: Record<string, string> = {
  guitar: 'text-amber-500',
  bass: 'text-green-500',
  drums: 'text-orange-500',
  keys: 'text-purple-500',
  piano: 'text-purple-500',
  vocals: 'text-pink-500',
  mic: 'text-pink-500',
  other: 'text-blue-500',
};

function LatencyBreakdownBar({ breakdown }: { breakdown: LatencyBreakdown }) {
  const total = breakdown.total || 1;
  const segments = [
    { key: 'capture', value: breakdown.capture, color: 'bg-blue-500', label: 'Capture' },
    { key: 'encode', value: breakdown.encode, color: 'bg-indigo-500', label: 'Encode' },
    { key: 'network', value: breakdown.network, color: 'bg-purple-500', label: 'Network' },
    { key: 'jitterBuffer', value: breakdown.jitterBuffer, color: 'bg-pink-500', label: 'Buffer' },
    { key: 'decode', value: breakdown.decode, color: 'bg-rose-500', label: 'Decode' },
    { key: 'effects', value: breakdown.effects, color: 'bg-orange-500', label: 'Effects' },
    { key: 'playback', value: breakdown.playback, color: 'bg-amber-500', label: 'Playback' },
    { key: 'compensation', value: breakdown.compensation, color: 'bg-gray-500', label: 'Sync' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn(segment.color, 'h-full transition-all')}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value.toFixed(1)}ms`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', segment.color)} />
            <span className="text-gray-500 dark:text-zinc-500">{segment.label}</span>
            <span className="text-gray-700 dark:text-zinc-300 font-medium">
              {segment.value.toFixed(1)}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityScoreRing({ score }: { score: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? 'text-emerald-500' :
    score >= 60 ? 'text-lime-500' :
    score >= 40 ? 'text-amber-500' :
    'text-red-500';

  return (
    <div className="relative w-10 h-10">
      <svg className="w-10 h-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-200 dark:text-white/10"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-xs font-bold', color)}>{score}</span>
      </div>
    </div>
  );
}

export function UserPerformanceCard({
  user,
  performance,
  isCurrentUser,
  isMasterUser,
  audioLevel,
  onMute,
  canControl,
  expanded = false,
  onToggleExpand,
  // Role props
  role,
  roleInfo,
  canManageRole,
  isRoleDropdownOpen,
  onToggleRoleDropdown,
  assignableRoles,
  onRoleChange,
  onCustomizePermissions,
  onKickUser,
  onBanUser,
  hasCustomPermissions,
}: UserPerformanceCardProps) {
  const instrument = user.instrument || 'other';
  const instrumentIcon = instrumentIcons[instrument.toLowerCase()] || instrumentIcons.other;
  const instrumentColor = instrumentColors[instrument.toLowerCase()] || instrumentColors.other;
  const isActive = audioLevel > 0.1;
  const isMuted = user.isMuted;

  const preset = performance?.activePreset
    ? QUALITY_PRESETS[performance.activePreset]
    : null;

  const connectionQuality = performance?.connectionQuality || 'fair';
  const hasIssues = connectionQuality === 'poor' || (performance?.packetLoss || 0) > 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'relative rounded-xl border transition-all',
        isActive
          ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/30'
          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10',
        isCurrentUser && 'ring-2 ring-indigo-500/50',
        hasIssues && 'border-amber-500/50'
      )}
    >
      {/* Main content */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Avatar with activity indicator */}
          <div className="relative">
            <UserAvatar
              userId={user.id}
              username={user.name}
              size="md"
              variant="headshot"
            />

            {/* Audio activity ring */}
            {isActive && (
              <motion.div
                className="absolute -inset-1 rounded-full border-2 border-indigo-500/50"
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}

            {/* Muted indicator */}
            {isMuted && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {user.name}
              </span>
              {isCurrentUser && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-500 font-medium">
                  YOU
                </span>
              )}
              {isMasterUser && (
                <Crown className="w-3.5 h-3.5 text-amber-500" />
              )}
              {hasIssues && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>

            {/* Instrument + Role */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className={cn('flex items-center gap-1', instrumentColor)}>
                {instrumentIcon}
                <span className="text-xs capitalize">{instrument}</span>
              </div>
              {/* Role badge */}
              {roleInfo && (
                <div className="relative">
                  <button
                    onClick={canManageRole ? onToggleRoleDropdown : undefined}
                    disabled={!canManageRole}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                      canManageRole
                        ? 'hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer'
                        : 'cursor-default',
                      roleInfo.color
                    )}
                  >
                    <span>{roleInfo.icon}</span>
                    <span>{roleInfo.name}</span>
                    {canManageRole && <ChevronDown className="w-2.5 h-2.5" />}
                  </button>

                  {/* Role dropdown */}
                  {isRoleDropdownOpen && canManageRole && assignableRoles && (
                    <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg z-[100] py-1">
                      {assignableRoles.map((r) => {
                        const info = ROLE_INFO[r];
                        return (
                          <button
                            key={r}
                            onClick={() => onRoleChange?.(r)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/5 text-left',
                              role === r && 'bg-gray-100 dark:bg-white/10'
                            )}
                          >
                            <span>{info.icon}</span>
                            <span className="flex-1 text-gray-800 dark:text-zinc-200">{info.name}</span>
                            {role === r && <Check className="w-3 h-3 text-indigo-500" />}
                          </button>
                        );
                      })}
                      <div className="border-t border-gray-200 dark:border-white/10 my-1" />
                      <button
                        onClick={onCustomizePermissions}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/5 text-left text-gray-600 dark:text-zinc-400"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>Customize...</span>
                      </button>
                      <div className="border-t border-gray-200 dark:border-white/10 my-1" />
                      <button
                        onClick={onKickUser}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-amber-50 dark:hover:bg-amber-500/10 text-left text-amber-600 dark:text-amber-400"
                      >
                        <UserX className="w-3 h-3" />
                        <span>Kick</span>
                      </button>
                      <button
                        onClick={onBanUser}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-500/10 text-left text-red-600 dark:text-red-400"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Ban</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {hasCustomPermissions && (
                <span className="text-[10px] text-amber-500" title="Has custom permissions">
                  ★
                </span>
              )}
            </div>
          </div>

          {/* Performance metrics */}
          {performance && (
            <div className="flex items-center gap-3">
              {/* Latency */}
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>Latency</span>
                </div>
                <div className={cn(
                  'text-sm font-semibold',
                  performance.rttToMaster < 30 ? 'text-emerald-500' :
                  performance.rttToMaster < 60 ? 'text-lime-500' :
                  performance.rttToMaster < 100 ? 'text-amber-500' :
                  'text-red-500'
                )}>
                  {Math.round(performance.rttToMaster)}ms
                </div>
              </div>

              {/* Quality Score */}
              <QualityScoreRing score={performance.qualityScore} />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1">
            {canControl && !isCurrentUser && (
              <button
                onClick={onMute}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isMuted
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/20'
                )}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            )}

            {performance && onToggleExpand && (
              <button
                onClick={onToggleExpand}
                className="p-1.5 rounded-lg bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Audio level bar */}
        <div className="mt-2 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            animate={{ width: `${audioLevel * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Performance info strip */}
        {performance && !expanded && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
            <div className="flex items-center gap-1">
              <Wifi className={cn('w-3 h-3', getConnectionQualityColor(connectionQuality))} />
              <span>{performance.rttToMaster}ms</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>Opus {performance.bitrate}k/{performance.frameSize}ms</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span className="capitalize">{performance.jitterBufferMode.replace('-', ' ')}</span>
            </div>
            {performance.compensationDelay > 0 && (
              <div className="flex items-center gap-1 text-amber-500">
                <Clock className="w-3 h-3" />
                <span>+{Math.round(performance.compensationDelay)}ms sync</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && performance && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-200 dark:border-white/10 px-3 py-3 space-y-3"
        >
          {/* Encoding info */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Codec</div>
              <div className="font-medium text-gray-900 dark:text-white">
                Opus {performance.bitrate}kbps
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Frame Size</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {performance.frameSize}ms
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Sample Rate</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {performance.sampleRate / 1000}kHz
              </div>
            </div>
          </div>

          {/* FEC and DTX */}
          <div className="flex gap-3 text-xs">
            <div className={cn(
              'px-2 py-1 rounded',
              performance.fecEnabled
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-500'
            )}>
              FEC {performance.fecEnabled ? 'ON' : 'OFF'}
            </div>
            <div className={cn(
              'px-2 py-1 rounded',
              performance.dtxEnabled
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-500'
            )}>
              DTX {performance.dtxEnabled ? 'ON' : 'OFF'}
            </div>
            <div className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-500">
              {preset?.name || 'Custom'}
            </div>
          </div>

          {/* Network stats */}
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">RTT</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {Math.round(performance.rttToMaster)}ms
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Jitter</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {performance.jitter.toFixed(1)}ms
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Packet Loss</div>
              <div className={cn(
                'font-medium',
                performance.packetLoss > 3 ? 'text-red-500' : 'text-gray-900 dark:text-white'
              )}>
                {performance.packetLoss.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-zinc-500 mb-0.5">Buffer</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {performance.jitterBufferSize} samples
              </div>
            </div>
          </div>

          {/* Latency breakdown */}
          <div>
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-2">Latency Breakdown</div>
            <LatencyBreakdownBar breakdown={performance.latencyBreakdown} />
          </div>

          {/* Compensation */}
          {performance.compensationDelay > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              <Clock className="w-4 h-4" />
              <span>
                Sync delay: +{Math.round(performance.compensationDelay)}ms
                (compensating for group latency)
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
