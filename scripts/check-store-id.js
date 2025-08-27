/**
 * store_idの状況を確認
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStoreId() {
  console.log('=== store_id確認 ===');
  
  try {
    // すべてのstore_idを確認
    const { data: allSeats, error } = await supabase
      .from('seats')
      .select('store_id, name, is_active, is_locked')
      .eq('is_active', true);
    
    if (error) {
      console.error('エラー:', error);
      return;
    }
    
    // store_idでグループ化
    const storeGroups = {};
    allSeats.forEach(seat => {
      const storeId = seat.store_id || 'null';
      if (!storeGroups[storeId]) {
        storeGroups[storeId] = [];
      }
      storeGroups[storeId].push(seat);
    });
    
    console.log('\n=== Store ID別の席数 ===');
    Object.keys(storeGroups).forEach(storeId => {
      console.log(`Store ID: "${storeId}" - ${storeGroups[storeId].length}席`);
      storeGroups[storeId].forEach(seat => {
        console.log(`  - ${seat.name} (is_locked: ${seat.is_locked})`);
      });
    });
    
    // APIが期待しているstore_idを確認
    console.log('\n=== APIが使用するstore_id ===');
    console.log('process.env.STORE_ID:', process.env.STORE_ID || '未設定');
    console.log('デフォルト値: "***REMOVED-ROTATE-CREDENTIAL***"');
    
    // Vercelで設定されている環境変数の値と一致するか確認
    const apiStoreId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    const matchingSeats = allSeats.filter(s => s.store_id === apiStoreId);
    console.log(`\nAPIのstore_id "${apiStoreId}" に一致する席: ${matchingSeats.length}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
checkStoreId();