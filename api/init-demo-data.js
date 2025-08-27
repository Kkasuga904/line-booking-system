/**
 * デモデータ初期化API
 * POST /api/init-demo-data
 * 飲食店の席とサンプル予約データを投入
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const storeId = 'restaurant-demo';
    const storeName = 'デモレストラン';
    
    // 既存データをクリア
    await supabase
      .from('reservations')
      .delete()
      .eq('store_id', storeId);
    
    await supabase
      .from('seats')
      .delete()
      .eq('store_id', storeId);
    
    // 席データを追加
    const seats = [
      // カウンター席（8席）
      { store_id: storeId, name: 'カウンター1', seat_type: 'counter', capacity: 1, description: 'カウンター左端・充電可', display_order: 1 },
      { store_id: storeId, name: 'カウンター2', seat_type: 'counter', capacity: 1, description: 'カウンター席', display_order: 2 },
      { store_id: storeId, name: 'カウンター3', seat_type: 'counter', capacity: 1, description: 'カウンター席', display_order: 3 },
      { store_id: storeId, name: 'カウンター4', seat_type: 'counter', capacity: 1, description: 'カウンター中央・充電可', display_order: 4 },
      { store_id: storeId, name: 'カウンター5', seat_type: 'counter', capacity: 1, description: 'カウンター席', display_order: 5 },
      { store_id: storeId, name: 'カウンター6', seat_type: 'counter', capacity: 1, description: 'カウンター席', display_order: 6 },
      { store_id: storeId, name: 'カウンター7', seat_type: 'counter', capacity: 1, description: 'カウンター席', display_order: 7 },
      { store_id: storeId, name: 'カウンター8', seat_type: 'counter', capacity: 1, description: 'カウンター右端・充電可', display_order: 8 },
      
      // 2人用テーブル席（6テーブル）
      { store_id: storeId, name: 'テーブルA1', seat_type: 'table', capacity: 2, description: '窓際・夜景が見える', display_order: 10 },
      { store_id: storeId, name: 'テーブルA2', seat_type: 'table', capacity: 2, description: '窓際・夜景が見える', display_order: 11 },
      { store_id: storeId, name: 'テーブルA3', seat_type: 'table', capacity: 2, description: '窓際・夜景が見える', display_order: 12 },
      { store_id: storeId, name: 'テーブルB1', seat_type: 'table', capacity: 2, description: '中央エリア', display_order: 13 },
      { store_id: storeId, name: 'テーブルB2', seat_type: 'table', capacity: 2, description: '中央エリア', display_order: 14 },
      { store_id: storeId, name: 'テーブルB3', seat_type: 'table', capacity: 2, description: '中央エリア・充電可', display_order: 15 },
      
      // 4人用テーブル席（4テーブル）
      { store_id: storeId, name: 'テーブルC1', seat_type: 'table', capacity: 4, description: '入口付近・ベビーカー可', display_order: 20 },
      { store_id: storeId, name: 'テーブルC2', seat_type: 'table', capacity: 4, description: '中央エリア・円卓', display_order: 21 },
      { store_id: storeId, name: 'テーブルC3', seat_type: 'table', capacity: 4, description: '奥側・静かなエリア', display_order: 22 },
      { store_id: storeId, name: 'テーブルC4', seat_type: 'table', capacity: 4, description: '奥側・静かなエリア', display_order: 23 },
      
      // 6人用テーブル席（2テーブル）
      { store_id: storeId, name: 'テーブルD1', seat_type: 'table', capacity: 6, description: '大型テーブル・団体可', display_order: 30 },
      { store_id: storeId, name: 'テーブルD2', seat_type: 'table', capacity: 6, description: '大型テーブル・団体可', display_order: 31 },
      
      // 個室（2部屋）
      { store_id: storeId, name: '個室1', seat_type: 'room', capacity: 8, description: '完全個室・会議利用可・プロジェクター有', display_order: 40 },
      { store_id: storeId, name: '個室2', seat_type: 'room', capacity: 6, description: '半個室・誕生日会向け・装飾可', display_order: 41 }
    ];
    
    const { data: seatData, error: seatError } = await supabase
      .from('seats')
      .insert(seats)
      .select();
    
    if (seatError) throw seatError;
    
    // 席IDマップを作成
    const seatMap = {};
    seatData.forEach(seat => {
      seatMap[seat.name] = seat.id;
    });
    
    // 今日から3日間の日付を生成
    const today = new Date();
    const dates = [0, 1, 2].map(offset => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return date.toISOString().split('T')[0];
    });
    
    // サンプル予約データ
    const reservations = [
      // 今日の予約
      { date: dates[0], time: '11:30:00', customer_name: '田中様', people: 1, seat_id: seatMap['カウンター1'], message: 'アレルギー：なし', phone: '090-1234-5678' },
      { date: dates[0], time: '12:00:00', customer_name: '佐藤様', people: 2, seat_id: seatMap['テーブルA1'], message: '窓際希望', phone: '090-2345-6789' },
      { date: dates[0], time: '12:00:00', customer_name: '鈴木様', people: 4, seat_id: seatMap['テーブルC1'], message: 'お子様連れ', phone: '090-3456-7890' },
      { date: dates[0], time: '12:30:00', customer_name: '高橋様', people: 2, seat_id: seatMap['テーブルA2'], message: 'ビジネスランチ', phone: '090-4567-8901' },
      { date: dates[0], time: '13:00:00', customer_name: '渡辺様', people: 3, seat_id: seatMap['テーブルC2'], message: null, phone: '090-5678-9012' },
      { date: dates[0], time: '18:00:00', customer_name: '伊藤様', people: 2, seat_id: seatMap['テーブルA3'], message: '記念日ディナー', phone: '090-6789-0123' },
      { date: dates[0], time: '18:30:00', customer_name: '山田様', people: 6, seat_id: seatMap['テーブルD1'], message: '歓送迎会', phone: '090-7890-1234' },
      { date: dates[0], time: '19:00:00', customer_name: '中村様', people: 8, seat_id: seatMap['個室1'], message: '会社の懇親会', phone: '090-8901-2345' },
      { date: dates[0], time: '19:00:00', customer_name: '小林様', people: 2, seat_id: seatMap['テーブルB1'], message: null, phone: '090-9012-3456' },
      { date: dates[0], time: '19:30:00', customer_name: '加藤様', people: 4, seat_id: seatMap['テーブルC3'], message: '誕生日会', phone: '090-0123-4567' },
      { date: dates[0], time: '20:00:00', customer_name: '吉田様', people: 1, seat_id: seatMap['カウンター2'], message: '一人飲み', phone: '090-1234-5678' },
      { date: dates[0], time: '20:00:00', customer_name: '山崎様', people: 2, seat_id: seatMap['テーブルB2'], message: 'デート', phone: '090-2345-6789' },
      
      // 明日の予約
      { date: dates[1], time: '11:30:00', customer_name: '松本様', people: 2, seat_id: seatMap['テーブルA1'], message: null, phone: '090-3456-7890' },
      { date: dates[1], time: '12:00:00', customer_name: '井上様', people: 4, seat_id: seatMap['テーブルC1'], message: 'ランチミーティング', phone: '090-4567-8901' },
      { date: dates[1], time: '12:00:00', customer_name: '木村様', people: 1, seat_id: seatMap['カウンター3'], message: null, phone: '090-5678-9012' },
      { date: dates[1], time: '12:30:00', customer_name: '林様', people: 6, seat_id: seatMap['テーブルD2'], message: '家族での食事', phone: '090-6789-0123' },
      { date: dates[1], time: '13:00:00', customer_name: '清水様', people: 2, seat_id: seatMap['テーブルB3'], message: null, phone: '090-7890-1234' },
      { date: dates[1], time: '18:00:00', customer_name: '森様', people: 6, seat_id: seatMap['個室2'], message: '誕生日パーティー', phone: '090-8901-2345' },
      { date: dates[1], time: '18:30:00', customer_name: '藤井様', people: 2, seat_id: seatMap['テーブルA2'], message: 'プロポーズ予定', phone: '090-9012-3456' },
      { date: dates[1], time: '19:00:00', customer_name: '池田様', people: 4, seat_id: seatMap['テーブルC2'], message: null, phone: '090-0123-4567' },
      { date: dates[1], time: '19:00:00', customer_name: '橋本様', people: 1, seat_id: seatMap['カウンター4'], message: null, phone: '090-1234-5678' },
      { date: dates[1], time: '19:30:00', customer_name: '山口様', people: 2, seat_id: seatMap['テーブルB1'], message: null, phone: '090-2345-6789' },
      { date: dates[1], time: '20:00:00', customer_name: '石川様', people: 3, seat_id: seatMap['テーブルC3'], message: '女子会', phone: '090-3456-7890' },
      { date: dates[1], time: '20:30:00', customer_name: '前田様', people: 2, seat_id: seatMap['テーブルA3'], message: null, phone: '090-4567-8901' },
      
      // 明後日の予約
      { date: dates[2], time: '12:00:00', customer_name: '岡田様', people: 8, seat_id: seatMap['個室1'], message: '接待', phone: '090-5678-9012' },
      { date: dates[2], time: '12:00:00', customer_name: '長谷川様', people: 2, seat_id: seatMap['テーブルA1'], message: null, phone: '090-6789-0123' },
      { date: dates[2], time: '12:30:00', customer_name: '村上様', people: 4, seat_id: seatMap['テーブルC1'], message: 'ママ友ランチ', phone: '090-7890-1234' },
      { date: dates[2], time: '13:00:00', customer_name: '近藤様', people: 1, seat_id: seatMap['カウンター5'], message: null, phone: '090-8901-2345' },
      { date: dates[2], time: '18:00:00', customer_name: '坂本様', people: 6, seat_id: seatMap['テーブルD1'], message: '同窓会', phone: '090-9012-3456' },
      { date: dates[2], time: '18:30:00', customer_name: '遠藤様', people: 2, seat_id: seatMap['テーブルB2'], message: null, phone: '090-0123-4567' },
      { date: dates[2], time: '19:00:00', customer_name: '青木様', people: 4, seat_id: seatMap['テーブルC2'], message: '家族の誕生日', phone: '090-1234-5678' },
      { date: dates[2], time: '19:00:00', customer_name: '斉藤様', people: 2, seat_id: seatMap['テーブルA2'], message: 'デート', phone: '090-2345-6789' },
      { date: dates[2], time: '19:30:00', customer_name: '西村様', people: 6, seat_id: seatMap['個室2'], message: '歓迎会', phone: '090-3456-7890' },
      { date: dates[2], time: '20:00:00', customer_name: '福田様', people: 1, seat_id: seatMap['カウンター6'], message: null, phone: '090-4567-8901' },
      { date: dates[2], time: '20:00:00', customer_name: '太田様', people: 2, seat_id: seatMap['テーブルB3'], message: null, phone: '090-5678-9012' },
      { date: dates[2], time: '20:30:00', customer_name: '藤田様', people: 4, seat_id: seatMap['テーブルC4'], message: '友人との集まり', phone: '090-6789-0123' }
    ];
    
    // 予約データを追加
    const reservationData = reservations.map(r => ({
      store_id: storeId,
      store_name: storeName,
      user_id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...r,
      status: 'confirmed'
    }));
    
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .insert(reservationData);
    
    if (resError) throw resError;
    
    return res.status(200).json({
      success: true,
      message: 'デモデータを初期化しました',
      seats: seatData.length,
      reservations: reservationData.length,
      dates: dates
    });
    
  } catch (error) {
    console.error('Init demo data error:', error);
    return res.status(500).json({
      error: 'デモデータ初期化に失敗しました',
      details: error.message
    });
  }
}