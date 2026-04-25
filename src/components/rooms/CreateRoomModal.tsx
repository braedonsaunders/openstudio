'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Globe,
  Lock,
  Users,
  Sparkles,
  Tag,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  Radio,
  Wand2,
  Layers,
  ListChecks,
  Plus,
  Palette,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useStatsTracker } from '@/hooks/useStatsTracker';
import { createRoom, ROOM_GENRES, MAX_USER_OPTIONS } from '@/lib/rooms/service';
import type { RoomRules, RoomColor, RoomIcon } from '@/types';
import { ROOM_COLORS, ROOM_ICONS } from '@/types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_RULES: RoomRules = {
  allowBackingTracks: true,
  allowAIGeneration: true,
  allowStemSeparation: true,
  allowRecording: true,
  requireMicCheck: false,
  customRules: [],
};

export function CreateRoomModal({ isOpen, onClose }: CreateRoomModalProps) {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { trackRoomCreated } = useStatsTracker();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxUsers, setMaxUsers] = useState(6);
  const [genre, setGenre] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [rules, setRules] = useState<RoomRules>(DEFAULT_RULES);
  const [customRuleInput, setCustomRuleInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [roomColor, setRoomColor] = useState<RoomColor>('indigo');
  const [roomIcon, setRoomIcon] = useState<RoomIcon>('music');

  // Pre-populate name with user's display name
  const defaultName = profile ? `${profile.displayName}'s Jam` : 'New Jam Session';

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim()) && tags.length < 5) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddCustomRule = () => {
    if (customRuleInput.trim() && rules.customRules && rules.customRules.length < 10) {
      setRules({
        ...rules,
        customRules: [...(rules.customRules || []), customRuleInput.trim()],
      });
      setCustomRuleInput('');
    }
  };

  const handleRemoveCustomRule = (index: number) => {
    setRules({
      ...rules,
      customRules: rules.customRules?.filter((_, i) => i !== index),
    });
  };

  const toggleRule = (key: keyof Omit<RoomRules, 'customRules'>) => {
    setRules({ ...rules, [key]: !rules[key] });
  };

  const handleCreate = async () => {
    if (!user) {
      setError('You must be logged in to create a room');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const room = await createRoom(
        {
          name: name.trim() || defaultName,
          description: description.trim() || undefined,
          isPublic,
          maxUsers,
          genre: genre || undefined,
          tags: tags.length > 0 ? tags : undefined,
          rules,
          color: roomColor,
          icon: roomIcon,
        },
        user.id
      );

      // Track room creation for stats
      trackRoomCreated(room.id);

      onClose();
      router.push(`/room/${room.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag();
      } else if (customRuleInput.trim()) {
        handleAddCustomRule();
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setMaxUsers(6);
    setGenre('');
    setTags([]);
    setTagInput('');
    setRules(DEFAULT_RULES);
    setCustomRuleInput('');
    setShowAdvanced(false);
    setError('');
    setRoomColor('indigo');
    setRoomIcon('music');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Room"
      description="Set up your jam session"
      className="max-w-xl"
    >
      <div className="space-y-6">
        {/* Room name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Room Name
          </label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="pl-10"
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this session about? Share the vibe, skill level, or what you're working on..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Room Appearance */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            <Palette className="inline-block w-4 h-4 mr-1" />
            Room Appearance
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Color Selection */}
            <div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setRoomColor(color.value)}
                    className={`w-7 h-7 rounded-lg ${color.bg} transition-all ${
                      roomColor === color.value
                        ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-indigo-500 scale-110'
                        : 'hover:scale-105'
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Icon Selection */}
            <div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_ICONS.slice(0, 15).map((icon) => (
                  <button
                    key={icon.value}
                    onClick={() => setRoomIcon(icon.value)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${
                      roomIcon === icon.value
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500 scale-110'
                        : 'bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 hover:scale-105'
                    }`}
                    title={icon.label}
                  >
                    {icon.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-gray-400">Preview:</span>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${ROOM_COLORS.find(c => c.value === roomColor)?.gradient || 'from-indigo-500 to-indigo-600'}`}>
              <span className="text-white text-sm">{ROOM_ICONS.find(i => i.value === roomIcon)?.icon || '🎵'}</span>
              <span className="text-white text-sm font-medium truncate max-w-[150px]">
                {name.trim() || defaultName}
              </span>
            </div>
          </div>
        </div>

        {/* Visibility toggle */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            Visibility
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsPublic(true)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                isPublic
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                isPublic ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500'
              }`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className={`font-medium ${
                  isPublic ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-gray-300'
                }`}>
                  Public
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">Anyone can join</p>
              </div>
            </button>

            <button
              onClick={() => setIsPublic(false)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                !isPublic
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                !isPublic ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500'
              }`}>
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className={`font-medium ${
                  !isPublic ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-gray-300'
                }`}>
                  Private
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">Invite only</p>
              </div>
            </button>
          </div>
        </div>

        {/* Max users and Genre row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Max users */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              <Users className="inline-block w-4 h-4 mr-1" />
              Max Musicians
            </label>
            <select
              value={maxUsers}
              onChange={(e) => setMaxUsers(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {MAX_USER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              <Sparkles className="inline-block w-4 h-4 mr-1" />
              Genre
            </label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Any genre</option>
              {ROOM_GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            <Tag className="inline-block w-4 h-4 mr-1" />
            Tags <span className="text-slate-400 font-normal">(optional, max 5)</span>
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={tags.length >= 5}
              />
              <Button
                variant="secondary"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 5}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Advanced options toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-gray-800/50 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-gray-300">
            <ListChecks className="w-4 h-4" />
            Room Rules & Settings
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {/* Advanced options */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Feature toggles */}
              <div className="grid grid-cols-2 gap-3">
                <RuleToggle
                  icon={Radio}
                  label="Backing Tracks"
                  description="Allow uploading tracks"
                  enabled={rules.allowBackingTracks}
                  onChange={() => toggleRule('allowBackingTracks')}
                />
                <RuleToggle
                  icon={Wand2}
                  label="AI Generation"
                  description="Allow AI music creation"
                  enabled={rules.allowAIGeneration}
                  onChange={() => toggleRule('allowAIGeneration')}
                />
                <RuleToggle
                  icon={Layers}
                  label="Stem Separation"
                  description="Allow stem isolation"
                  enabled={rules.allowStemSeparation}
                  onChange={() => toggleRule('allowStemSeparation')}
                />
                <RuleToggle
                  icon={Mic}
                  label="Mic Check"
                  description="Require audio test"
                  enabled={rules.requireMicCheck}
                  onChange={() => toggleRule('requireMicCheck')}
                />
              </div>

              {/* Custom rules */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Custom Rules <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={customRuleInput}
                      onChange={(e) => setCustomRuleInput(e.target.value)}
                      placeholder="Add a custom rule..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomRule();
                        }
                      }}
                      disabled={(rules.customRules?.length || 0) >= 10}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAddCustomRule}
                      disabled={!customRuleInput.trim() || (rules.customRules?.length || 0) >= 10}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {rules.customRules && rules.customRules.length > 0 && (
                    <div className="space-y-2">
                      {rules.customRules.map((rule, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-gray-800 text-sm"
                        >
                          <span className="flex-1 text-slate-700 dark:text-gray-300">{rule}</span>
                          <button
                            onClick={() => handleRemoveCustomRule(index)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            <X className="w-3 h-3 text-slate-500" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={isCreating} className="flex-1">
            Create Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Rule toggle component
function RuleToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
        enabled
          ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600'
      }`}
    >
      <div className={`p-1.5 rounded-lg ${
        enabled
          ? 'bg-indigo-500 text-white'
          : 'bg-slate-100 dark:bg-gray-800 text-slate-400'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${
          enabled ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-gray-300'
        }`}>
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
          {description}
        </p>
      </div>
      <div className={`w-8 h-5 rounded-full transition-colors ${
        enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-gray-600'
      }`}>
        <motion.div
          className="w-4 h-4 rounded-full bg-white shadow-sm m-0.5"
          animate={{ x: enabled ? 12 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </div>
    </button>
  );
}
