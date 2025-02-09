import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Place = {
  id: number 
  user_id: string
  longitude: number
  latitude: number
  name?: string
  address?: string
  openingHours?: string
  placeType?: string
}

export type Collection = {
  id: string
  name: string
  user_id: string
}

