'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REACTION_TYPES, type ReactionType } from '@/types/user';
import { useStatsTracker } from '@/hooks/useStatsTracker';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface ReactionPanelProps {
  targetUserId: string;
  targetUserName: string;
  onReactionSent?: (reactionType: ReactionType) => void;
  compact?: boolean;
  className?: string;
}

export function ReactionPanel({
  targetUserId,
  targetUserName,
  onReactionSent,
  compact = false,
  className = '',
}: ReactionPanelProps) {
  const { trackReactionSent } = useStatsTracker();
  const [isOpen, setIsOpen] = useState(false);
  const [recentReaction, setRecentReaction] = useState<ReactionType | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const handleReaction = useCallback(async (reactionType: ReactionType) => {
    if (cooldown) return;

    // Set cooldown to prevent spam
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);

    // Send the reaction
    await trackReactionSent(targetUserId, reactionType);
    setRecentReaction(reactionType);
    onReactionSent?.(reactionType);

    // Clear recent reaction after animation
    setTimeout(() => setRecentReaction(null), 1500);

    if (compact) {
      setIsOpen(false);
    }
  }, [targetUserId, trackReactionSent, onReactionSent, cooldown, compact]);

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="relative"
        >
          <Sparkles className="w-4 h-4" />
          <AnimatePresence>
            {recentReaction && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute -top-1 -right-1 text-lg"
              >
                {REACTION_TYPES[recentReaction].emoji}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 flex gap-1"
            >
              {(Object.keys(REACTION_TYPES) as ReactionType[]).map((type) => (
                <ReactionButton
                  key={type}
                  type={type}
                  onClick={() => handleReaction(type)}
                  disabled={cooldown}
                  size="sm"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
        React to {targetUserName}:
      </span>
      {(Object.keys(REACTION_TYPES) as ReactionType[]).map((type) => (
        <ReactionButton
          key={type}
          type={type}
          onClick={() => handleReaction(type)}
          disabled={cooldown}
          showLabel
        />
      ))}

      <AnimatePresence>
        {recentReaction && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: -20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className="ml-2 flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs"
          >
            <span>Sent {REACTION_TYPES[recentReaction].emoji}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ReactionButtonProps {
  type: ReactionType;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

function ReactionButton({ type, onClick, disabled, size = 'md', showLabel }: ReactionButtonProps) {
  const reaction = REACTION_TYPES[type];

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 rounded-full transition-all
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
        ${size === 'sm' ? 'p-1.5 text-lg' : 'px-2 py-1.5 text-xl'}
      `}
      title={reaction.label}
    >
      <span>{reaction.emoji}</span>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{reaction.label}</span>
      )}
    </motion.button>
  );
}

// Floating reaction display for showing received reactions
interface FloatingReactionProps {
  emoji: string;
  fromUser: string;
  onComplete?: () => void;
}

export function FloatingReaction({ emoji, fromUser, onComplete }: FloatingReactionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.5 }}
      onAnimationComplete={onComplete}
      transition={{ duration: 0.5 }}
      className="fixed bottom-24 right-8 z-50 flex flex-col items-center"
    >
      <motion.span
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0],
        }}
        transition={{ duration: 0.5, repeat: 2 }}
        className="text-6xl"
      >
        {emoji}
      </motion.span>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 px-3 py-1 bg-black/75 text-white text-sm rounded-full"
      >
        from {fromUser}
      </motion.span>
    </motion.div>
  );
}

// Reaction stream for showing multiple reactions
interface ReactionStreamProps {
  reactions: Array<{
    id: string;
    emoji: string;
    fromUser: string;
  }>;
  onReactionComplete: (id: string) => void;
}

export function ReactionStream({ reactions, onReactionComplete }: ReactionStreamProps) {
  return (
    <AnimatePresence>
      {reactions.map((reaction, index) => (
        <motion.div
          key={reaction.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{
            opacity: 1,
            x: 0,
            y: index * -60,
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-24 right-8 z-50"
          onAnimationComplete={() => {
            setTimeout(() => onReactionComplete(reaction.id), 2000);
          }}
        >
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-3 py-2 shadow-lg border border-gray-200 dark:border-gray-700">
            <span className="text-2xl">{reaction.emoji}</span>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {reaction.fromUser}
            </span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default ReactionPanel;
