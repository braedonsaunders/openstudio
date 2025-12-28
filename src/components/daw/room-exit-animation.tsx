'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Music2, Music3, Music4, Disc3, Mic2, Guitar, Piano, Drum } from 'lucide-react';

interface RoomExitAnimationProps {
  isExiting: boolean;
  onAnimationComplete: () => void;
  children: React.ReactNode;
}

// Musical note icons for the scatter effect
const musicalIcons = [Music, Music2, Music3, Music4, Disc3, Mic2, Guitar, Piano, Drum];

interface FloatingNote {
  id: number;
  Icon: typeof Music;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
  duration: number;
  color: string;
}

const colors = [
  'rgb(99, 102, 241)', // indigo
  'rgb(168, 85, 247)',  // purple
  'rgb(236, 72, 153)',  // pink
  'rgb(59, 130, 246)',  // blue
  'rgb(20, 184, 166)',  // teal
  'rgb(245, 158, 11)',  // amber
];

export function RoomExitAnimation({ isExiting, onAnimationComplete, children }: RoomExitAnimationProps) {
  const [notes, setNotes] = useState<FloatingNote[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);

  // Generate floating notes when exit starts
  useEffect(() => {
    if (isExiting) {
      const generatedNotes: FloatingNote[] = [];
      const noteCount = 24;

      for (let i = 0; i < noteCount; i++) {
        generatedNotes.push({
          id: i,
          Icon: musicalIcons[Math.floor(Math.random() * musicalIcons.length)],
          x: Math.random() * 100, // percentage across screen
          y: 50 + Math.random() * 50, // start from middle-bottom
          rotation: Math.random() * 360,
          scale: 0.5 + Math.random() * 1,
          delay: Math.random() * 0.3,
          duration: 0.8 + Math.random() * 0.4,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      setNotes(generatedNotes);
      setShowOverlay(true);
    }
  }, [isExiting]);

  const handleMainAnimationComplete = useCallback(() => {
    // Small delay to let notes finish floating
    setTimeout(() => {
      onAnimationComplete();
    }, 200);
  }, [onAnimationComplete]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait" onExitComplete={handleMainAnimationComplete}>
        {!isExiting ? (
          <motion.div
            key="daw-content"
            className="h-full w-full"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20,
              filter: 'blur(4px)',
            }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Exit overlay with floating notes */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Gradient overlay */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />

            {/* Floating musical notes */}
            {notes.map((note) => {
              const NoteIcon = note.Icon;
              return (
                <motion.div
                  key={note.id}
                  className="absolute"
                  style={{
                    left: `${note.x}%`,
                    bottom: `${note.y}%`,
                    color: note.color,
                  }}
                  initial={{
                    opacity: 0,
                    y: 0,
                    scale: 0,
                    rotate: note.rotation,
                  }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    y: -300 - Math.random() * 200,
                    scale: [0, note.scale, note.scale, note.scale * 0.5],
                    rotate: note.rotation + (Math.random() > 0.5 ? 180 : -180),
                  }}
                  transition={{
                    duration: note.duration,
                    delay: note.delay,
                    ease: [0.4, 0, 0.2, 1],
                    opacity: {
                      times: [0, 0.2, 0.7, 1],
                    },
                  }}
                >
                  <NoteIcon
                    className="w-8 h-8 drop-shadow-lg"
                    strokeWidth={1.5}
                  />
                </motion.div>
              );
            })}

            {/* Center farewell message */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <motion.div
                className="text-center"
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <motion.div
                  className="text-6xl mb-4"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: 0.1,
                  }}
                >
                  🎵
                </motion.div>
                <motion.p
                  className="text-white/90 text-xl font-medium tracking-wide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  See you next jam!
                </motion.p>
              </motion.div>
            </motion.div>

            {/* Sparkle effects */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute w-2 h-2 rounded-full bg-white"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 0.6,
                  delay: 0.3 + i * 0.08,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
