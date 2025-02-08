import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SavedLocation = {
  user_id: string; 
  coordx: number; // X coordinate (latitude)
  coordy: number; // Y coordinate (longitude)
  name: string; // Name of the place
  address: string; // Address of the place
  hours: string; // Operating hours
  attraction_type: string; // Type of attraction
  created_at: string; // Timestamp when the location was saved
};
