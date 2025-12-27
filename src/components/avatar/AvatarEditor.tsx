'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AvatarDisplay } from './AvatarDisplay';
import type { Avatar } from '@/types/user';
import { Check, ChevronLeft, ChevronRight, Palette, Shirt, Sparkles } from 'lucide-react';

const SKIN_TONES = [
  '#f5d0c5', '#e8beac', '#d4a574', '#c68642', '#8d5524', '#5c3317',
];

const HAIR_COLORS = [
  '#090806', '#2c222b', '#4a3728', '#6b4423', '#8b4513', '#a0522d',
  '#cd853f', '#deb887', '#f4a460', '#e5c100', '#ff6347', '#9370db',
  '#20b2aa', '#4169e1', '#ff69b4',
];

const HAIR_STYLES = [
  { id: 'short', name: 'Short' },
  { id: 'medium', name: 'Medium' },
  { id: 'long', name: 'Long' },
  { id: 'curly', name: 'Curly' },
  { id: 'wavy', name: 'Wavy' },
  { id: 'buzz', name: 'Buzz Cut' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'bun', name: 'Bun' },
  { id: 'afro', name: 'Afro' },
];

const OUTFIT_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#1e3a5f', '#1a1a2e', '#374151', '#f5f5f5',
];

const OUTFIT_TYPES = [
  { id: 'tshirt', name: 'T-Shirt' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'leather', name: 'Leather Jacket' },
  { id: 'suit', name: 'Suit' },
  { id: 'band_tee', name: 'Band Tee' },
  { id: 'stage', name: 'Stage Outfit' },
];

const BACKGROUND_PRESETS = [
  { type: 'gradient', colors: ['#6366f1', '#8b5cf6'], name: 'Purple' },
  { type: 'gradient', colors: ['#3b82f6', '#06b6d4'], name: 'Ocean' },
  { type: 'gradient', colors: ['#f97316', '#ef4444'], name: 'Fire' },
  { type: 'gradient', colors: ['#22c55e', '#14b8a6'], name: 'Forest' },
  { type: 'gradient', colors: ['#ec4899', '#8b5cf6'], name: 'Sunset' },
  { type: 'solid', colors: ['#1a1a2e'], name: 'Dark' },
  { type: 'solid', colors: ['#374151'], name: 'Gray' },
  { type: 'gradient', colors: ['#fbbf24', '#f97316'], name: 'Gold' },
];

const EXPRESSIONS = [
  { id: 'neutral', name: 'Neutral', emoji: '😐' },
  { id: 'happy', name: 'Happy', emoji: '😊' },
  { id: 'focused', name: 'Focused', emoji: '😤' },
  { id: 'excited', name: 'Excited', emoji: '😃' },
  { id: 'chill', name: 'Chill', emoji: '😌' },
];

type EditorTab = 'skin' | 'hair' | 'outfit' | 'background' | 'expression';

interface AvatarEditorProps {
  onSave?: () => void;
  onCancel?: () => void;
}

