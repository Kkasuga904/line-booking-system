import { createClient } from '@supabase/supabase-js';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Line-Signature');
  
  // GET: ヘルスチェック
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      return res.status(200).json({
        status: 'ok',
        message: 'Webhook Simple Version',
        recent_reservations: data || [],
        error: error?.message
      });
    } catch (err) {
      return res.status(200).json({ 
        status: 'error', 
        message: err.message 
      });
    }
  }
  
  // OPTIONS: CORS対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // POST: Webhook処理
  if (req.method === 'POST') {
    try {
      // Webhook検証（空のイベント）
      if (!req.body?.events || req.body.events.length === 0) {
        return res.status(200).json({ status: 'ok' });
      }
      
      const events = req.body.events;
      console.log('Received events:', events.length);
      
      // 各イベントを処理
      for (const event of events) {
        console.log('Processing event:', event.type);
        
        // メッセージイベントのみ処理
        if (event.type === 'message' && event.message?.type === 'text') {
          const userMessage = event.message.text;
          const userId = event.source?.userId || 'unknown';
          
          console.log(`User ${userId} sent: ${userMessage}`);
          
          // "予約"を含むメッセージを処理
          if (userMessage && userMessage.includes('予約')) {
            // 予約情報を解析
            const reservation = {
              people: 2,  // デフォルト
              date: new Date().toISOString().split('T')[0],
              time: '19:00:00'
            };
            
            // 人数を探す
            const peopleMatch = userMessage.match(/(\d+)[人名]/);
            if (peopleMatch) {
              reservation.people = parseInt(peopleMatch[1]);
            }
            
            // 時間を探す
            const timeMatch = userMessage.match(/(\d{1,2})[時:：]/);
            if (timeMatch) {
              reservation.time = `${timeMatch[1].padStart(2, '0')}:00:00`;
            }
            
            // 日付を探す
            if (userMessage.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              reservation.date = tomorrow.toISOString().split('T')[0];
            } else if (userMessage.includes('今日')) {
              reservation.date = new Date().toISOString().split('T')[0];
            }
            
            // データベースに保存
            const { data, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: process.env.STORE_ID || 'restaurant-001',
                user_id: userId,
                message: userMessage,
                people: reservation.people,
                date: reservation.date,
                time: reservation.time,
                status: 'pending'
              }])
              .select()
              .single();
            
            if (error) {
              console.error('DB Error:', error);
            } else {
              console.log('Saved reservation:', data.id);
            }
          }
        }
      }
      
      // LINEには必ず200を返す
      return res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Webhook error:', error);
      // エラーでも200を返す（LINEの仕様）
      return res.status(200).json({ error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}