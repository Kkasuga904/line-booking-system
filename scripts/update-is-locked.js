/**
 * 既存の席データにis_locked=falseを設定
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateIsLocked() {
  console.log('=== is_locked値の更新開始 ===');
  
  try {
    // まず現在の席データを確認
    const { data: seats, error: fetchError } = await supabase
      .from('seats')
      .select('id, name, is_locked')
      .eq('store_id', 'default-store')
      .eq('is_active', true);
    
    if (fetchError) {
      console.error('取得エラー:', fetchError);
      return;
    }
    
    console.log(`${seats.length}件の席データを確認`);
    
    // is_lockedがnullの席を更新
    const nullSeats = seats.filter(s => s.is_locked === null || s.is_locked === undefined);
    console.log(`${nullSeats.length}件の席でis_lockedがnull`);
    
    if (nullSeats.length > 0) {
      const { data, error } = await supabase
        .from('seats')
        .update({ is_locked: false })
        .eq('store_id', 'default-store')
        .is('is_locked', null)
        .select();
      
      if (error) {
        console.error('更新エラー:', error);
        return;
      }
      
      console.log(`✅ ${data?.length || 0}件の席のis_lockedをfalseに更新しました`);
    }
    
    // 更新後の状態を確認
    const { data: updatedSeats, error: checkError } = await supabase
      .from('seats')
      .select('id, name, is_locked')
      .eq('store_id', 'default-store')
      .eq('is_active', true);
    
    if (!checkError && updatedSeats) {
      console.log('\n=== 更新後の席状態 ===');
      updatedSeats.forEach(seat => {
        console.log(`- ${seat.name}: is_locked = ${seat.is_locked}`);
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
updateIsLocked();