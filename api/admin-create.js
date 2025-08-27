/**
 * 管理画面から予約を手動追加するAPI
 * POST /api/admin-create
 */

import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

// Supabase初期化
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
  
  // POSTリクエストのみ受け付け
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      customer_name,
      date,
      time,
      people,
      message,
      phone,
      email,
      seat_id
    } = req.body;
    
    // 必須項目チェック
    if (!customer_name || !date || !time || !people) {
      return res.status(400).json({ 
        error: '必須項目が不足しています',
        required: ['customer_name', 'date', 'time', 'people']
      });
    }
    
    // 人数チェック（1-20名）
    const peopleNum = parseInt(people);
    if (peopleNum < 1 || peopleNum > 20) {
      return res.status(400).json({ 
        error: '人数は1〜20名の範囲で指定してください' 
      });
    }
    
    // 日付チェック（過去日付は不可）
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ 
        error: '過去の日付は指定できません' 
      });
    }
    
    // store_idを環境変数から取得
    const storeId = getEnv('STORE_ID', 'default-store');
    const storeName = getEnv('STORE_NAME', 'レストラン');
    
    // 予約データ作成
    const reservationData = {
      store_id: storeId,
      store_name: decodeURIComponent(storeName),
      user_id: 'admin-manual', // 管理画面から手動追加
      customer_name: customer_name,
      date: date,
      time: time + ':00', // HH:MM を HH:MM:SS形式に
      people: peopleNum,
      message: message || null,
      phone: phone || null,
      email: email || null,
      seat_id: seat_id || null, // 席ID（オプション）
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    console.log('Creating reservation:', reservationData);
    
    // Supabaseに保存
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select();
    
    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ 
        error: '予約の作成に失敗しました',
        details: error.message 
      });
    }
    
    console.log('Successfully created reservation:', data[0]);
    
    return res.status(200).json({
      success: true,
      message: '予約を作成しました',
      reservation: data[0]
    });
    
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: err.message
    });
  }
}