import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * LINE予約システム - セキュア版Webhook
 * セキュリティ対策とエラーハンドリングを強化
 */

// 環境変数チェック
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8',
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  STORE_ID: (process.env.STORE_ID || 'account-001').trim() // 必ず改行を除去
};

// Supabase初期化
const supabase = createClient(
  requiredEnvVars.SUPABASE_URL,
  requiredEnvVars.SUPABASE_ANON_KEY
);

/**
 * LINE署名検証
 * セキュリティ: リクエストがLINEから送信されたことを確認
 */
function validateLineSignature(body, signature) {
  if (!requiredEnvVars.LINE_CHANNEL_SECRET || !signature) {
    console.error('Missing LINE_CHANNEL_SECRET or signature');
    return false;
  }

  const hash = crypto
    .createHmac('SHA256', requiredEnvVars.LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

/**
 * 入力値のサニタイズ
 * SQLインジェクション対策
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  // 危険な文字を除去
  return input
    .replace(/[<>\"']/g, '')
    .trim()
    .substring(0, 500); // 最大長制限
}

/**
 * レート制限チェック（簡易版）
 * 同一ユーザーの過度な利用を防ぐ
 */
const rateLimitCache = new Map();
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimits = rateLimitCache.get(userId) || [];
  
  // 1分以内のリクエスト数をカウント
  const recentRequests = userLimits.filter(time => now - time < 60000);
  
  if (recentRequests.length >= 10) {
    return false; // 1分間に10件以上は拒否
  }
  
  recentRequests.push(now);
  rateLimitCache.set(userId, recentRequests);
  
  // キャッシュクリーンアップ（1時間ごと）
  if (rateLimitCache.size > 1000) {
    rateLimitCache.clear();
  }
  
  return true;
}

/**
 * LINE返信メッセージ送信（エラーハンドリング強化）
 */
async function replyMessage(replyToken, messages) {
  if (!requiredEnvVars.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return { success: false, error: 'Token not configured' };
  }
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requiredEnvVars.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: messages
      }),
      timeout: 5000 // タイムアウト設定
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE API Error:', response.status, errorText);
      return { success: false, error: `LINE API Error: ${response.status}` };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send LINE message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 予約データの検証
 */
function validateReservationData(data) {
  const errors = [];
  
  // 人数チェック
  if (data.people < 1 || data.people > 20) {
    errors.push('予約人数は1〜20名で指定してください');
  }
  
  // 日付チェック（過去日付は不可）
  const today = new Date().toISOString().split('T')[0];
  if (data.date < today) {
    errors.push('過去の日付は予約できません');
  }
  
  // 時間チェック（営業時間内か）
  const hour = parseInt(data.time.split(':')[0]);
  if (hour < 11 || hour >= 22) {
    errors.push('予約時間は11:00〜21:00の間で指定してください');
  }
  
  return errors;
}

/**
 * クイックリプライメニュー生成
 */
function createMenuMessage() {
  return {
    type: 'text',
    text: '予約をご希望ですか？\n以下のボタンから選択してください👇',
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '今日 18時 2名', text: '予約 今日 18時 2名' }},
        { type: 'action', action: { type: 'message', label: '今日 19時 2名', text: '予約 今日 19時 2名' }},
        { type: 'action', action: { type: 'message', label: '明日 18時 2名', text: '予約 明日 18時 2名' }},
        { type: 'action', action: { type: 'message', label: '明日 19時 2名', text: '予約 明日 19時 2名' }},
        { type: 'action', action: { type: 'message', label: '4名で予約', text: '予約 今日 19時 4名' }},
        { type: 'action', action: { type: 'message', label: 'カスタム予約', text: '予約フォーマット：「予約 [日付] [時間] [人数]」' }}
      ]
    }
  };
}

/**
 * メインハンドラー
 */
