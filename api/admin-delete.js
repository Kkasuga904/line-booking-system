/**
 * 管理画面から予約を削除するAPI
 * DELETE /api/admin-delete?id=予約ID
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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // DELETEリクエストのみ受け付け
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // URLパラメータから予約IDを取得
    const url = new URL(req.url, `http://${req.headers.host}`);
    const reservationId = url.searchParams.get('id');
    
    if (!reservationId) {
      return res.status(400).json({ 
        error: '予約IDが指定されていません' 
      });
    }
    
    console.log('Deleting reservation:', reservationId);
    
    // 予約を削除（物理削除）
    const { data, error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId)
      .select();
    
    if (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ 
        error: '削除に失敗しました',
        details: error.message 
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ 
        error: '指定された予約が見つかりません' 
      });
    }
    
    console.log('Successfully deleted reservation:', data[0]);
    
    return res.status(200).json({
      success: true,
      message: '予約を削除しました',
      deleted: data[0]
    });
    
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: err.message
    });
  }
}