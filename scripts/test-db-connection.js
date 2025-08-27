/**
 * データベース接続テスト
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('=== データベース接続テスト ===');
  console.log('URL:', SUPABASE_URL);
  
  try {
    // 1. 席データ確認
    console.log('\n1. 席データ確認:');
    const { data: seats, error: seatsError } = await supabase
      .from('seats')
      .select('id, name, is_active, store_id')
      .eq('is_active', true);
    
    if (seatsError) {
      console.error('席データエラー:', seatsError);
    } else {
      console.log(`アクティブな席: ${seats.length}件`);
      
      // store_id別にグループ化
      const storeGroups = {};
      seats.forEach(seat => {
        const storeId = seat.store_id || 'null';
        if (!storeGroups[storeId]) {
          storeGroups[storeId] = 0;
        }
        storeGroups[storeId]++;
      });
      
      Object.keys(storeGroups).forEach(storeId => {
        console.log(`  - Store "${storeId}": ${storeGroups[storeId]}件`);
      });
    }
    
    // 2. 予約データ確認
    console.log('\n2. 予約データ確認:');
    const { data: allReservations, error: allResError } = await supabase
      .from('reservations')
      .select('*')
      .limit(1);
    
    if (allResError) {
      console.error('予約データエラー:', allResError);
    } else {
      console.log(`全予約データ: ${allReservations.length}件`);
      if (allReservations.length > 0) {
        console.log('予約のカラム:', Object.keys(allReservations[0]));
        console.log('サンプル予約:', allReservations[0]);
      }
    }
    
    // default-storeの予約を確認
    console.log('\n3. default-storeの予約:');
    const { data: defaultReservations, error: defaultError } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', 'default-store')
      .limit(5);
    
    if (defaultError) {
      console.error('default-store予約エラー:', defaultError);
    } else {
      console.log(`default-store予約: ${defaultReservations.length}件`);
      if (defaultReservations.length > 0) {
        console.log('最初の予約:', defaultReservations[0]);
      }
    }
    
    // 4. テーブル一覧確認
    console.log('\n4. テーブル一覧:');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');
    
    if (tablesError) {
      // RPCが存在しない場合はスキップ
      console.log('テーブル一覧取得不可（権限なし）');
    } else if (tables) {
      console.log('利用可能なテーブル:', tables);
    }
    
  } catch (error) {
    console.error('接続エラー:', error);
  }
}

// 実行
testConnection();