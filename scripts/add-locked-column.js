/**
 * is_lockedカラムを追加するスクリプト
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDI5OCwiZXhwIjoyMDcxNzUwMjk4fQ.kpAZn-Kg16MwudGmn4ufjnfgdJQOK6u2tjNTCNTvGqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function addColumn() {
  console.log('=== is_lockedカラム追加 ===');
  
  try {
    // SQLクエリを実行（Supabase SQL Editor経由では実行できないため、APIで試行）
    // 注意: Supabaseの管理画面から直接実行する必要がある場合があります
    
    console.log(`
以下のSQLをSupabaseの管理画面から実行してください:

ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_seats_is_locked ON seats(is_locked);

COMMENT ON COLUMN seats.is_locked IS '店側で設定する予約停止フラグ。trueの場合予約カレンダーに表示されない';
    `);
    
    console.log('\nSupabase管理画面: https://supabase.com/dashboard/project/faenvzzeguvlconvrqgp/editor');
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
addColumn();