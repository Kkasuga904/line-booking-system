import { createClient } from '@supabase/supabase-js';

// 直接環境変数を設定（本番では.env.localを使用）
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixAllStoreIds() {
  console.log('=== Store ID修正開始 ===\n');
  
  // すべての予約をdefault-storeに更新
  const { data, error } = await supabase
    .from('reservations')
    .update({ store_id: 'default-store' })
    .neq('store_id', 'default-store');
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('✅ すべての予約のstore_idをdefault-storeに統一しました');
  
  // 結果を確認
  const { count } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 'default-store');
  
  console.log(`\n現在のdefault-store予約数: ${count}件`);
}

// 実行
fixAllStoreIds();