'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Users,
  Music,
  Globe,
  Lock,
  Radio,
  Wand2,
  Layers,
  Mic,
  Copy,
  Share2,
  Check,
  ListChecks,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RoomListItem, RoomRules } from '@/types';

interface RoomInfoPanelProps {
  room: RoomListItem;
  variant?: 'compact' | 'full';
  className?: string;
}

export function RoomInfoPanel({ room, variant = 'compact', className = '' }: RoomInfoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/room/${room.id}`;
    if (navigator.share) {
      await navigator.share({
        title: room.name,
        text: `Join my jam session: ${room.name}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(room.createdAt), { addSuffix: true });

  if (variant === 'compact') {
    return (
      <div className={`rounded-xl bg-gray-800/50 border border-gray-700 ${className}`}>
        {/* Compact header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Info className="w-4 h-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="font-medium text-white truncate">{room.name}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  {room.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {room.isPublic ? 'Public' : 'Private'}
                </span>
                <span className="font-mono text-gray-500">{room.id}</span>
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
          )}
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                <RoomInfoContent
                  room={room}
                  timeAgo={timeAgo}
                  onCopyCode={handleCopyCode}
                  onShare={handleShare}
                  copied={copied}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`rounded-xl bg-gray-800/50 border border-gray-700 p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{room.name}</h2>
            {room.creatorName && (
              <p className="text-sm text-gray-400">Created by {room.creatorName}</p>
            )}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${
          room.isPublic
            ? 'bg-green-500/10 text-green-400'
            : 'bg-amber-500/10 text-amber-400'
        }`}>
          {room.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span className="text-sm font-medium">{room.isPublic ? 'Public' : 'Private'}</span>
        </div>
      </div>

      <RoomInfoContent
        room={room}
        timeAgo={timeAgo}
        onCopyCode={handleCopyCode}
        onShare={handleShare}
        copied={copied}
      />
    </div>
  );
}

// Shared content component
function RoomInfoContent({
  room,
  timeAgo,
  onCopyCode,
  onShare,
  copied,
}: {
  room: RoomListItem;
  timeAgo: string;
  onCopyCode: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  return (
    <>
      {/* Description */}
      {room.description && (
        <div className="p-3 rounded-lg bg-gray-900/50">
          <p className="text-sm text-gray-300 leading-relaxed">{room.description}</p>
        </div>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-sm">
        {room.genre && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900/50 text-gray-300">
            <Music className="w-3.5 h-3.5 text-indigo-400" />
            <span className="capitalize">{room.genre}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900/50 text-gray-300">
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>{room.activeUsers || 0}/{room.maxUsers} musicians</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900/50 text-gray-300">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Tags */}
      {room.tags && room.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {room.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Room code and sharing */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/50 font-mono text-sm">
          <span className="text-gray-500">Room Code:</span>
          <span className="text-white font-medium">{room.id}</span>
        </div>
        <button
          onClick={onCopyCode}
          className="p-2 rounded-lg bg-gray-900/50 hover:bg-gray-800 transition-colors"
          title="Copy room code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
        <button
          onClick={onShare}
          className="p-2 rounded-lg bg-gray-900/50 hover:bg-gray-800 transition-colors"
          title="Share room"
        >
          <Share2 className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Rules section */}
      {room.rules && (
        <RoomRulesDisplay rules={room.rules} />
      )}
    </>
  );
}

// Rules display component
function RoomRulesDisplay({ rules }: { rules: Partial<RoomRules> }) {
  const hasAnyRules =
    rules.customRules?.length ||
    !rules.allowBackingTracks ||
    !rules.allowAIGeneration ||
    !rules.allowStemSeparation ||
    rules.requireMicCheck;

  if (!hasAnyRules) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-indigo-400" />
        <h4 className="text-sm font-medium text-white">Room Rules</h4>
      </div>

      {/* Feature rules */}
      <div className="grid grid-cols-2 gap-2">
        <RuleIndicator
          icon={Radio}
          label="Backing Tracks"
          allowed={rules.allowBackingTracks !== false}
        />
        <RuleIndicator
          icon={Wand2}
          label="AI Generation"
          allowed={rules.allowAIGeneration !== false}
        />
        <RuleIndicator
          icon={Layers}
          label="Stem Separation"
          allowed={rules.allowStemSeparation !== false}
        />
        <RuleIndicator
          icon={Mic}
          label="Mic Check Required"
          allowed={rules.requireMicCheck === true}
          invertColors
        />
      </div>

      {/* Custom rules */}
      {rules.customRules && rules.customRules.length > 0 && (
        <div className="space-y-1.5">
          {rules.customRules.map((rule, index) => (
            <div
              key={index}
              className="flex items-start gap-2 text-sm text-gray-300"
            >
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Individual rule indicator
function RuleIndicator({
  icon: Icon,
  label,
  allowed,
  invertColors = false,
}: {
  icon: React.ElementType;
  label: string;
  allowed: boolean;
  invertColors?: boolean;
}) {
  const isPositive = invertColors ? allowed : allowed;
  const displayAllowed = invertColors ? allowed : allowed;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
      displayAllowed
        ? 'bg-green-500/10 text-green-400'
        : 'bg-red-500/10 text-red-400'
    }`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="ml-auto font-medium">
        {displayAllowed ? 'Yes' : 'No'}
      </span>
    </div>
  );
}
