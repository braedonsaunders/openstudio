'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Music, Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabaseAuth.auth.getSession();
        if (error) throw error;

        // Wait for auth store to initialize before redirecting
        // This ensures profile data is loaded
        if (!isInitialized) {
          await initialize();
        }

        // Redirect to rooms after successful auth
        router.push('/rooms');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/?error=auth_failed');
      }
    };

    handleCallback();
  }, [router, isInitialized, initialize]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
          <Music className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}
