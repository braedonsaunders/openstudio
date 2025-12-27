'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatRelativeTime } from '@/lib/utils';
import {
  Users,
  Lock,
  Globe,
  Music,
  Clock,
  ArrowRight,
  MoreVertical,
  Trash2,
  Copy,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RoomListItem } from '@/types';

interface RoomCardProps {
  room: RoomListItem;
  isOwner?: boolean;
  onDelete?: (roomId: string) => void;
  variant?: 'default' | 'compact';
}

export function RoomCard({ room, isOwner, onDelete, variant = 'default' }: RoomCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleJoin = () => {
    router.push(`/room/${room.id}`);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(room.id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(room.id);
    }
    setShowMenu(false);
  };

  const timeAgo = formatRelativeTime(room.createdAt);
  const isLive = room.activeUsers && room.activeUsers > 0;

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="group flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
        onClick={handleJoin}
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          isLive
            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600'
        }`}>
          <Music className="w-6 h-6 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900 dark:text-white truncate">{room.name}</h3>
            {isLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              {room.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {room.isPublic ? 'Public' : 'Private'}
            </span>
            {room.genre && (
              <span className="capitalize">{room.genre}</span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {room.activeUsers || 0}/{room.maxUsers}
            </span>
          </div>
        </div>

        {/* Join button */}
        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all overflow-hidden"
    >
      {/* Header with gradient */}
      <div className={`relative h-24 ${
        isLive
          ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600'
          : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'
      }`}>
        {/* Animated pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.3'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-medium text-white">Live Now</span>
          </div>
        )}

        {/* Menu button */}
        {isOwner && (
          <div className="absolute top-3 right-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-white" />
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-40 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-slate-200 dark:border-gray-700 z-20 overflow-hidden">
                  <button
                    onClick={handleCopyCode}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <div className="border-t border-slate-200 dark:border-gray-700" />
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Room code badge */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-sm">
          <span className="font-mono text-xs text-white/90">{room.id}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white truncate">
              {room.name}
            </h3>
            {room.creatorName && (
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                by {room.creatorName}
              </p>
            )}
          </div>
          <div className={`shrink-0 p-2 rounded-lg ${
            room.isPublic
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
          }`}>
            {room.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
        </div>

        {/* Description */}
        {room.description && (
          <p className="text-sm text-slate-600 dark:text-gray-300 mt-3 line-clamp-2">
            {room.description}
          </p>
        )}

        {/* Tags */}
        {room.tags && room.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {room.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
            {room.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-slate-500 dark:text-gray-500">
                +{room.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 dark:text-gray-400">
          {room.genre && (
            <span className="flex items-center gap-1 capitalize">
              <Music className="w-3.5 h-3.5" />
              {room.genre}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {room.activeUsers || 0}/{room.maxUsers}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeAgo}
          </span>
        </div>

        {/* Join button */}
        <Button
          onClick={handleJoin}
          className="w-full mt-4"
          variant={isLive ? 'success' : 'primary'}
        >
          {isLive ? 'Join Session' : 'Enter Room'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Copied toast */}
      {isCopied && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium"
        >
          Copied!
        </motion.div>
      )}
    </motion.div>
  );
}
