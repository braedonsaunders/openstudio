'use client';

import { useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useRoomPermissions } from '@/hooks/useRoomPermissions';
import { useRoomStore } from '@/stores/room-store';
import {
  RoomRole,
  RoomMember,
  RoomPermissions,
  ROLE_INFO,
} from '@/types/permissions';
import { PermissionModal } from './permission-modal';
import { RolePresetsModal } from './role-presets-modal';
import {
  Shield,
  ChevronDown,
  Settings2,
  UserX,
  Ban,
  Clock,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionsPanelProps {
  roomId: string;
}

export function PermissionsPanel({ roomId }: PermissionsPanelProps) {
  const { canManageRoom, isOwner, assignableRoles } = usePermissions();
  const {
    members,
    defaultRole,
    requireApproval,
    setDefaultRole,
    setRequireApproval,
    updateUserRole,
    updateUserPermissions,
    kickUser,
    banUser,
  } = useRoomPermissions(roomId);
  const { users, currentUser } = useRoomStore();

  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);
  const [showRolePresets, setShowRolePresets] = useState(false);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  // Combine connected users with member data
  const connectedMembers = Array.from(users.values()).map((user) => {
    const memberData = members.find((m: RoomMember) => m.oduserId === user.id);
    return {
      user,
      member: memberData || {
        id: user.id,
        oduserId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        role: (user.isMaster ? 'owner' : defaultRole) as RoomRole,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    };
  });

  const handleRoleChange = useCallback(
    async (userId: string, newRole: RoomRole) => {
      await updateUserRole(userId, newRole);
      setOpenRoleDropdown(null);
    },
    [updateUserRole]
  );

  const handleKickUser = useCallback(
    async (userId: string) => {
      if (!confirm('Are you sure you want to kick this user?')) return;
      await kickUser(userId);
    },
    [kickUser]
  );

  const handleBanUser = useCallback(
    async (userId: string) => {
      const reason = prompt('Enter a reason for the ban (optional):');
      if (reason === null) return; // User cancelled
      await banUser(userId, reason || undefined);
    },
    [banUser]
  );

  const handleSavePermissions = useCallback(
    async (customPermissions: Partial<RoomPermissions>) => {
      if (!selectedMember) return;
      await updateUserPermissions(selectedMember.oduserId, customPermissions);
      setSelectedMember(null);
    },
    [selectedMember, updateUserPermissions]
  );

  if (!canManageRoom) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Shield className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-400">
          You don&apos;t have permission to manage room permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0d0d14]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Room Permissions
          </h2>
          <button
            onClick={() => setShowRolePresets(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
          >
            <Settings2 className="w-3 h-3" />
            Manage Roles
          </button>
        </div>

        {/* Default Settings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-zinc-400">Default role for new users</span>
            <select
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value as RoomRole)}
              className="text-xs bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded px-2 py-1 text-gray-800 dark:text-zinc-200"
            >
              <option value="performer">Performer</option>
              <option value="member">Member</option>
              <option value="listener">Listener</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-600 dark:text-zinc-400">
              Require approval before joining
            </span>
          </label>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-500 px-2 py-1 mb-1">
            Room Members ({connectedMembers.length})
          </div>

          <div className="space-y-1">
            {connectedMembers.map(({ user, member }) => {
              const roleInfo = ROLE_INFO[member.role];
              const isCurrentUser = user.id === currentUser?.id;
              const canModify = !isCurrentUser && (isOwner || member.role !== 'owner');

              return (
                <div
                  key={user.id}
                  className="bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {member.role === 'owner' && (
                        <span className="absolute -top-1 -right-1 text-sm">👑</span>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-zinc-100 truncate">
                          {user.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">(You)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(member.joinedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Role Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          canModify
                            ? setOpenRoleDropdown(
                                openRoleDropdown === user.id ? null : user.id
                              )
                            : undefined
                        }
                        disabled={!canModify}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                          canModify
                            ? 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 cursor-pointer'
                            : 'bg-gray-100 dark:bg-white/5 cursor-default',
                          roleInfo.color
                        )}
                      >
                        <span>{roleInfo.icon}</span>
                        <span>{roleInfo.name}</span>
                        {canModify && <ChevronDown className="w-3 h-3" />}
                      </button>

                      {/* Role Dropdown Menu */}
                      {openRoleDropdown === user.id && canModify && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg z-50 py-1">
                          {assignableRoles.map((role) => {
                            const info = ROLE_INFO[role];
                            return (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(user.id, role)}
                                className={cn(
                                  'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-white/5 text-left',
                                  member.role === role && 'bg-gray-100 dark:bg-white/10'
                                )}
                              >
                                <span>{info.icon}</span>
                                <span className="flex-1 text-gray-800 dark:text-zinc-200">{info.name}</span>
                                {member.role === role && (
                                  <Check className="w-3 h-3 text-indigo-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {canModify && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
                      >
                        <Settings2 className="w-3 h-3" />
                        Customize
                      </button>
                      <button
                        onClick={() => handleKickUser(user.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded transition-colors"
                      >
                        <UserX className="w-3 h-3" />
                        Kick
                      </button>
                      <button
                        onClick={() => handleBanUser(user.id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                      >
                        <Ban className="w-3 h-3" />
                        Ban
                      </button>
                    </div>
                  )}

                  {/* Custom permissions indicator */}
                  {member.customPermissions && Object.keys(member.customPermissions).length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      Has custom permissions
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {connectedMembers.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No members in the room yet
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedMember && (
        <PermissionModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={handleSavePermissions}
        />
      )}

      {showRolePresets && (
        <RolePresetsModal onClose={() => setShowRolePresets(false)} />
      )}
    </div>
  );
}
