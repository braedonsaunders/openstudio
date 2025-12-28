import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  RoomPermissions,
  RoomRole,
  RoomMember,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
} from '@/types/permissions';

interface PermissionsState {
  // Current user's effective permissions
  myPermissions: RoomPermissions | null;
  myRole: RoomRole | null;
  myMemberId: string | null;

  // All room members with their roles/permissions
  members: RoomMember[];

  // Room default settings
  defaultRole: RoomRole;
  requireApproval: boolean;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  setMyPermissions: (role: RoomRole, customPermissions?: Partial<RoomPermissions>) => void;
  setMembers: (members: RoomMember[]) => void;
  addMember: (member: RoomMember) => void;
  removeMember: (userId: string) => void;
  updateMemberRole: (userId: string, role: RoomRole) => void;
  updateMemberPermissions: (userId: string, customPermissions: Partial<RoomPermissions>) => void;
  clearMemberCustomPermissions: (userId: string) => void;
  setDefaultRole: (role: RoomRole) => void;
  setRequireApproval: (require: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Permission check helpers
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  getMemberPermissions: (userId: string) => RoomPermissions | null;
}

const initialState = {
  myPermissions: null,
  myRole: null,
  myMemberId: null,
  members: [],
  defaultRole: 'member' as RoomRole,
  requireApproval: false,
  isLoading: false,
  error: null,
};

export const usePermissionsStore = create<PermissionsState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setMyPermissions: (role, customPermissions) => {
      const effectivePermissions = getEffectivePermissions(role, customPermissions);
      set({
        myRole: role,
        myPermissions: effectivePermissions,
      });
    },

    setMembers: (members) => set({ members }),

    addMember: (member) =>
      set((state) => {
        // Don't add duplicates
        if (state.members.some((m) => m.oduserId === member.oduserId)) {
          return state;
        }
        return { members: [...state.members, member] };
      }),

    removeMember: (oduserId) =>
      set((state) => ({
        members: state.members.filter((m) => m.oduserId !== oduserId),
      })),

    updateMemberRole: (oduserId, role) =>
      set((state) => ({
        members: state.members.map((m) =>
          m.oduserId === oduserId ? { ...m, role } : m
        ),
      })),

    updateMemberPermissions: (oduserId, customPermissions) =>
      set((state) => ({
        members: state.members.map((m) =>
          m.oduserId === oduserId
            ? {
                ...m,
                customPermissions: {
                  ...m.customPermissions,
                  ...customPermissions,
                },
              }
            : m
        ),
      })),

    clearMemberCustomPermissions: (oduserId) =>
      set((state) => ({
        members: state.members.map((m) =>
          m.oduserId === oduserId ? { ...m, customPermissions: undefined } : m
        ),
      })),

    setDefaultRole: (defaultRole) => set({ defaultRole }),
    setRequireApproval: (requireApproval) => set({ requireApproval }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),

    reset: () => set(initialState),

    // Permission check helpers
    can: (permission: string) => {
      const { myPermissions } = get();
      if (!myPermissions) return false;

      const [category, action] = permission.split('.') as [
        keyof RoomPermissions,
        string
      ];
      if (!category || !action) return false;

      const categoryPerms = myPermissions[category] as unknown as Record<string, boolean> | undefined;
      return categoryPerms?.[action] ?? false;
    },

    canAny: (permissions: string[]) => {
      const { can } = get();
      return permissions.some((p) => can(p));
    },

    canAll: (permissions: string[]) => {
      const { can } = get();
      return permissions.every((p) => can(p));
    },

    getMemberPermissions: (oduserId: string) => {
      const { members } = get();
      const member = members.find((m) => m.oduserId === oduserId);
      if (!member) return null;
      return getEffectivePermissions(member.role, member.customPermissions);
    },
  }))
);

// Selector hooks for common permission checks
export const useCanTransport = () =>
  usePermissionsStore((state) =>
    state.canAny([
      'transport.play',
      'transport.pause',
      'transport.seek',
      'transport.skipTrack',
    ])
  );

export const useCanManageRoom = () =>
  usePermissionsStore((state) =>
    state.canAny(['room.manageUsers', 'room.manageRoles'])
  );

export const useCanRecord = () =>
  usePermissionsStore((state) => state.can('recording.record'));

export const useCanChat = () =>
  usePermissionsStore((state) => state.can('chat.sendMessages'));

export const useIsOwner = () =>
  usePermissionsStore((state) => state.myRole === 'owner');

export const useIsModerator = () =>
  usePermissionsStore((state) =>
    state.myRole === 'owner' || state.myRole === 'co-host'
  );
