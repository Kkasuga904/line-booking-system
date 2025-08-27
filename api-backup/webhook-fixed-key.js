import { createClient } from '@supabase/supabase-js';

// Supabase初期化 - ハードコードして動作確認
const SUPABASE_URL = '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_KEY = '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// LINE返信メッセージ送信
async function replyMessage(replyToken, messages) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return;
  }
  
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: messages
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LINE reply error:', error);
    }
  } catch (error) {
    console.error('Failed to send reply:', error);
  }
}

// クイックリプライ付きメニューメッセージ
function createMenuMessage() {
  return {
    type: 'text',
    text: '予約をご希望ですか？\n以下のボタンから選択してください👇',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '今日 18時 2名',
            text: '予約 今日 18時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '今日 19時 2名',
            text: '予約 今日 19時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '今日 20時 2名',
            text: '予約 今日 20時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 18時 2名',
            text: '予約 明日 18時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 19時 2名',
            text: '予約 明日 19時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 20時 2名',
            text: '予約 明日 20時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '4名で予約',
            text: '予約 今日 19時 4名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '6名で予約',
            text: '予約 今日 19時 6名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: 'カスタム予約',
            text: '予約フォーマット：\n「予約 [日付] [時間] [人数]」\n例：予約 明日 18時 4名'
          }
        }
      ]
    }
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Line-Signature');
  
  // OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET request - health check
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return res.status(200).json({
        status: 'active with hardcoded keys',
        webhook_url: 'https://line-booking-system-seven.vercel.app/webhook',
        recent_reservations: data || [],
        db_test: error ? `Error: ${error.message}` : 'Connected successfully',
        supabase_url_used: SUPABASE_URL
      });
    } catch (err) {
      return res.status(200).json({
        status: 'error',
        error: err.message
      });
    }
  }
  
  // POST request - handle webhook
  if (req.method === 'POST') {
    try {
      // Handle verification (empty events)
      if (!req.body || !req.body.events || req.body.events.length === 0) {
        return res.status(200).send('OK');
      }
      
      const events = req.body.events;
      
      // Process each event
      for (const event of events) {
        // Only process text messages
        if (event.type === 'message' && event.message && event.message.type === 'text') {
          const text = event.message.text;
          const userId = event.source?.userId || 'unknown';
          const replyToken = event.replyToken;
          
          // メニュー表示のトリガー
          if (text === 'メニュー' || text === 'menu' || text === '予約したい') {
            await replyMessage(replyToken, [createMenuMessage()]);
            continue;
          }
          
          // 予約メッセージの処理
          if (text && text.includes('予約')) {
            // フォーマット説明の場合はスキップ
            if (text.includes('予約フォーマット')) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: '予約フォーマットに従ってメッセージを送信してください。\n例：「予約 明日 18時 4名」'
              }]);
              continue;
            }
            
            // デフォルト値
            let people = 2;
            let date = new Date().toISOString().split('T')[0];
            let time = '19:00:00'; // 秒まで含めた形式に
            
            // 人数抽出
            const peopleMatch = text.match(/(\d+)[人名]/);
            if (peopleMatch) {
              people = parseInt(peopleMatch[1]);
            }
            
            // 時間抽出
            const timeMatch = text.match(/(\d{1,2})時/);
            if (timeMatch) {
              const hour = timeMatch[1].padStart(2, '0');
              time = `${hour}:00:00`; // 秒まで含めた形式
            }
            
            // 日付抽出
            if (text.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split('T')[0];
            } else if (text.includes('今日')) {
              date = new Date().toISOString().split('T')[0];
            }
            
            // データベースに保存
            const { data: reservation, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: 'restaurant-001',
                user_id: userId,
                message: text,
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
                text: `予約の処理中にエラーが発生しました。\n詳細: ${error.message}\n\nもう一度お試しください。`
              }]);
            } else {
              // 時間表示用フォーマット（秒を除去）
              const displayTime = time.substring(0, 5);
              
              // 予約確認メッセージ
              const confirmMessage = {
                type: 'text',
                text: `✅ 予約を承りました！\n\n📅 日付: ${date}\n⏰ 時間: ${displayTime}\n👥 人数: ${people}名\n\n予約ID: ${reservation.id}\n\n変更・キャンセルはお電話でご連絡ください。`
              };
              
              // 次の予約用のクイックリプライ
              const nextActionMessage = {
                type: 'text',
                text: '他にご予約はございますか？',
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '別の予約をする',
                        text: 'メニュー'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '終了',
                        text: 'ありがとうございました'
                      }
                    }
                  ]
                }
              };
              
              await replyMessage(replyToken, [confirmMessage, nextActionMessage]);
            }
          } else if (text === 'ありがとうございました' || text === '終了') {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'ご利用ありがとうございました！\nまたのご予約をお待ちしております。'
            }]);
          } else {
            // 予約以外のメッセージには予約メニューを提示
            await replyMessage(replyToken, [
              {
                type: 'text',
                text: 'こんにちは！予約をご希望ですか？'
              },
              createMenuMessage()
            ]);
          }
        }
      }
      
      // Always return 200 for LINE
      return res.status(200).send('OK');
      
    } catch (error) {
      console.error('Error processing webhook:', error);
      // Return 200 even on error (LINE requirement)
      return res.status(200).send('OK');
    }
  }
  
  // Other methods
  return res.status(405).json({ error: 'Method not allowed' });
}