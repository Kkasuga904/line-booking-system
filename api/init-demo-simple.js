/**
 * シンプルなデモデータ初期化API
 * POST /api/init-demo-simple
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
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
    
    // シンプルな席データ
    const seats = [
      { store_id: storeId, name: 'テーブル1', seat_type: 'table', capacity: 4 },
      { store_id: storeId, name: 'テーブル2', seat_type: 'table', capacity: 2 },
      { store_id: storeId, name: 'カウンター1', seat_type: 'counter', capacity: 1 },
    ];
    
    const { data: seatData, error: seatError } = await supabase
      .from('seats')
      .insert(seats)
      .select();
    
    if (seatError) {
      return res.status(500).json({ 
        error: '席データ作成エラー', 
        details: seatError.message 
      });
    }
    
    // シンプルな予約データ
    const today = new Date().toISOString().split('T')[0];
    const reservations = [
      {
        store_id: storeId,
        user_id: 'demo-user-1',
        customer_name: '山田様',
        date: today,
        time: '18:00:00',
        people: 2,
        seat_id: seatData[0].id,
        status: 'confirmed',
        message: 'デモ予約'
      }
    ];
    
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .insert(reservations)
      .select();
    
    if (resError) {
      return res.status(500).json({ 
        error: '予約データ作成エラー', 
        details: resError.message 
      });
    }
    
    return res.status(200).json({
      success: true,
      seats: seatData.length,
      reservations: resData.length
    });
    
  } catch (error) {
    return res.status(500).json({
      error: 'サーバーエラー',
      details: error.message
    });
  }
}