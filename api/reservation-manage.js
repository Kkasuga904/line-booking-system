/**
 * 統合予約管理API
 * キャンセル、変更機能を統合
 * POST /api/reservation-manage
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { action, reservationId, userId, ...params } = req.body;
    
    // アクション検証
    if (!action || !['cancel', 'modify'].includes(action)) {
      return res.status(400).json({
        error: '有効なアクションを指定してください（cancel/modify）'
      });
    }
    
    // パラメータ検証
    if (!reservationId || !userId) {
      return res.status(400).json({
        error: '予約IDとユーザーIDが必要です'
      });
    }
    
    // 予約情報を取得
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !reservation) {
      return res.status(404).json({
        error: '予約が見つかりません'
      });
    }
    
    // キャンセル済みチェック
    if (reservation.status === 'cancelled') {
      return res.status(400).json({
        error: action === 'cancel' ? 
          'この予約はすでにキャンセルされています' : 
          'キャンセル済みの予約は変更できません'
      });
    }
    
    // アクション別処理
    if (action === 'cancel') {
      return handleCancel(reservation, res);
    } else if (action === 'modify') {
      return handleModify(reservation, params, res);
    }
    
  } catch (error) {
    console.error('Reservation manage error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました'
    });
  }
}

// キャンセル処理
async function handleCancel(reservation, res) {
  // 当日キャンセル不可チェック
  const allowSameDayCancel = getEnv('ALLOW_SAME_DAY_CANCEL', 'false') === 'true';
  if (!allowSameDayCancel) {
    const today = new Date().toISOString().split('T')[0];
    if (reservation.date <= today) {
      return res.status(400).json({
        error: '当日以降の予約はキャンセルできません。お電話にてご連絡ください。'
      });
    }
  }
  
  // ステータスをキャンセルに更新
  const { data: updatedReservation, error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: '顧客によるキャンセル'
    })
    .eq('id', reservation.id)
    .select()
    .single();
  
  if (updateError) {
    console.error('Cancel error:', updateError);
    return res.status(500).json({
      error: 'キャンセル処理中にエラーが発生しました'
    });
  }
  
  return res.status(200).json({
    success: true,
    action: 'cancel',
    message: '予約をキャンセルしました',
    reservation: updatedReservation
  });
}

// 変更処理
async function handleModify(reservation, params, res) {
  const { date, time, people, seat_id } = params;
  
  // 変更内容があるかチェック
  if (!date && !time && !people && seat_id === undefined) {
    return res.status(400).json({
      error: '変更する項目を指定してください'
    });
  }
  
  const updateData = {
    modified_at: new Date().toISOString()
  };
  
  // 日付変更の処理
  if (date) {
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({
        error: '過去の日付には変更できません'
      });
    }
    
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxDateStr = maxDate.toISOString().split('T')[0];
    
    if (date > maxDateStr) {
      return res.status(400).json({
        error: '予約は30日先までとなっております'
      });
    }
    
    updateData.date = date;
  }
  
  // 時間変更の処理
  if (time) {
    const hour = parseInt(time.split(':')[0]);
    const openHour = parseInt(getEnv('OPEN_HOUR', '11'));
    const closeHour = parseInt(getEnv('CLOSE_HOUR', '22'));
    
    if (hour < openHour || hour >= closeHour) {
      return res.status(400).json({
        error: `営業時間外です。営業時間: ${openHour}:00〜${closeHour}:00`
      });
    }
    
    updateData.time = time;
  }
  
  // 人数変更の処理
  if (people) {
    if (people < 1 || people > 20) {
      return res.status(400).json({
        error: '人数は1〜20名の範囲で指定してください'
      });
    }
    
    updateData.people = people;
  }
  
  // 席変更の処理
  if (seat_id !== undefined) {
    // 席の空き状況チェック（seat_idがnullでない場合）
    if (seat_id) {
      const checkDate = date || reservation.date;
      const checkTime = time || reservation.time;
      
      // 同時刻の予約確認
      const { data: conflicts, error: conflictError } = await supabase
        .from('reservations')
        .select('id')
        .eq('date', checkDate)
        .eq('time', checkTime)
        .eq('seat_id', seat_id)
        .neq('status', 'cancelled')
        .neq('id', reservation.id);
      
      if (conflictError) {
        console.error('Conflict check error:', conflictError);
        return res.status(500).json({
          error: '席の空き状況確認中にエラーが発生しました'
        });
      }
      
      if (conflicts && conflicts.length > 0) {
        return res.status(400).json({
          error: 'その席は既に予約されています'
        });
      }
    }
    
    updateData.seat_id = seat_id;
  }
  
  // 予約情報を更新
  const { data: updatedReservation, error: updateError } = await supabase
    .from('reservations')
    .update(updateData)
    .eq('id', reservation.id)
    .select()
    .single();
  
  if (updateError) {
    console.error('Modification error:', updateError);
    return res.status(500).json({
      error: '変更処理中にエラーが発生しました'
    });
  }
  
  return res.status(200).json({
    success: true,
    action: 'modify',
    message: '予約を変更しました',
    reservation: updatedReservation
  });
}