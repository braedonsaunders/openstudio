'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { supabaseAuth, getAdminStats, getAllUsers, searchUsers, banUser, unbanUser, setUserAdmin, logAdminAction } from '@/lib/supabase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import type { UserProfile } from '@/types/user';
import {
  ArrowLeft,
  Users,
  Home,
  Clock,
  BarChart3,
  Search,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Crown,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

type Tab = 'dashboard' | 'users' | 'rooms' | 'reports' | 'analytics';

export default function AdminPage() {
  const router = useRouter();
  const { profile, user, isLoading, isInitialized, isProfileLoading, profileError, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { resolvedTheme, toggleTheme } = useTheme();

  // Redirect non-admins once profile is loaded
  useEffect(() => {
    if (isInitialized && !isProfileLoading && profile && profile.accountType !== 'admin') {
      router.push('/');
    }
  }, [profile, isInitialized, isProfileLoading, router]);

  // Redirect to home if not logged in
  useEffect(() => {
    if (isInitialized && !isLoading && !user) {
      router.push('/');
    }
  }, [user, isInitialized, isLoading, router]);

  // Show loading only during actual loading
  if (isLoading || !isInitialized || isProfileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  // Show error state if profile failed to load
  if (user && !profile && profileError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load profile</p>
          <button
            onClick={() => refreshProfile()}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Not an admin (or no profile)
  if (!profile || profile.accountType !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Access denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-500" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Logged in as</span>
              <span className="text-gray-900 dark:text-white font-medium">{profile.username}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-4rem)] p-4 bg-white dark:bg-transparent">
          <div className="space-y-2">
            <NavItem
              icon={BarChart3}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
            <NavItem
              icon={Users}
              label="Users"
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
            />
            <NavItem
              icon={Home}
              label="Rooms"
              active={activeTab === 'rooms'}
              onClick={() => setActiveTab('rooms')}
            />
            <NavItem
              icon={AlertTriangle}
              label="Reports"
              active={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
            />
            <NavItem
              icon={Activity}
              label="Analytics"
              active={activeTab === 'analytics'}
              onClick={() => setActiveTab('analytics')}
            />
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && <DashboardTab adminId={user!.id} />}
          {activeTab === 'users' && <UsersTab adminId={user!.id} />}
          {activeTab === 'rooms' && <RoomsTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-red-500/20 text-red-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function DashboardTab({ adminId }: { adminId: string }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    totalRooms: 0,
    totalJamHours: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
    </div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          color="indigo"
        />
        <StatCard
          icon={Activity}
          label="Active Today"
          value={stats.activeToday.toLocaleString()}
          color="green"
        />
        <StatCard
          icon={Home}
          label="Total Rooms"
          value={stats.totalRooms.toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={Clock}
          label="Total Jam Hours"
          value={stats.totalJamHours.toLocaleString()}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <Card className="p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Stats
          </Button>
          <Button variant="outline" size="sm">
            Export Users CSV
          </Button>
          <Button variant="outline" size="sm">
            System Health Check
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'indigo' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-500/20 text-indigo-500',
    green: 'bg-green-500/20 text-green-500',
    purple: 'bg-purple-500/20 text-purple-500',
    orange: 'bg-orange-500/20 text-orange-500',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function UsersTab({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');

  const pageSize = 20;

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      if (search) {
        const results = await searchUsers(search, 50);
        setUsers(results);
        setTotalUsers(results.length);
      } else {
        const { users: data, total } = await getAllUsers(pageSize, page * pageSize);
        setUsers(data);
        setTotalUsers(total);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleBanUser = async () => {
    if (!selectedUser) return;
    try {
      await banUser(selectedUser.id, banReason);
      await logAdminAction(adminId, 'ban_user', 'user', selectedUser.id, { reason: banReason });
      setShowBanModal(false);
      setBanReason('');
      loadUsers();
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await unbanUser(userId);
      await logAdminAction(adminId, 'unban_user', 'user', userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      await setUserAdmin(userId, !isCurrentlyAdmin);
      await logAdminAction(adminId, isCurrentlyAdmin ? 'remove_admin' : 'grant_admin', 'user', userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to toggle admin:', error);
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users ({totalUsers})</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={loadUsers}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <AvatarDisplay avatar={null} size="sm" username={user.username} />
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">{user.displayName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-indigo-600 dark:text-indigo-400">Level {user.level}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      user.accountType === 'admin'
                        ? 'bg-red-500/20 text-red-500'
                        : user.accountType === 'pro'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-gray-500/20 text-gray-500 dark:text-gray-400'
                    }`}>
                      {user.accountType === 'admin' && <Shield className="w-3 h-3" />}
                      {user.accountType === 'pro' && <Crown className="w-3 h-3" />}
                      {user.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {user.isBanned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-500">
                        <Ban className="w-3 h-3" />
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/profile/${user.username}`, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {user.isBanned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnbanUser(user.id)}
                          className="text-green-500 hover:text-green-400"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowBanModal(true);
                          }}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAdmin(user.id, user.accountType === 'admin')}
                        className={user.accountType === 'admin' ? 'text-red-500' : 'text-yellow-500'}
                      >
                        {user.accountType === 'admin' ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!search && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalUsers)} of {totalUsers}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Ban Modal */}
      <Modal isOpen={showBanModal} onClose={() => setShowBanModal(false)} title="Ban User">
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to ban <span className="text-gray-900 dark:text-white font-medium">@{selectedUser?.username}</span>?
          </p>
          <Input
            label="Ban Reason"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Enter reason for ban..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowBanModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBanUser}
              disabled={!banReason.trim()}
              className="bg-red-500 hover:bg-red-600"
            >
              <Ban className="w-4 h-4 mr-2" />
              Ban User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState<Array<{
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
    isPublic: boolean;
    maxUsers: number;
    description?: string;
    genre?: string;
    activeUsers?: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await fetch(`/api/rooms?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    setDeleteInProgress(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/rooms?id=${selectedRoom}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setRooms(rooms.filter(r => r.id !== selectedRoom));
        setShowDeleteModal(false);
        setSelectedRoom(null);
      } else {
        const errorMessage = data.error || 'Failed to delete room';
        setDeleteError(errorMessage);
        console.error('Failed to delete room:', errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
      setDeleteError(errorMessage);
      console.error('Failed to delete room:', error);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleDeleteAllStaleRooms = async () => {
    if (!confirm('Are you sure you want to delete all stale rooms (rooms without description older than 2 hours)?')) {
      return;
    }
    setIsLoading(true);
    try {
      // The GET endpoint already cleans up stale rooms, so just reload
      await loadRooms();
    } finally {
      setIsLoading(false);
    }
  };

  const roomToDelete = rooms.find(r => r.id === selectedRoom);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rooms ({rooms.length})</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={loadRooms}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAllStaleRooms}
            className="text-red-500 hover:text-red-400 hover:border-red-500"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clean Stale Rooms
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No rooms found</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Genre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">{room.name}</p>
                        {room.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {room.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                        {room.id}
                      </code>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        room.isPublic
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {room.isPublic ? 'Public' : 'Private'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm capitalize">
                      {room.genre || '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">
                      {room.activeUsers || 0}/{room.maxUsers}
                    </td>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(room.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/room/${room.id}`, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRoom(room.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteError(null); }} title="Delete Room">
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete room{' '}
            <span className="text-gray-900 dark:text-white font-medium">
              {roomToDelete?.name || selectedRoom}
            </span>?
          </p>
          <p className="text-sm text-red-500">
            This will permanently delete the room and all associated tracks. This action cannot be undone.
          </p>
          {deleteError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-500">{deleteError}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRoom}
              disabled={deleteInProgress}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteInProgress ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {deleteError ? 'Retry Delete' : 'Delete Room'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ReportsTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Reports</h2>
      <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No pending reports</p>
      </Card>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Analytics</h2>
      <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Analytics dashboard coming soon</p>
      </Card>
    </div>
  );
}
