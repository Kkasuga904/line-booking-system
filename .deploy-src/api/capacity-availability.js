// 予約制限を考慮した時間枠可用性API
// LocalStorageの予約制限設定とSupabaseの予約データを統合して判定

import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// 環境変数取得
const getEnv = (key, defaultValue = '') => process.env[key] || defaultValue;

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { date, store_id } = req.query;
    const storeId = store_id || getEnv('STORE_ID', 'default-store');
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    console.log(`Checking capacity availability for date: ${date}, store: ${storeId}`);
    
    // その日の予約を取得
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .neq('status', 'cancelled');
    
    if (resError) {
      console.error('Reservation fetch error:', resError);
      throw resError;
    }
    
    // 時間枠ごとの予約状況を集計
    const timeSlotReservations = {};
    const timeSlots = [
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
      '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ];
    
    // 各時間枠の予約数と人数を集計
    timeSlots.forEach(time => {
      timeSlotReservations[time] = {
        count: 0,
        people: 0,
        reservations: []
      };
    });
    
    reservations?.forEach(reservation => {
      const time = reservation.time?.substring(0, 5); // HH:MM形式に変換
      if (timeSlotReservations[time]) {
        timeSlotReservations[time].count++;
        timeSlotReservations[time].people += reservation.people || 1;
        timeSlotReservations[time].reservations.push({
          id: reservation.id,
          customer_name: reservation.customer_name,
          people: reservation.people || 1
        });
      }
    });
    
    // 予約制限設定を取得（本来はクライアントのLocalStorageから送信される）
    // ここではreq.bodyまたはreq.query.rulesから取得
    const capacityRules = req.query.rules ? JSON.parse(req.query.rules) : [];
    
    // デフォルトの制限値
    const defaultMaxGroups = 20;
    const defaultMaxPeople = 50;
    
    // 各時間枠の状態を判定
    const availability = {};
    
    timeSlots.forEach(time => {
      const slot = timeSlotReservations[time];
      
      // この時間に適用される予約制限を探す
      const applicableRule = capacityRules.find(rule => {
        if (rule.date !== date) return false;
        
        const ruleStart = rule.startTime;
        const ruleEnd = rule.endTime;
        
        // 時間が範囲内かチェック
        return time >= ruleStart && time <= ruleEnd;
      });
      
      const maxGroups = applicableRule?.maxGroups || defaultMaxGroups;
      const maxPeople = applicableRule?.maxPeople || defaultMaxPeople;
      
      // 使用率を計算
      const groupUsage = (slot.count / maxGroups) * 100;
      const peopleUsage = (slot.people / maxPeople) * 100;
      const usage = Math.max(groupUsage, peopleUsage);
      
      // 状態を判定
      let status = 'available';
      let selectable = true;
      let color = '#4caf50'; // 緑
      
      if (usage >= 100) {
        status = 'full';
        selectable = false;
        color = '#f44336'; // 赤
      } else if (usage >= 80) {
        status = 'limited';
        selectable = true;
        color = '#ff9800'; // オレンジ
      } else if (usage >= 50) {
        status = 'moderate';
        selectable = true;
        color = '#ffc107'; // 黄色
      }
      
      availability[time] = {
        status,
        selectable,
        color,
        currentGroups: slot.count,
        currentPeople: slot.people,
        maxGroups,
        maxPeople,
        remainingGroups: Math.max(0, maxGroups - slot.count),
        remainingPeople: Math.max(0, maxPeople - slot.people),
        remainingCapacity: Math.min(
          maxGroups - slot.count,
          Math.floor((maxPeople - slot.people) / 2) // 平均2名と仮定
        ),
        usage: Math.round(usage),
        message: status === 'full' ? '満席' :
                status === 'limited' ? `残${Math.min(maxGroups - slot.count, 3)}組` :
                '空席あり'
      };
    });
    
    // レスポンスを返す
    res.json({
      success: true,
      date,
      availability,
      summary: {
        totalReservations: reservations?.length || 0,
        totalPeople: reservations?.reduce((sum, r) => sum + (r.people || 1), 0) || 0,
        capacityRules: capacityRules.length,
        timeSlots: Object.keys(availability).length
      }
    });
    
  } catch (error) {
    console.error('Capacity availability error:', error);
    res.status(500).json({ 
      error: 'Failed to check availability',
      details: error.message 
    });
  }
}