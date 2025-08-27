/**
 * 席データ初期化スクリプト
 * 席管理テーブルに初期データを投入
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function initSeats() {
  console.log('=== 席データ初期化開始 ===');
  
  // 初期席データ（美容室想定）
  const initialSeats = [
    {
      store_id: 'default-store',
      name: 'カット席1',
      seat_type: 'chair',
      capacity: 1,
      description: '入口側のカット席',
      display_order: 1,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'カット席2',
      seat_type: 'chair',
      capacity: 1,
      description: '窓側のカット席',
      display_order: 2,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'カット席3',
      seat_type: 'chair',
      capacity: 1,
      description: '奥側のカット席',
      display_order: 3,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'カラー席A',
      seat_type: 'chair',
      capacity: 1,
      description: 'カラー専用席（換気良好）',
      display_order: 4,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'カラー席B',
      seat_type: 'chair',
      capacity: 1,
      description: 'カラー専用席',
      display_order: 5,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'シャンプー台1',
      seat_type: 'chair',
      capacity: 1,
      description: '自動シャンプー台',
      display_order: 6,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'シャンプー台2',
      seat_type: 'chair',
      capacity: 1,
      description: 'リクライニング式',
      display_order: 7,
      is_active: true
    },
    {
      store_id: 'default-store',
      name: 'VIP個室',
      seat_type: 'room',
      capacity: 2,
      description: '完全個室・プライベート空間',
      display_order: 8,
      is_active: true
    }
  ];
  
  try {
    // 既存の席データを確認
    const { data: existingSeats, error: checkError } = await supabase
      .from('seats')
      .select('id')
      .eq('store_id', 'default-store')
      .eq('is_active', true);
    
    if (checkError) {
      console.error('チェックエラー:', checkError);
      return;
    }
    
    if (existingSeats && existingSeats.length > 0) {
      console.log(`既に${existingSeats.length}件の席データが存在します`);
      const confirm = process.argv.includes('--force');
      if (!confirm) {
        console.log('既存データがあるため、スキップします。上書きする場合は --force オプションを使用してください。');
        return;
      }
      console.log('--force オプションが指定されたため、既存データを無効化します');
      
      // 既存データを論理削除
      const { error: deleteError } = await supabase
        .from('seats')
        .update({ is_active: false })
        .eq('store_id', 'default-store');
      
      if (deleteError) {
        console.error('削除エラー:', deleteError);
        return;
      }
    }
    
    // 新しい席データを挿入
    const { data, error } = await supabase
      .from('seats')
      .insert(initialSeats)
      .select();
    
    if (error) {
      console.error('挿入エラー:', error);
      return;
    }
    
    console.log(`✅ ${data.length}件の席データを登録しました`);
    
    // 登録した席の確認
    console.log('\n=== 登録された席 ===');
    data.forEach(seat => {
      console.log(`- ${seat.name} (${seat.seat_type}, 定員: ${seat.capacity}名)`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
initSeats();