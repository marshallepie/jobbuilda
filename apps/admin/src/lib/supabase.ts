import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// DEBUG: Log what we're seeing
console.log('DEBUG - Supabase URL:', supabaseUrl ? 'SET' : 'NOT SET', supabaseUrl?.substring(0, 30));
console.log('DEBUG - Supabase Key:', supabaseAnonKey ? 'SET' : 'NOT SET', supabaseAnonKey?.substring(0, 20));
console.log('DEBUG - Is Configured:', !!(supabaseUrl && supabaseAnonKey));

// Only create Supabase client if credentials are provided
let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
  console.log('DEBUG - Supabase client created successfully');
} else {
  console.warn('Supabase credentials not configured. Development mode will use mock authentication.');
  console.warn('DEBUG - URL length:', supabaseUrl.length, 'Key length:', supabaseAnonKey.length);
}

// Export supabase instance (will be null in development mode without Supabase)
export const supabase = supabaseInstance as SupabaseClient;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => !!(supabaseUrl && supabaseAnonKey);
