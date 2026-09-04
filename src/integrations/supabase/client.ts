import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://aeyhgdlacoqsabsbrzia.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFleWhnZGxhY29xc2Fic2JyemlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ4MjMsImV4cCI6MjA5MjI4MDgyM30.s9ht6_cvQYmvkSlhhU5re-JbSlsv637cTe72lghRSco";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);