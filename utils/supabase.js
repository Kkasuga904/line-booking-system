import { createClient } from '@supabase/supabase-js';

let supabaseAdmin = null;

export function getSupabase() {
  if (supabaseAdmin) return supabaseAdmin;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // ★必ずサービスロール
  
  if (!url || !key) {
    console.error('[SB:init] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });
  return supabaseAdmin;
}