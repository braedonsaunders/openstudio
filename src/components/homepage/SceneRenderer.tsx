'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SCENE_CONFIGS } from './scene-config';
import { SceneSelector } from './SceneSelector';
import { WalkingCharacter } from './WalkingCharacter';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { HomepageCharacter, HomepageSceneType } from '@/types/avatar';

// Import scene components from shared world scenes
import {
  SCENE_COMPONENTS,
  SCENE_BACKDROPS,
  SCENE_GROUNDS,
  SCENE_ORDER,
} from '@/components/world/scenes';

interface SceneRendererProps {
  scene?: HomepageSceneType;
  onSceneChange?: (scene: HomepageSceneType) => void;
  showSceneSelector?: boolean;
  className?: string;
}

export function SceneRenderer({
  scene,
  onSceneChange,
  showSceneSelector = true,
  className = '',
}: SceneRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [internalScene, setInternalScene] = useState<HomepageSceneType>('beach');
  const currentScene = scene ?? internalScene;
  const [characters, setCharacters] = useState<HomepageCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Shared position registry for collision avoidance
  const characterPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Callback for characters to update their position
  const updateCharacterPosition = useCallback((id: string, x: number, y: number) => {
    characterPositionsRef.current.set(id, { x, y });
  }, []);

  // Callback to get other characters' positions for collision avoidance
  const getOtherCharacterPositions = useCallback((excludeId: string) => {
    const positions: Array<{ x: number; y: number }> = [];
    characterPositionsRef.current.forEach((pos, id) => {
      if (id !== excludeId) {
        positions.push(pos);
      }
    });
    return positions;
  }, []);

  // Track previous values using refs - updated synchronously
  const prevSceneRef = useRef<HomepageSceneType>(currentScene);
  const prevThemeRef = useRef<boolean>(isDark);

  // Calculate transition info synchronously during render (before refs update)
  const transitionInfo = useMemo(() => {
    const prevScene = prevSceneRef.current;
    const prevTheme = prevThemeRef.current;
    const sceneChanged = prevScene !== currentScene;
    const themeChanged = prevTheme !== isDark;

    if (sceneChanged) {
      const prevIndex = SCENE_ORDER.indexOf(prevScene);
      const currentIndex = SCENE_ORDER.indexOf(currentScene);
      return {
        type: 'scene' as const,
        direction: currentIndex > prevIndex ? 1 : -1,
      };
    } else if (themeChanged) {
      return {
        type: 'theme' as const,
        direction: isDark ? 1 : -1,
      };
    }
    return { type: 'initial' as const, direction: 1 };
  }, [currentScene, isDark]);

  // Update refs AFTER render via useEffect
  useEffect(() => {
    prevSceneRef.current = currentScene;
    prevThemeRef.current = isDark;
  }, [currentScene, isDark]);

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

  const handleSceneChange = (newScene: HomepageSceneType) => {
    setInternalScene(newScene);
    onSceneChange?.(newScene);
  };

  const sceneConfig = SCENE_CONFIGS[currentScene];
  const SceneComponent = SCENE_COMPONENTS[currentScene];
  const backdrop = isDark ? SCENE_BACKDROPS[currentScene].night : SCENE_BACKDROPS[currentScene].day;
  const ground = isDark ? SCENE_GROUNDS[currentScene].night : SCENE_GROUNDS[currentScene].day;

  // Calculate evenly distributed initial positions for characters
  const characterInitialPositions = useMemo(() => {
    if (characters.length === 0) return new Map<string, { x: number; y: number }>();

    const { walkableArea } = sceneConfig.ground;
    const positions = new Map<string, { x: number; y: number }>();
    const placedPositions: Array<{ x: number; y: number }> = [];

    // Minimum distance between characters
    const MIN_SPAWN_DISTANCE = 12;

    // ONLY spawn in bottom 15% of screen - no exceptions
    const SPAWN_MIN_Y = 85;

    // Create spawn points ONLY in bottom 15% of screen
    const spawnPoints: Array<{ x: number; y: number }> = [];
    const spacing = 8;

    for (let x = walkableArea.minX + 5; x <= walkableArea.maxX - 5; x += spacing) {
      for (let y = SPAWN_MIN_Y; y <= walkableArea.maxY - 3; y += spacing) {
        spawnPoints.push({ x, y });
      }
    }

    // Sort to spread characters across the bottom
    spawnPoints.sort((a, b) => {
      // Spread from center outward
      return Math.abs(a.x - 50) - Math.abs(b.x - 50);
    });

    // Assign each character to a spawn point, ensuring minimum distance
    characters.forEach((character, index) => {
      let bestPoint: { x: number; y: number } | null = null;

      // Try to find a point that doesn't overlap with already placed characters
      for (const point of spawnPoints) {
        const isFarEnough = placedPositions.every(placed => {
          const dx = point.x - placed.x;
          const dy = point.y - placed.y;
          return Math.sqrt(dx * dx + dy * dy) >= MIN_SPAWN_DISTANCE;
        });

        if (isFarEnough) {
          bestPoint = point;
          break;
        }
      }

      // Fallback: use bottom corner if no non-overlapping found
      if (!bestPoint) {
        bestPoint = { x: walkableArea.minX + 10 + (index * 15) % 80, y: SPAWN_MIN_Y + 5 };
      }

      positions.set(character.id, { x: bestPoint.x, y: bestPoint.y });
      placedPositions.push({ x: bestPoint.x, y: bestPoint.y });
    });

    return positions;
  }, [characters, sceneConfig.ground]);

  // Dynamic variants based on transition type - computed synchronously
  const sceneVariants = useMemo(() => {
    const { type, direction } = transitionInfo;

    if (type === 'initial') {
      return {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1, x: 0, y: 0 },
        exit: { opacity: 0, scale: 0.95 },
      };
    }
    if (type === 'scene') {
      // Horizontal slide - scenes are laid out left to right
      return {
        initial: { opacity: 0, x: `${direction * 100}%` },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: `${-direction * 100}%` },
      };
    }
    // Vertical slide for theme changes
    // Night: slides down from top, Day: slides up from bottom
    return {
      initial: { opacity: 0, y: isDark ? '-60%' : '60%' },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: isDark ? '60%' : '-60%' },
    };
  }, [transitionInfo, isDark]);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Backdrop/Sky - crossfade with color shift */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`backdrop-${currentScene}-${isDark}`}
          className="absolute inset-0"
          style={{ background: backdrop }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Ground plane - slides with content */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`ground-${currentScene}-${isDark}`}
          className="absolute left-0 right-0 bottom-0"
          style={{ background: ground, top: `${sceneConfig.ground.horizonY}%` }}
          initial={{
            opacity: 0,
            x: transitionInfo.type === 'scene' ? `${transitionInfo.direction * 30}%` : 0,
            y: transitionInfo.type === 'theme' ? (isDark ? '-20%' : '20%') : 0,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{
            opacity: 0,
            x: transitionInfo.type === 'scene' ? `${-transitionInfo.direction * 30}%` : 0,
            y: transitionInfo.type === 'theme' ? (isDark ? '20%' : '-20%') : 0,
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        />
      </AnimatePresence>

      {/* Scene decorations - main animated content */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${currentScene}-${isDark}`}
          variants={sceneVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1],
            opacity: { duration: 0.25 },
          }}
          className="absolute inset-0"
        >
          <SceneComponent isDark={isDark} />
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
            initialPosition={characterInitialPositions.get(character.id)}
            onPositionUpdate={updateCharacterPosition}
            getOtherPositions={getOtherCharacterPositions}
          />
        ))}
      </AnimatePresence>

      {/* Scene Selector */}
      {showSceneSelector && (
        <div className="absolute bottom-20 left-4 z-50">
          <SceneSelector currentScene={currentScene} onSceneChange={handleSceneChange} />
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
