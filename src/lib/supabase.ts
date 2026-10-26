import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dsscjedqbnlgujuoelyk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzc2NqZWRxYm5sZ3VqdW9lbHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MzQ2ODUsImV4cCI6MjEwODExMDY4NX0.1kRdTSf3T3ccetZDgufepoxoetw2nIA9Uja8iDX-Scs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
