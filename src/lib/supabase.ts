import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://anicuoxdkoidkikijfzf.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWN1b3hka29pZGtpa2lqZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwMzg3MzksImV4cCI6MjA1NDYxNDczOX0.fsKJhjE46hnu7q1ZaT0CNoD6jv_QQiYb9zRF-rzwV6E"

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

