'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SCENE_CONFIGS, SceneConfig } from './scene-config';
import { SceneSelector } from './SceneSelector';
import { WalkingCharacter } from './WalkingCharacter';
import type { HomepageCharacter, HomepageSceneType } from '@/types/avatar';

interface SceneRendererProps {
  onSceneChange?: (scene: HomepageSceneType) => void;
  showSceneSelector?: boolean;
  className?: string;
}

// Scene-specific decorative elements
function CampfireScene() {
  return (
    <>
      {/* Fireflies */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-yellow-400 rounded-full"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${40 + Math.random() * 40}%`,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [0.5, 1, 0.5],
            x: [0, Math.random() * 20 - 10, 0],
            y: [0, Math.random() * 20 - 10, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}

      {/* Campfire */}
      <div className="absolute left-1/2 top-[65%] -translate-x-1/2 z-10">
        <svg width="80" height="100" viewBox="0 0 80 100">
          {/* Fire glow */}
          <ellipse cx="40" cy="90" rx="35" ry="10" fill="rgba(255,165,0,0.3)" />
          {/* Logs */}
          <rect x="10" y="80" width="60" height="10" rx="5" fill="#4a2c0a" />
          <rect x="5" y="85" width="70" height="8" rx="4" fill="#3d2108" />
          {/* Flames */}
          <motion.path
            d="M40 30 Q30 50 35 70 Q40 75 45 70 Q50 50 40 30"
            fill="#ff6b35"
            animate={{ d: ['M40 30 Q30 50 35 70 Q40 75 45 70 Q50 50 40 30', 'M40 25 Q25 55 35 70 Q40 75 45 70 Q55 55 40 25'] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          />
          <motion.path
            d="M40 40 Q35 55 38 68 Q40 72 42 68 Q45 55 40 40"
            fill="#ffcc00"
            animate={{ d: ['M40 40 Q35 55 38 68 Q40 72 42 68 Q45 55 40 40', 'M40 35 Q32 58 38 68 Q40 72 42 68 Q48 58 40 35'] }}
            transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', delay: 0.1 }}
          />
        </svg>
      </div>

      {/* Mountains silhouette */}
      <svg className="absolute bottom-[65%] left-0 w-full h-[20%]" preserveAspectRatio="none" viewBox="0 0 100 20">
        <path d="M0 20 L15 5 L30 15 L50 2 L70 12 L85 4 L100 15 L100 20 Z" fill="#1a1a2e" opacity="0.5" />
      </svg>

      {/* Stars */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 25}%`,
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}
    </>
  );
}

function BeachScene() {
  return (
    <>
      {/* Sun */}
      <motion.div
        className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500"
        style={{ left: '70%', top: '8%' }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Waves */}
      <div className="absolute bottom-[65%] left-0 w-full overflow-hidden">
        <motion.svg
          viewBox="0 0 1200 100"
          className="w-[200%] h-8"
          animate={{ x: [0, -600] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <path
            d="M0 50 Q150 20 300 50 Q450 80 600 50 Q750 20 900 50 Q1050 80 1200 50 L1200 100 L0 100 Z"
            fill="rgba(59, 130, 246, 0.5)"
          />
        </motion.svg>
      </div>

      {/* Palm trees */}
      <div className="absolute left-[5%] top-[30%]">
        <svg width="60" height="100" viewBox="0 0 60 100">
          <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 3, repeat: Infinity }} style={{ transformOrigin: 'bottom center' }}>
            <rect x="27" y="50" width="6" height="50" fill="#5d4037" rx="2" />
            <ellipse cx="30" cy="35" rx="25" ry="15" fill="#2e7d32" />
            <ellipse cx="20" cy="40" rx="20" ry="12" fill="#388e3c" />
            <ellipse cx="40" cy="40" rx="20" ry="12" fill="#388e3c" />
          </motion.g>
        </svg>
      </div>

      {/* Clouds */}
      {[15, 45, 75].map((left, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${left}%`, top: `${5 + i * 3}%` }}
          animate={{ x: [0, 20, 0] }}
          transition={{ duration: 10 + i * 2, repeat: Infinity }}
        >
          <div className="w-16 h-6 bg-white/30 rounded-full blur-sm" />
        </motion.div>
      ))}
    </>
  );
}

