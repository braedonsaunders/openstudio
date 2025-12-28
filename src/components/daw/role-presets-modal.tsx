'use client';

import { useState } from 'react';
import {
  RoomRole,
  ROLE_INFO,
  ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
  RoomPermissions,
} from '@/types/permissions';
import {
  X,
  ChevronRight,
  Edit2,
  Check,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RolePresetsModalProps {
  onClose: () => void;
}

export function RolePresetsModal({ onClose }: RolePresetsModalProps) {
  const [selectedRole, setSelectedRole] = useState<RoomRole | null>(null);

  const roles: RoomRole[] = ['owner', 'co-host', 'performer', 'member', 'listener'];

  const countRolePermissions = (role: RoomRole): { enabled: number; total: number } => {
    const permissions = ROLE_PERMISSIONS[role];
    let enabled = 0;
    let total = 0;

    for (const category of Object.values(permissions)) {
      const values = Object.values(category as Record<string, boolean>);
      enabled += values.filter((v) => v).length;
      total += values.length;
    }

    return { enabled, total };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a24] rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">
              Manage Role Presets
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedRole ? (
            // Role List
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-4">
                View and understand the default permissions for each role. These are the built-in
                roles that cannot be deleted.
              </p>

              {roles.map((role) => {
                const info = ROLE_INFO[role];
                const { enabled, total } = countRolePermissions(role);

                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg border border-gray-200 dark:border-white/5 transition-colors text-left"
                  >
                    <span className="text-xl">{info.icon}</span>
                    <div className="flex-1">
                      <div className={cn('text-sm font-medium', info.color)}>
                        {info.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-zinc-500">
                        {info.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                        {enabled}/{total}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-zinc-500">permissions</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-zinc-600" />
                  </button>
                );
              })}
            </div>
          ) : (
            // Role Detail View
            <div>
              <button
                onClick={() => setSelectedRole(null)}
                className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
              >
                <ChevronRight className="w-3 h-3 rotate-180" />
                Back to roles
              </button>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{ROLE_INFO[selectedRole].icon}</span>
                <div>
                  <h3
                    className={cn(
                      'text-lg font-semibold',
                      ROLE_INFO[selectedRole].color
                    )}
                  >
                    {ROLE_INFO[selectedRole].name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    {ROLE_INFO[selectedRole].description}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {(Object.entries(PERMISSION_CATEGORIES) as [keyof RoomPermissions, typeof PERMISSION_CATEGORIES.transport][]).map(
                  ([categoryKey, category]) => {
                    const categoryPerms = ROLE_PERMISSIONS[selectedRole][categoryKey] as Record<
                      string,
                      boolean
                    >;
                    const enabledCount = Object.values(categoryPerms).filter((v) => v).length;
                    const totalCount = Object.values(categoryPerms).length;

                    return (
                      <div
                        key={categoryKey}
                        className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 border border-gray-200 dark:border-white/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                            {category.label}
                          </span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              enabledCount === totalCount
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                : enabledCount === 0
                                ? 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-500'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            )}
                          >
                            {enabledCount}/{totalCount}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(category.permissions).map(([permKey, permLabel]) => {
                            const isEnabled = categoryPerms[permKey];
                            return (
                              <span
                                key={permKey}
                                className={cn(
                                  'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                                  isEnabled
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                                    : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-500 line-through'
                                )}
                              >
                                {isEnabled && <Check className="w-2.5 h-2.5" />}
                                {permLabel}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
