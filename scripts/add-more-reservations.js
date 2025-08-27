/**
 * 複数のテスト予約を追加
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addReservations() {
  console.log('=== 複数の予約を追加 ===\n');
  
  const today = new Date();
  const reservations = [
    {
      store_id: 'default-store',
      date: today.toISOString().split('T')[0], // 今日
      time: '10:00:00',
      people: 1,
      customer_name: '山田花子',
      email: 'yamada@example.com',
      phone: '090-1111-2222',
      message: 'カット希望',
      status: 'confirmed',
      user_id: 'test_user'
    },
    {
      store_id: 'default-store',
      date: today.toISOString().split('T')[0], // 今日
      time: '15:00:00',
      people: 2,
      customer_name: '鈴木一郎',
      email: 'suzuki@example.com',
      phone: '090-3333-4444',
      message: 'カラーとカット',
      status: 'pending',
      user_id: 'test_user'
    },
    {
      store_id: 'default-store',
      date: new Date(today.getTime() + 86400000).toISOString().split('T')[0], // 明日
      time: '11:00:00',
      people: 1,
      customer_name: '佐藤次郎',
      email: 'sato@example.com',
      phone: '090-5555-6666',
      message: 'パーマ',
      status: 'confirmed',
      user_id: 'test_user'
    }
  ];
  
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert(reservations)
      .select();
    
    if (error) {
      console.error('エラー:', error);
      return;
    }
    
    console.log(`✅ ${data.length}件の予約を作成しました:\n`);
    data.forEach(res => {
      console.log(`  - ID:${res.id} | ${res.date} ${res.time} | ${res.customer_name} | ${res.status}`);
    });
    
    // 統計確認
    const { data: stats } = await supabase
      .from('reservations')
      .select('status')
      .eq('store_id', 'default-store');
    
    const pending = stats.filter(s => s.status === 'pending').length;
    const confirmed = stats.filter(s => s.status === 'confirmed').length;
    
    console.log(`\n=== default-store統計 ===`);
    console.log(`合計: ${stats.length}件`);
    console.log(`未確定: ${pending}件`);
    console.log(`確定済み: ${confirmed}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
addReservations();