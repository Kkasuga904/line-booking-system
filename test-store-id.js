import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkStoreIds() {
  console.log('\n=== Store ID診断 ===\n');
  
  // 環境変数のSTORE_ID
  console.log('環境変数 STORE_ID:', process.env.STORE_ID || '未設定');
  console.log('デフォルト値: default-store\n');
  
  // すべての予約を取得（store_id別）
  const { data: allReservations, error } = await supabase
    .from('reservations')
    .select('store_id')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  // store_idの分布を確認
  const storeIdCount = {};
  allReservations.forEach(r => {
    const id = r.store_id || 'null';
    storeIdCount[id] = (storeIdCount[id] || 0) + 1;
  });
  
  console.log('最近の予約のstore_id分布:');
  Object.entries(storeIdCount).forEach(([id, count]) => {
    console.log(`  ${id}: ${count}件`);
  });
  
  // default-storeの予約を確認
  const { data: defaultStoreReservations, count } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', 'default-store');
  
  console.log(`\ndefault-storeの予約数: ${count || 0}件`);
  
  // 最新の予約を表示
  const { data: latestReservation } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (latestReservation) {
    console.log('\n最新の予約:');
    console.log('  ID:', latestReservation.id);
    console.log('  store_id:', latestReservation.store_id);
    console.log('  customer_name:', latestReservation.customer_name);
    console.log('  date:', latestReservation.date);
    console.log('  created_at:', latestReservation.created_at);
  }
  
  // 修正提案
  console.log('\n=== 解決策 ===');
  
  if (Object.keys(storeIdCount).length > 1) {
    console.log('⚠️ 複数のstore_idが混在しています');
    console.log('以下のコマンドですべてをdefault-storeに統一できます:');
    console.log('npm run prevent-issues');
  } else if (!storeIdCount['default-store']) {
    console.log('❌ default-storeの予約がありません');
    console.log('store_idの設定を確認してください');
  } else {
    console.log('✅ store_idは正常です');
  }
}

checkStoreIds();