function StudioScene() {
  return (
    <>
      {/* LED Strip at top */}
      <div className="absolute top-[10%] left-[10%] right-[10%] h-2 flex gap-1">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-full"
            style={{
              background: `hsl(${(i * 18) % 360}, 80%, 60%)`,
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>

      {/* VU Meters */}
      <div className="absolute top-[15%] left-[35%] flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-2 bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 rounded-sm"
            animate={{ height: [10 + Math.random() * 30, 20 + Math.random() * 40, 10 + Math.random() * 30] }}
            transition={{ duration: 0.2 + Math.random() * 0.3, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Mixing console silhouette */}
      <div className="absolute top-[18%] left-[25%] w-[50%] h-8 bg-gradient-to-b from-gray-700 to-gray-800 rounded-t-lg opacity-60">
        <div className="flex justify-around pt-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-1 h-4 bg-gray-500 rounded-full" />
          ))}
        </div>
      </div>

      {/* Monitor speakers */}
      <div className="absolute top-[12%] left-[15%] w-8 h-12 bg-gray-800 rounded-lg" />
      <div className="absolute top-[12%] right-[15%] w-8 h-12 bg-gray-800 rounded-lg" />

      {/* Studio grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[70%] overflow-hidden opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'top',
          }}
        />
      </div>
    </>
  );
}

function ForestScene() {
  return (
    <>
      {/* Sun rays */}
      <div className="absolute top-0 right-[20%] w-32 h-32">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-full h-1 bg-gradient-to-r from-yellow-200/30 to-transparent origin-left"
            style={{ rotate: i * 30 - 60 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>

      {/* Trees silhouette */}
      <div className="absolute top-[20%] left-0 w-[15%]">
        <svg viewBox="0 0 50 100" className="w-full h-40">
          <motion.g animate={{ rotate: [-1, 1, -1] }} transition={{ duration: 4, repeat: Infinity }} style={{ transformOrigin: 'bottom center' }}>
            <rect x="22" y="60" width="6" height="40" fill="#2d1810" />
            <ellipse cx="25" cy="40" rx="22" ry="35" fill="#1e5631" />
          </motion.g>
        </svg>
      </div>
      <div className="absolute top-[18%] right-0 w-[12%]">
        <svg viewBox="0 0 50 100" className="w-full h-36">
          <motion.g animate={{ rotate: [1, -1, 1] }} transition={{ duration: 5, repeat: Infinity }} style={{ transformOrigin: 'bottom center' }}>
            <rect x="22" y="55" width="6" height="45" fill="#3d2415" />
            <ellipse cx="25" cy="35" rx="20" ry="30" fill="#2d7a45" />
          </motion.g>
        </svg>
      </div>

      {/* Butterflies */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${35 + Math.random() * 30}%`,
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 10, 0],
            rotate: [0, 10, -10, 0],
          }}
          transition={{ duration: 5 + Math.random() * 3, repeat: Infinity, delay: i * 0.5 }}
        >
          🦋
        </motion.div>
      ))}

      {/* Flowers at bottom */}
      <div className="absolute bottom-[5%] left-0 right-0 flex justify-around opacity-70">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="text-lg"
            animate={{ y: [0, -3, 0], rotate: [-5, 5, -5] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          >
            {['🌸', '🌼', '🌺', '🌻'][i % 4]}
          </motion.div>
        ))}
      </div>
    </>
  );
}

function SpaceScene() {
  return (
    <>
      {/* Star field */}
      {Array.from({ length: 60 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 35}%`,
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}

      {/* Nebula */}
      <div
        className="absolute top-[5%] left-[20%] w-40 h-24 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.3), transparent)' }}
      />
      <div
        className="absolute top-[10%] right-[25%] w-32 h-20 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(ellipse, rgba(236, 72, 153, 0.2), transparent)' }}
      />

      {/* Planet */}
      <div className="absolute top-[8%] right-[15%]">
        <motion.div
          className="w-16 h-16 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #f97316, #dc2626, #9f1239)',
            boxShadow: 'inset -5px -5px 15px rgba(0,0,0,0.5)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />
        {/* Ring */}
        <div
          className="absolute top-1/2 left-1/2 w-24 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-300/50"
          style={{ transform: 'translate(-50%, -50%) rotateX(70deg)' }}
        />
      </div>

      {/* Space platform */}
      <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-[60%] h-8">
        <div className="w-full h-full bg-gradient-to-b from-gray-600 to-gray-800 rounded-lg border-t border-gray-500">
          {/* Platform lights */}
          <div className="flex justify-around mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-cyan-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function RooftopScene() {
  return (
    <>
      {/* City skyline */}
      <div className="absolute bottom-[68%] left-0 right-0 flex items-end justify-around">
        {[40, 60, 45, 70, 50, 55, 80, 45, 65].map((height, i) => (
          <div
            key={i}
            className="relative bg-gray-800"
            style={{ width: '8%', height: `${height}px` }}
          >
            {/* Windows */}
            <div className="absolute inset-1 grid grid-cols-2 gap-0.5">
              {Array.from({ length: Math.floor(height / 10) }).map((_, j) => (
                <motion.div
                  key={j}
                  className="bg-yellow-200"
                  animate={{ opacity: Math.random() > 0.5 ? [0.3, 1, 0.3] : 1 }}
                  transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Moon */}
      <motion.div
        className="absolute top-[5%] right-[20%] w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Stars */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 20}%`,
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
        />
      ))}

      {/* Neon signs */}
      <motion.div
        className="absolute top-[25%] left-[15%] px-2 py-1 text-pink-500 text-xs font-bold"
        style={{ textShadow: '0 0 10px #ec4899' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        OPEN
      </motion.div>

      {/* Rooftop floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[68%] bg-gradient-to-b from-gray-700 to-gray-900">
        {/* AC units */}
        <div className="absolute top-[10%] right-[10%] w-8 h-6 bg-gray-600 rounded" />
        <div className="absolute top-[15%] right-[18%] w-6 h-5 bg-gray-600 rounded" />
      </div>
    </>
  );
}

// Scene component mapping
const SCENE_COMPONENTS: Record<HomepageSceneType, React.FC> = {
  campfire: CampfireScene,
  beach: BeachScene,
  studio: StudioScene,
  forest: ForestScene,
  space: SpaceScene,
  rooftop: RooftopScene,
};

export function SceneRenderer({
  onSceneChange,
  showSceneSelector = true,
  className = '',
}: SceneRendererProps) {
  const [currentScene, setCurrentScene] = useState<HomepageSceneType>('forest');
  const [characters, setCharacters] = useState<HomepageCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Load characters from API
  useEffect(() => {
    async function loadCharacters() {
      try {
        const res = await fetch(`/api/homepage/characters?scene=${currentScene}`);
        if (res.ok) {
          const data = await res.json();
          setCharacters(data);
        }
      } catch (error) {
        console.error('Failed to load characters:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadCharacters();
  }, [currentScene]);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleSceneChange = (scene: HomepageSceneType) => {
    setCurrentScene(scene);
    onSceneChange?.(scene);
  };

  const sceneConfig = SCENE_CONFIGS[currentScene];
  const SceneComponent = SCENE_COMPONENTS[currentScene];

  // Create ground gradient style
  const groundGradient = useMemo(() => {
    const { groundStyle, horizonY } = sceneConfig.ground;
    if (groundStyle.type === 'gradient' && groundStyle.colors) {
      return `linear-gradient(to bottom, ${groundStyle.colors.join(', ')})`;
    }
    return groundStyle.colors?.[0] || '#333';
  }, [sceneConfig]);

  const backdropGradient = useMemo(() => {
    const { backdropStyle } = sceneConfig.ground;
    if (backdropStyle.type === 'gradient' && backdropStyle.colors) {
      return `linear-gradient(to bottom, ${backdropStyle.colors.join(', ')})`;
    }
    return backdropStyle.colors?.[0] || '#000';
  }, [sceneConfig]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      {/* Backdrop/Sky */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: backdropGradient,
          height: `${sceneConfig.ground.horizonY + 10}%`,
        }}
      />

      {/* Ground plane */}
      <div
        className="absolute left-0 right-0 bottom-0 transition-all duration-1000"
        style={{
          background: groundGradient,
          top: `${sceneConfig.ground.horizonY}%`,
        }}
      />

      {/* Scene-specific decorations */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <SceneComponent />
        </motion.div>
      </AnimatePresence>

      {/* Walking Characters */}
      <AnimatePresence>
        {containerSize.width > 0 && characters.map((character) => (
          <WalkingCharacter
            key={character.id}
            character={character}
            groundConfig={sceneConfig.ground}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        ))}
      </AnimatePresence>

      {/* Scene Selector */}
      {showSceneSelector && (
        <div className="absolute top-4 left-4 z-50">
          <SceneSelector
            currentScene={currentScene}
            onSceneChange={handleSceneChange}
          />
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
        </div>
      )}
    </div>
  );
}
