import { createClient } from '@supabase/supabase-js';

// 直接環境変数を設定（本番では.env.localを使用）
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixAllStoreIds() {
  console.log('=== Store ID修正開始 ===\n');
  
  // すべての予約を***REMOVED-ROTATE-CREDENTIAL***に更新
  const { data, error } = await supabase
    .from('reservations')
    .update({ store_id: '***REMOVED-ROTATE-CREDENTIAL***' })
    .neq('store_id', '***REMOVED-ROTATE-CREDENTIAL***');
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('✅ すべての予約のstore_idを***REMOVED-ROTATE-CREDENTIAL***に統一しました');
  
  // 結果を確認
  const { count } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', '***REMOVED-ROTATE-CREDENTIAL***');
  
  console.log(`\n現在の***REMOVED-ROTATE-CREDENTIAL***予約数: ${count}件`);
}

// 実行
fixAllStoreIds();