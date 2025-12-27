'use client';

import { useEffect, createContext, useContext, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile, Avatar, UserStats, UserInstrument, Achievement, UserAchievement } from '@/types/user';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  avatar: Avatar | null;
  stats: UserStats | null;
  instruments: UserInstrument[];
  achievements: Achievement[];
  unlockedAchievements: UserAchievement[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    profile,
    avatar,
    stats,
    instruments,
    achievements,
    unlockedAchievements,
    isLoading,
    isInitialized,
    initialize,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithDiscord,
    signOut,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user && !!profile,
        isLoading,
        isInitialized,
        user,
        profile,
        avatar,
        stats,
        instruments,
        achievements,
        unlockedAchievements,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithDiscord,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