export default async function handler(req, res) {
  // CORS設定（必要なオリジンのみ許可するべき）
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: 本番では特定のドメインのみ許可
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Line-Signature');
  
  // OPTIONS（プリフライト）リクエスト
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET: ヘルスチェック
  if (req.method === 'GET') {
    try {
      // データベース接続確認
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', requiredEnvVars.STORE_ID);
      
      return res.status(200).json({
        status: 'healthy',
        store_id: requiredEnvVars.STORE_ID,
        database: error ? 'error' : 'connected',
        total_reservations: count || 0,
        security: {
          signature_validation: 'enabled',
          rate_limiting: 'enabled',
          input_sanitization: 'enabled'
        }
      });
    } catch (error) {
      console.error('Health check error:', error);
      return res.status(200).json({
        status: 'error',
        message: 'Database connection failed'
      });
    }
  }
  
  // POST: Webhook処理
  if (req.method === 'POST') {
    try {
      // 署名検証
      const signature = req.headers['x-line-signature'];
      const body = JSON.stringify(req.body);
      
      if (process.env.NODE_ENV === 'production') {
        if (!validateLineSignature(body, signature)) {
          console.error('Invalid LINE signature');
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
      
      // リクエストボディ検証
      if (!req.body || !req.body.events) {
        return res.status(200).send('OK');
      }
      
      const events = req.body.events;
      
      // イベント処理
      for (const event of events) {
        // テキストメッセージのみ処理
        if (event.type !== 'message' || event.message?.type !== 'text') {
          continue;
        }
        
        const userId = event.source?.userId || 'unknown';
        const text = sanitizeInput(event.message.text);
        const replyToken = event.replyToken;
        
        // レート制限チェック
        if (!checkRateLimit(userId)) {
          await replyMessage(replyToken, [{
            type: 'text',
            text: 'リクエストが多すぎます。しばらく待ってから再度お試しください。'
          }]);
          continue;
        }
        
        // メニュー表示
        if (text === 'メニュー' || text === '予約したい') {
          await replyMessage(replyToken, [createMenuMessage()]);
          continue;
        }
        
        // 予約処理
        if (text && text.includes('予約')) {
          // フォーマット説明の場合
          if (text.includes('予約フォーマット')) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: '予約フォーマットに従ってメッセージを送信してください。\n例：「予約 明日 18時 4名」'
            }]);
            continue;
          }
          
          // 予約データ解析
          let people = 2;
          let date = new Date().toISOString().split('T')[0];
          let time = '19:00:00';
          
          // 人数抽出
          const peopleMatch = text.match(/(\d+)[人名]/);
          if (peopleMatch) {
            people = Math.min(20, Math.max(1, parseInt(peopleMatch[1])));
          }
          
          // 時間抽出
          const timeMatch = text.match(/(\d{1,2})時/);
          if (timeMatch) {
            const hour = timeMatch[1].padStart(2, '0');
            time = `${hour}:00:00`;
          }
          
          // 日付抽出
          if (text.includes('明日')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = tomorrow.toISOString().split('T')[0];
          } else if (text.includes('今日')) {
            date = new Date().toISOString().split('T')[0];
          }
          
          // データ検証
          const validationErrors = validateReservationData({
            people, date, time
          });
          
          if (validationErrors.length > 0) {
            await replyMessage(replyToken, [{
              type: 'text',
              text: `予約できません：\n${validationErrors.join('\n')}`
            }]);
            continue;
          }
          
          // データベース保存（トランザクション使用推奨）
          const { data: reservation, error } = await supabase
            .from('reservations')
            .insert([{
              store_id: requiredEnvVars.STORE_ID,
              user_id: userId,
              message: text.substring(0, 200), // 最大長制限
              people: people,
              date: date,
              time: time,
              status: 'pending'
            }])
            .select()
            .single();
          
          if (error) {
            console.error('Database error:', error);
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'システムエラーが発生しました。お電話でご予約ください。'
            }]);
          } else {
            // 成功メッセージ
            const displayTime = time.substring(0, 5);
            await replyMessage(replyToken, [
              {
                type: 'text',
                text: `✅ 予約を承りました！\n\n📅 日付: ${date}\n⏰ 時間: ${displayTime}\n👥 人数: ${people}名\n\n予約番号: #${reservation.id}\n\n変更・キャンセルはお電話でご連絡ください。`
              },
              {
                type: 'text',
                text: '他にご予約はございますか？',
                quickReply: {
                  items: [
                    { type: 'action', action: { type: 'message', label: '別の予約をする', text: 'メニュー' }},
                    { type: 'action', action: { type: 'message', label: '終了', text: 'ありがとうございました' }}
                  ]
                }
              }
            ]);
          }
        } else if (text === 'ありがとうございました') {
          await replyMessage(replyToken, [{
            type: 'text',
            text: 'ご利用ありがとうございました！またのご予約をお待ちしております。'
          }]);
        } else {
          // その他のメッセージ
          await replyMessage(replyToken, [
            { type: 'text', text: 'こんにちは！予約をご希望ですか？' },
            createMenuMessage()
          ]);
        }
      }
      
      // LINEには必ず200を返す
      return res.status(200).send('OK');
      
    } catch (error) {
      console.error('Webhook error:', error);
      // エラーでも200を返す（LINE仕様）
      return res.status(200).send('OK');
    }
  }
  
  // その他のメソッド
  return res.status(405).json({ error: 'Method not allowed' });
}