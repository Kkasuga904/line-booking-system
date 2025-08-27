/**
 * テスト予約作成
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestReservation() {
  console.log('=== テスト予約作成 ===');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];
  
  const testReservation = {
    store_id: '***REMOVED-ROTATE-CREDENTIAL***',
    date: date,
    time: '14:00:00',
    people: 2,
    seat_id: null,
    customer_name: 'テスト太郎',
    email: 'test@example.com',
    phone: '090-1234-5678',
    message: 'テスト予約です',
    status: 'confirmed',
    user_id: 'test_user'
  };
  
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert([testReservation])
      .select();
    
    if (error) {
      console.error('予約作成エラー:', error);
    } else {
      console.log('✅ テスト予約を作成しました:');
      console.log('  - ID:', data[0].id);
      console.log('  - 日付:', data[0].date);
      console.log('  - 時間:', data[0].time);
      console.log('  - 名前:', data[0].customer_name);
      console.log('  - Store:', data[0].store_id);
    }
    
    // 確認
    const { data: check } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', '***REMOVED-ROTATE-CREDENTIAL***')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (check && check.length > 0) {
      console.log('\n確認: ***REMOVED-ROTATE-CREDENTIAL***の最新予約が存在します');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
createTestReservation();