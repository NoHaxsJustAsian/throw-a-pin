import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWN1b3hka29pZGtpa2lqZnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwMzg3MzksImV4cCI6MjA1NDYxNDczOX0.fsKJhjE46hnu7q1ZaT0CNoD6jv_QQiYb9zRF-rzwV6E"

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api/searchNearby': {
        target: 'https://anicuoxdkoidkikijfzf.supabase.co/functions/v1/searchNearby',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/searchNearby/, ''),
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        }
      },
      '/api/getPlaceAddress': {
        target: 'https://anicuoxdkoidkikijfzf.supabase.co/functions/v1/getPlaceAddress',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/getPlaceAddress/, ''),
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        }
      },
      '/api/getPlaceDetails': {
        target: 'https://anicuoxdkoidkikijfzf.supabase.co/functions/v1/getPlaceDetails',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/getPlaceDetails/, ''),
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        }
      },
      '/api/isDrivableTo': {
        target: 'https://anicuoxdkoidkikijfzf.supabase.co/functions/v1/isDrivableTo',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/isDrivableTo/, ''),
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        }
      },
    },
  },
})
