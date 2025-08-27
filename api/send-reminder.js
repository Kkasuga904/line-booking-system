import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../utils/env-helper.js';

// Supabase初期化
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * リマインダー通知送信API
 * GET /api/send-reminder - 自動実行用（cron）
 * POST /api/send-reminder - 手動実行用
 * 
 * 前日の夕方に翌日の予約をリマインド
 */
export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // LINE Channel Access Token
    const accessToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
    if (!accessToken) {
      return res.status(500).json({ error: 'LINE設定エラー' });
    }
    
    // 明日の日付を取得
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // 明日の予約を取得
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('status', 'pending')  // 確定済みの予約のみ
      .order('time', { ascending: true });
    
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'データベースエラー' });
    }
    
    if (!reservations || reservations.length === 0) {
      return res.status(200).json({
        message: '明日の予約はありません',
        date: tomorrowStr
      });
    }
    
    // 送信成功数・失敗数カウント
    let successCount = 0;
    let failCount = 0;
    
    // 各予約にリマインダーを送信
    for (const reservation of reservations) {
      // 時間フォーマット
      const displayTime = reservation.time ? reservation.time.substring(0, 5) : '未定';
      
      // リマインダーメッセージ
      const reminderMessage = {
        to: reservation.user_id,  // LINE userId
        messages: [{
          type: 'text',
          text: `📅 【予約リマインダー】\n\n明日のご予約をお知らせします。\n\n👤 お名前: ${reservation.customer_name || 'ゲスト'}様\n📅 日付: ${reservation.date}（明日）\n⏰ 時間: ${displayTime}\n👥 人数: ${reservation.people}名\n\n予約ID: #${reservation.id}\n\n変更・キャンセルが必要な場合は、お早めにご連絡ください。\n\nご来店を心よりお待ちしております！`
        }]
      };
      
      try {
        // LINE Messaging APIでプッシュメッセージ送信
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(reminderMessage)
        });
        
        if (response.ok) {
          successCount++;
          
          // リマインダー送信済みフラグを更新
          await supabase
            .from('reservations')
            .update({ reminder_sent: true })
            .eq('id', reservation.id);
        } else {
          failCount++;
          const error = await response.text();
          console.error(`Reminder send failed for reservation ${reservation.id}:`, error);
        }
      } catch (error) {
        failCount++;
        console.error(`Reminder send error for reservation ${reservation.id}:`, error);
      }
      
      // API制限対策（1秒間隔）
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 結果を返す
    return res.status(200).json({
      success: true,
      message: 'リマインダー送信完了',
      date: tomorrowStr,
      totalReservations: reservations.length,
      successCount,
      failCount,
      details: reservations.map(r => ({
        id: r.id,
        customerName: r.customer_name,
        time: r.time
      }))
    });
    
  } catch (error) {
    console.error('Send reminder error:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
}

/**
 * Vercel Cronジョブ設定例（vercel.json）:
 * 
 * {
 *   "crons": [{
 *     "path": "/api/send-reminder",
 *     "schedule": "0 18 * * *"  // 毎日18時（JST 3時）
 *   }]
 * }
 * 
 * 注：Vercel無料プランではCronジョブは利用できません。
 * 代替案：
 * 1. 外部Cronサービス（cron-job.org等）を使用
 * 2. GitHub Actionsでスケジュール実行
 * 3. Zapier/IFTTTなどの自動化サービス
 */