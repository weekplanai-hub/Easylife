import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wapprjfgxsrplaotzyim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhcHByamZneHNycGxhb3R6eWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NDUyNzMsImV4cCI6MjA3NjAyMTI3M30.0fV73VsqSziJJY1hUAnV_UgQVHMRGMdIFVbHEwtY-I8';

const existingClient = typeof window !== 'undefined' ? window.supabaseClient : undefined;

export const supabaseClient = existingClient ?? createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (typeof window !== 'undefined' && !existingClient) {
  window.supabaseClient = supabaseClient;
  console.info('Supabase-klient initialisert', { supabaseUrl: SUPABASE_URL });
} else if (typeof window !== 'undefined') {
  console.info('Supabase-klient gjenbrukt', { supabaseUrl: SUPABASE_URL });
}

export default supabaseClient;
