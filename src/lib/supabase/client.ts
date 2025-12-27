import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100, // High frequency for real-time sync
    },
  },
});

export const getRealtimeChannel = (roomId: string) => {
  return supabase.channel(`room:${roomId}`, {
    config: {
      broadcast: {
        self: false,
        ack: true,
      },
      presence: {
        key: roomId,
      },
    },
  });
};

export type RealtimeChannel = ReturnType<typeof getRealtimeChannel>;
