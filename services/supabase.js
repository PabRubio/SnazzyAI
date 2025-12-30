// =====================================================
// Supabase Client Configuration
// =====================================================

import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://lwyuwkcbcgfhhtbfyieo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eXV3a2NiY2dmaGh0YmZ5aWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDE3NjEsImV4cCI6MjA3MzI3Nzc2MX0.ZI_w1nYG6DI_HZKL7gEhaARFQD8pJjJP6gkGhq5v0Go'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
