/**
 * 席の空き状況チェックAPI
 * POST /api/check-seat-availability
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
    const { date, time, people, exclude_reservation_id } = req.body;
    
    if (!date || !time) {
      return res.status(400).json({ 
        error: '日付と時間は必須です' 
      });
    }
    
    const requiredPeople = people || 2;
    
    // 指定時間帯の既存予約を取得
    let query = supabase
      .from('reservations')
      .select('seat_id, people')
      .eq('date', date)
      .eq('time', time)
      .neq('status', 'cancelled');
    
    // 編集時は自分自身を除外
    if (exclude_reservation_id) {
      query = query.neq('id', exclude_reservation_id);
    }
    
    const { data: existingReservations, error: resError } = await query;
    
    if (resError) throw resError;
    
    // 使用中の席IDリスト
    const occupiedSeatIds = existingReservations
      .filter(r => r.seat_id)
      .map(r => r.seat_id);
    
    // 利用可能な席を取得（is_lockedカラムが存在しない場合も考慮）
    let seatsQuery = supabase
      .from('seats')
      .select('*')
      .eq('is_active', true)
      // .eq('is_locked', false)  // TODO: is_lockedカラムが追加されたら有効化
      .gte('capacity', requiredPeople)
      .order('capacity')
      .order('display_order');
    
    // 使用中の席を除外
    if (occupiedSeatIds.length > 0) {
      seatsQuery = seatsQuery.not('id', 'in', `(${occupiedSeatIds.join(',')})`);
    }
    
    const { data: availableSeats, error: seatError } = await seatsQuery;
    
    if (seatError) throw seatError;
    
    // 最適な席を推奨（人数に最も近い席）
    let recommendedSeat = null;
    if (availableSeats && availableSeats.length > 0) {
      recommendedSeat = availableSeats.reduce((best, seat) => {
        const bestDiff = Math.abs(best.capacity - requiredPeople);
        const seatDiff = Math.abs(seat.capacity - requiredPeople);
        return seatDiff < bestDiff ? seat : best;
      }, availableSeats[0]);
    }
    
    return res.status(200).json({
      success: true,
      available: availableSeats.length > 0,
      availableSeats: availableSeats || [],
      recommendedSeat,
      occupiedSeats: occupiedSeatIds.length
    });
    
  } catch (error) {
    console.error('Check availability error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}