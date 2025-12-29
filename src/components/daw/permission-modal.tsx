'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RoomMember,
  RoomPermissions,
  RoomRole,
  ROLE_INFO,
  ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
  getEffectivePermissions,
  isPermissionOverridden,
} from '@/types/permissions';
import {
  X,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  AlertTriangle,
  Play,
  Music,
  ListMusic,
  Sliders,
  Sparkles,
  Mic,
  Bot,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionModalProps {
  member: RoomMember;
  onClose: () => void;
  onSave: (customPermissions: Partial<RoomPermissions>) => void;
}

const CATEGORY_ICONS: Record<string, typeof Play> = {
  transport: Play,
  tempo: Music,
  tracks: ListMusic,
  mixer: Sliders,
  effects: Sparkles,
  recording: Mic,
  ai: Bot,
  chat: MessageSquare,
  room: Settings,
};

export function PermissionModal({ member, onClose, onSave }: PermissionModalProps) {
  const [selectedRole, setSelectedRole] = useState<RoomRole>(member.role);
  const [customPermissions, setCustomPermissions] = useState<Partial<RoomPermissions>>(
    member.customPermissions || {}
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const rolePermissions = ROLE_PERMISSIONS[selectedRole];
  const effectivePermissions = useMemo(
    () => getEffectivePermissions(selectedRole, customPermissions),
    [selectedRole, customPermissions]
  );

  const hasCustomizations = useMemo(
    () => Object.keys(customPermissions).length > 0,
    [customPermissions]
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const togglePermission = (category: keyof RoomPermissions, permission: string) => {
    const categoryPerms = effectivePermissions[category] as unknown as Record<string, boolean>;
    const rolePerms = rolePermissions[category] as unknown as Record<string, boolean>;
    const currentValue = categoryPerms[permission];
    const roleDefault = rolePerms[permission];
    const newValue = !currentValue;

    setCustomPermissions((prev) => {
      const newCustom = { ...prev };

      // If new value equals role default, remove the override
      if (newValue === roleDefault) {
        if (newCustom[category]) {
          const catPerms = { ...(newCustom[category] as unknown as Record<string, boolean>) };
          delete catPerms[permission];

          if (Object.keys(catPerms).length === 0) {
            delete newCustom[category];
          } else {
            (newCustom as Record<string, unknown>)[category] = catPerms;
          }
        }
      } else {
        // Add/update the override
        if (!newCustom[category]) {
          (newCustom as Record<string, unknown>)[category] = {};
        }
        ((newCustom as Record<string, unknown>)[category] as Record<string, boolean>)[permission] = newValue;
      }

      return newCustom;
    });
  };

  const resetToDefaults = () => {
    setCustomPermissions({});
  };

  const handleSave = () => {
    onSave(customPermissions);
  };

  // Don't render on server
  if (!mounted) return null;

  const countCategoryOverrides = (category: keyof RoomPermissions): number => {
    const categoryCustom = customPermissions[category] as unknown as Record<string, boolean> | undefined;
    if (!categoryCustom) return 0;
    return Object.keys(categoryCustom).length;
  };

  const countCategoryEnabled = (category: keyof RoomPermissions): { enabled: number; total: number } => {
    const perms = effectivePermissions[category] as unknown as Record<string, boolean>;
    const values = Object.values(perms);
    return {
      enabled: values.filter((v) => v).length,
      total: values.length,
    };
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a24] rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {member.userAvatar ? (
                <img
                  src={member.userAvatar}
                  alt={member.userName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                member.userName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
                Customize Permissions
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-500">{member.userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">Base Role</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as RoomRole);
                setCustomPermissions({}); // Reset customizations on role change
              }}
              className="text-sm bg-white dark:bg-[#1a1a24] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-gray-800 dark:text-zinc-200"
            >
              {Object.entries(ROLE_INFO).map(([role, info]) => (
                <option key={role} value={role}>
                  {info.icon} {info.name}
                </option>
              ))}
            </select>
          </div>
          {hasCustomizations && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>Custom permissions applied</span>
            </div>
          )}
        </div>

        {/* Permission Categories */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {(Object.entries(PERMISSION_CATEGORIES) as [keyof RoomPermissions, typeof PERMISSION_CATEGORIES.transport][]).map(
              ([categoryKey, category]) => {
                const Icon = CATEGORY_ICONS[categoryKey] || Settings;
                const isExpanded = expandedCategories.has(categoryKey);
                const overrideCount = countCategoryOverrides(categoryKey);
                const { enabled, total } = countCategoryEnabled(categoryKey);

                return (
                  <div
                    key={categoryKey}
                    className="bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden"
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(categoryKey)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-500" />
                      )}
                      <Icon className="w-4 h-4 text-indigo-500" />
                      <span className="flex-1 text-left text-sm font-medium text-gray-800 dark:text-zinc-200">
                        {category.label}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          enabled === total
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                            : enabled === 0
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-zinc-500'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {enabled}/{total}
                      </span>
                      {overrideCount > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {overrideCount} override{overrideCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>

                    {/* Permission Toggles */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(category.permissions).map(([permKey, permLabel]) => {
                            const isEnabled = (effectivePermissions[categoryKey] as unknown as Record<string, boolean>)[permKey];
                            const isOverridden = isPermissionOverridden(
                              selectedRole,
                              categoryKey,
                              permKey,
                              customPermissions
                            );

                            return (
                              <label
                                key={permKey}
                                className={cn(
                                  'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
                                  isEnabled
                                    ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                    : 'bg-gray-100 dark:bg-white/5',
                                  isOverridden && 'ring-1 ring-amber-500/50'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={() => togglePermission(categoryKey, permKey)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span
                                  className={cn(
                                    'text-xs',
                                    isEnabled
                                      ? 'text-gray-800 dark:text-zinc-200'
                                      : 'text-gray-500 dark:text-zinc-500'
                                  )}
                                >
                                  {permLabel}
                                </span>
                                {isOverridden && (
                                  <AlertTriangle className="w-3 h-3 text-amber-500 ml-auto" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <button
            onClick={resetToDefaults}
            disabled={!hasCustomizations}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              hasCustomizations
                ? 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5'
                : 'text-gray-400 dark:text-zinc-600 cursor-not-allowed'
            )}
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Save className="w-3 h-3" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
