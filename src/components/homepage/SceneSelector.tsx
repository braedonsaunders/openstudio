'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { SCENE_CONFIGS } from './scene-config';
import type { HomepageSceneType } from '@/types/avatar';

interface SceneSelectorProps {
  currentScene: HomepageSceneType;
  onSceneChange: (scene: HomepageSceneType) => void;
}

const SCENE_ICONS: Record<HomepageSceneType, string> = {
  campfire: '🔥',
  rooftop: '🏙️',
  beach: '🏖️',
  studio: '🎙️',
  space: '🚀',
  forest: '🌲',
};

export function SceneSelector({ currentScene, onSceneChange }: SceneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = SCENE_CONFIGS[currentScene];

  return (
    <div ref={dropdownRef} className="relative z-50">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-colors"
      >
        <span className="text-lg">{SCENE_ICONS[currentScene]}</span>
        <span className="text-sm font-medium">{currentConfig.name}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-48 rounded-xl bg-gray-900/95 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden"
          >
            {Object.values(SCENE_CONFIGS).map((config) => (
              <button
                key={config.id}
                onClick={() => {
                  onSceneChange(config.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  config.id === currentScene
                    ? 'bg-white/10 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-lg">{SCENE_ICONS[config.id]}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{config.name}</div>
                  <div className="text-xs text-gray-500">{config.description}</div>
                </div>
                {config.id === currentScene && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
