import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://anicuoxdkoidkikijfzf.supabase.co"
const supabaseAnonKey = "9a12a123619a44409a643c5f03ed57be"

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

