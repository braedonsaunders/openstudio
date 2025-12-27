'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { AuthModal } from './AuthModal';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import { getLevelTitle, xpProgress } from '@/types/user';
import {
  User,
  Settings,
  LogOut,
  Trophy,
  BarChart3,
  Users,
  Crown,
  ChevronDown,
  Shield,
  Flame,
  FolderOpen,
} from 'lucide-react';

export function UserMenu() {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [initTimeout, setInitTimeout] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { user, profile, avatar, signOut, isLoading, isInitialized, initialize } = useAuthStore();

  // Trigger initialization on mount and set timeout fallback
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize();
    }

    // Fallback timeout - if still loading after 5 seconds, show login buttons
    const timeout = setTimeout(() => {
      if (!isInitialized) {
        setInitTimeout(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isInitialized, isLoading, initialize]);

  // Close auth modal when user becomes authenticated
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
    }
  }, [user, showAuthModal]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
    router.push('/');
  };

  const openLogin = () => {
    setAuthTab('login');
    setShowAuthModal(true);
  };

  const openSignup = () => {
    setAuthTab('signup');
    setShowAuthModal(true);
  };

  // Show skeleton until auth state is initialized (with timeout fallback)
  // Also show skeleton when user is logged in but profile is still loading
  if (((isLoading || !isInitialized) && !initTimeout) || (user && !profile)) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
    );
  }

  if (!user || !profile) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={openLogin}>
            Log In
          </Button>
          <Button size="sm" onClick={openSignup}>
            Sign Up
          </Button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authTab}
        />
      </>
    );
  }

  const progress = xpProgress(profile.totalXp);
  const levelTitle = getLevelTitle(profile.level);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <AvatarDisplay avatar={avatar} size="sm" username={profile.username} />
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{profile.displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Level {profile.level}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <AvatarDisplay avatar={avatar} size="md" username={profile.username} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{profile.displayName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
                </div>
                {profile.accountType === 'admin' && (
                  <Shield className="w-5 h-5 text-red-500" />
                )}
                {profile.isVerified && (
                  <Crown className="w-5 h-5 text-yellow-500" />
                )}
              </div>

              {/* Level & XP */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {levelTitle} - Level {profile.level}
                  </span>
                  <span className="text-gray-500">
                    {progress.current.toLocaleString()} / {progress.required.toLocaleString()} XP
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>

              {/* Streak */}
              {profile.currentDailyStreak > 0 && (
                <div className="flex items-center gap-2 mt-3 text-orange-500">
                  <Flame className="w-4 h-4" />
                  <span className="text-sm font-medium">{profile.currentDailyStreak} day streak</span>
                </div>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <MenuItem
                icon={FolderOpen}
                label="My Rooms"
                onClick={() => {
                  router.push('/rooms');
                  setShowDropdown(false);
                }}
              />
              <MenuItem
                icon={User}
                label="Profile"
                onClick={() => {
                  router.push(`/profile/${profile.username}`);
                  setShowDropdown(false);
                }}
              />
              <MenuItem
                icon={BarChart3}
                label="Statistics"
                onClick={() => {
                  router.push('/stats');
                  setShowDropdown(false);
                }}
              />
              <MenuItem
                icon={Trophy}
                label="Achievements"
                onClick={() => {
                  router.push('/achievements');
                  setShowDropdown(false);
                }}
              />
              <MenuItem
                icon={Users}
                label="Friends"
                onClick={() => {
                  router.push('/friends');
                  setShowDropdown(false);
                }}
              />
              <MenuItem
                icon={Settings}
                label="Settings"
                onClick={() => {
                  router.push('/settings');
                  setShowDropdown(false);
                }}
              />

              {profile.accountType === 'admin' && (
                <>
                  <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
                  <MenuItem
                    icon={Shield}
                    label="Admin Panel"
                    onClick={() => {
                      router.push('/admin');
                      setShowDropdown(false);
                    }}
                    className="text-red-500 dark:text-red-400"
                  />
                </>
              )}

              <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
              <MenuItem
                icon={LogOut}
                label="Log Out"
                onClick={handleSignOut}
                className="text-gray-500 dark:text-gray-400"
              />
            </div>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authTab}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
