import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

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

export default async function handler(req, res) {
  // GET request - health check
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    return res.status(200).json({
      status: 'active',
      webhook_url: 'https://line-booking-system-seven.vercel.app/webhook',
      recent_reservations: data || []
    });
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
          
          // 予約メッセージの処理
          if (text && text.includes('予約')) {
            // デフォルト値
            let people = 2;
            let date = new Date().toISOString().split('T')[0];
            let time = '19:00';
            
            // 人数抽出
            const peopleMatch = text.match(/(\d+)[人名]/);
            if (peopleMatch) {
              people = parseInt(peopleMatch[1]);
            }
            
            // 時間抽出
            const timeMatch = text.match(/(\d{1,2})時/);
            if (timeMatch) {
              const hour = timeMatch[1].padStart(2, '0');
              time = `${hour}:00`;
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
                store_id: process.env.STORE_ID || 'restaurant-001',
                user_id: userId,
                message: text,
                people: people,
                date: date,
                time: time + ':00',
                status: 'pending'
              }])
              .select()
              .single();
            
            if (error) {
              console.error('Database error:', error);
              await replyMessage(replyToken, [{
                type: 'text',
                text: '予約の処理中にエラーが発生しました。もう一度お試しください。'
              }]);
            } else {
              // 予約確認メッセージ
              await replyMessage(replyToken, [{
                type: 'text',
                text: `✅ 予約を承りました！\n\n📅 日付: ${date}\n⏰ 時間: ${time}\n👥 人数: ${people}名\n\n予約ID: ${reservation.id}\n\nご来店をお待ちしております！`
              }]);
            }
          } else {
            // 予約以外のメッセージ
            await replyMessage(replyToken, [{
              type: 'text',
              text: '予約をご希望の場合は、以下の形式でメッセージをお送りください：\n\n例：「予約 明日 18時 2名」\n\nお気軽にお問い合わせください！'
            }]);
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