export function AvatarEditor({ onSave, onCancel }: AvatarEditorProps) {
  const { avatar: currentAvatar, updateAvatar, profile } = useAuthStore();

  const [avatar, setAvatar] = useState<Avatar>(currentAvatar || {
    baseStyle: 'human',
    skinTone: '#f5d0c5',
    head: {
      shape: 'oval',
      hair: { style: 'short', color: '#4a3728' },
      eyes: { style: 'default', color: '#634e34' },
      eyebrows: 'default',
      nose: 'default',
      mouth: 'default',
      accessories: [],
    },
    body: {
      type: 'average',
      outfit: { top: 'tshirt', topColor: '#3b82f6', bottom: 'jeans', bottomColor: '#1e3a5f' },
    },
    expression: 'neutral',
    effects: {},
    background: { type: 'gradient', colors: ['#6366f1', '#8b5cf6'] },
  });

  const [activeTab, setActiveTab] = useState<EditorTab>('skin');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateAvatar(avatar);
      onSave?.();
    } catch (error) {
      console.error('Failed to save avatar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSkinTone = (tone: string) => {
    setAvatar({ ...avatar, skinTone: tone });
  };

  const updateHairStyle = (style: string) => {
    setAvatar({
      ...avatar,
      head: { ...avatar.head, hair: { ...avatar.head.hair, style } },
    });
  };

  const updateHairColor = (color: string) => {
    setAvatar({
      ...avatar,
      head: { ...avatar.head, hair: { ...avatar.head.hair, color } },
    });
  };

  const updateOutfitTop = (top: string) => {
    setAvatar({
      ...avatar,
      body: { ...avatar.body, outfit: { ...avatar.body.outfit, top } },
    });
  };

  const updateOutfitColor = (color: string) => {
    setAvatar({
      ...avatar,
      body: { ...avatar.body, outfit: { ...avatar.body.outfit, topColor: color } },
    });
  };

  const updateBackground = (bg: { type: string; colors: string[] }) => {
    setAvatar({
      ...avatar,
      background: { type: bg.type as 'solid' | 'gradient', colors: bg.colors },
    });
  };

  const updateExpression = (expression: Avatar['expression']) => {
    setAvatar({ ...avatar, expression });
  };

  const tabs: { id: EditorTab; icon: React.ReactNode; label: string }[] = [
    { id: 'skin', icon: <div className="w-4 h-4 rounded-full bg-amber-200" />, label: 'Skin' },
    { id: 'hair', icon: <Sparkles className="w-4 h-4" />, label: 'Hair' },
    { id: 'outfit', icon: <Shirt className="w-4 h-4" />, label: 'Outfit' },
    { id: 'background', icon: <Palette className="w-4 h-4" />, label: 'Background' },
    { id: 'expression', icon: <span>😊</span>, label: 'Expression' },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Preview */}
      <div className="flex flex-col items-center">
        <div className="bg-gray-800 rounded-2xl p-8 mb-4">
          <AvatarDisplay avatar={avatar} size="xl" username={profile?.username} showFrame showEffects />
        </div>
        <p className="text-gray-400 text-sm">Preview</p>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <Card className="p-6">
          {activeTab === 'skin' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Skin Tone</h3>
              <div className="flex flex-wrap gap-3">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => updateSkinTone(tone)}
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      avatar.skinTone === tone
                        ? 'border-white scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: tone }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'hair' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Hair Style</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HAIR_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => updateHairStyle(style.id)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        avatar.head.hair.style === style.id
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Hair Color</h3>
                <div className="flex flex-wrap gap-3">
                  {HAIR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateHairColor(color)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        avatar.head.hair.color === color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'outfit' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Outfit Style</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OUTFIT_TYPES.map((outfit) => (
                    <button
                      key={outfit.id}
                      onClick={() => updateOutfitTop(outfit.id)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        avatar.body.outfit.top === outfit.id
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {outfit.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Outfit Color</h3>
                <div className="flex flex-wrap gap-3">
                  {OUTFIT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateOutfitColor(color)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        avatar.body.outfit.topColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'background' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Background</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BACKGROUND_PRESETS.map((bg, idx) => {
                  const isSelected =
                    avatar.background.type === bg.type &&
                    avatar.background.colors[0] === bg.colors[0];
                  return (
                    <button
                      key={idx}
                      onClick={() => updateBackground(bg)}
                      className={`h-20 rounded-xl border-2 transition-all relative overflow-hidden ${
                        isSelected ? 'border-white' : 'border-transparent hover:border-gray-600'
                      }`}
                      style={{
                        background:
                          bg.type === 'gradient'
                            ? `linear-gradient(135deg, ${bg.colors[0]} 0%, ${bg.colors[1]} 100%)`
                            : bg.colors[0],
                      }}
                    >
                      <span className="absolute bottom-2 left-2 text-xs text-white font-medium drop-shadow-lg">
                        {bg.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'expression' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Expression</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {EXPRESSIONS.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => updateExpression(exp.id as Avatar['expression'])}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${
                      avatar.expression === exp.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-3xl">{exp.emoji}</span>
                    <span className="text-xs">{exp.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} loading={isSaving}>
            <Check className="w-4 h-4 mr-2" />
            Save Avatar
          </Button>
        </div>
      </div>
    </div>
  );
}
