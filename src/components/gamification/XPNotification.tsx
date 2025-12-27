'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Trophy } from 'lucide-react';

interface XPNotificationProps {
  amount: number;
  reason: string;
  levelUp?: { oldLevel: number; newLevel: number };
  achievement?: { id: string; name: string };
  onComplete?: () => void;
}

export function XPNotification({
  amount,
  reason,
  levelUp,
  achievement,
  onComplete,
}: XPNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 300);
    }, levelUp || achievement ? 4000 : 2500);

    return () => clearTimeout(timer);
  }, [onComplete, levelUp, achievement]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-24 right-6 z-50"
        >
          {levelUp ? (
            <LevelUpCard oldLevel={levelUp.oldLevel} newLevel={levelUp.newLevel} />
          ) : achievement ? (
            <AchievementCard name={achievement.name} />
          ) : (
            <XPCard amount={amount} reason={reason} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function XPCard({ amount, reason }: { amount: number; reason: string }) {
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl px-6 py-4 shadow-2xl shadow-indigo-500/25 flex items-center gap-4"
    >
      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-white font-bold text-lg">+{amount} XP</p>
        <p className="text-white/80 text-sm">{reason}</p>
      </div>
    </motion.div>
  );
}

function LevelUpCard({ oldLevel, newLevel }: { oldLevel: number; newLevel: number }) {
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.5, repeat: 2 }}
      className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl px-8 py-6 shadow-2xl shadow-orange-500/25 text-center"
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.5, repeat: 3 }}
      >
        <TrendingUp className="w-12 h-12 text-white mx-auto mb-2" />
      </motion.div>
      <p className="text-white/80 text-sm uppercase tracking-wider mb-1">Level Up!</p>
      <p className="text-white font-bold text-3xl">Level {newLevel}</p>
      <p className="text-white/60 text-sm mt-1">Keep jamming!</p>
    </motion.div>
  );
}

function AchievementCard({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-r from-yellow-600 to-amber-500 rounded-xl px-6 py-4 shadow-2xl shadow-yellow-500/25 flex items-center gap-4"
    >
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 1 }}
        className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
      >
        <Trophy className="w-6 h-6 text-white" />
      </motion.div>
      <div>
        <p className="text-white/80 text-sm">Achievement Unlocked!</p>
        <p className="text-white font-bold text-lg">{name}</p>
      </div>
    </motion.div>
  );
}

// XP Notification Manager
let notificationQueue: XPNotificationProps[] = [];
let isShowingNotification = false;
let showNotification: ((props: XPNotificationProps) => void) | null = null;

export function setXPNotificationHandler(handler: (props: XPNotificationProps) => void) {
  showNotification = handler;
  processQueue();
}

export function queueXPNotification(props: XPNotificationProps) {
  notificationQueue.push(props);
  processQueue();
}

function processQueue() {
  if (isShowingNotification || notificationQueue.length === 0 || !showNotification) return;

  isShowingNotification = true;
  const notification = notificationQueue.shift()!;

  showNotification({
    ...notification,
    onComplete: () => {
      isShowingNotification = false;
      processQueue();
    },
  });
}
