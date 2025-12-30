'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile, UserStats, UserInstrument, Achievement, UserAchievement } from '@/types/user';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: SupabaseUser | null;
  profile: UserProfile | null;
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

// Auth initialization is handled by the onAuthStateChange listener in auth-store.ts
// which fires INITIAL_SESSION when Supabase finishes restoring the session from localStorage

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    profile,
    stats,
    instruments,
    achievements,
    unlockedAchievements,
    isLoading,
    isInitialized,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithDiscord,
    signOut,
  } = useAuthStore();

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user && !!profile,
        isLoading,
        isInitialized,
        user,
        profile,
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
