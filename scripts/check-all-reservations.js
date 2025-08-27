/**
 * 全予約データを確認
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllReservations() {
  console.log('=== 全予約データ確認 ===\n');
  
  try {
    // 全予約を取得（制限なし）
    const { data: allRes, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('エラー:', error);
      return;
    }
    
    console.log(`総予約数: ${allRes.length}件\n`);
    
    // store_id別に集計
    const storeGroups = {};
    allRes.forEach(res => {
      const storeId = res.store_id || 'null';
      if (!storeGroups[storeId]) {
        storeGroups[storeId] = [];
      }
      storeGroups[storeId].push(res);
    });
    
    console.log('=== Store ID別 ===');
    Object.keys(storeGroups).forEach(storeId => {
      console.log(`\nStore: "${storeId}" - ${storeGroups[storeId].length}件`);
      
      // 最新3件を表示
      storeGroups[storeId].slice(0, 3).forEach(res => {
        console.log(`  - ID:${res.id} | ${res.date} ${res.time} | ${res.customer_name || '名前なし'} | ${res.status}`);
      });
      
      if (storeGroups[storeId].length > 3) {
        console.log(`  ... 他 ${storeGroups[storeId].length - 3}件`);
      }
    });
    
    // default-storeの詳細確認
    console.log('\n=== default-store詳細 ===');
    const defaultStoreRes = storeGroups['default-store'] || [];
    if (defaultStoreRes.length === 0) {
      console.log('default-storeの予約はありません');
      
      // 環境変数値の確認
      console.log('\n環境変数STORE_ID:', process.env.STORE_ID || '未設定');
      console.log('デフォルト値: "default-store"');
    } else {
      console.log(`default-storeの予約: ${defaultStoreRes.length}件`);
      defaultStoreRes.forEach(res => {
        console.log(`\nID: ${res.id}`);
        console.log(`  作成日時: ${res.created_at}`);
        console.log(`  予約日: ${res.date} ${res.time}`);
        console.log(`  名前: ${res.customer_name}`);
        console.log(`  人数: ${res.people}`);
        console.log(`  ステータス: ${res.status}`);
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
checkAllReservations();