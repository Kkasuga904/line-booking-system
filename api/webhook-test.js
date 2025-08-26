import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  // すべてのリクエストをログ
  const timestamp = new Date().toISOString();
  
  // GETリクエスト - 状態確認
  if (req.method === 'GET') {
    const { data: logs } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return res.status(200).json({
      status: 'Webhook Test Active',
      timestamp,
      environment: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
        storeId: process.env.STORE_ID || 'not-set'
      },
      recent_data: logs || []
    });
  }
  
  // POSTリクエスト - Webhookを受信
  if (req.method === 'POST') {
    try {
      // リクエストの詳細をログ
      await supabase.from('reservations').insert([{
        store_id: 'webhook-test',
        user_id: 'debug',
        message: JSON.stringify({
          timestamp,
          method: req.method,
          headers: req.headers,
          body: req.body
        }),
        people: 1,
        date: new Date().toISOString().split('T')[0],
        time: '00:00:00',
        status: 'debug'
      }]);
      
      // Webhook検証（空イベント）への対応
      if (!req.body?.events || req.body.events.length === 0) {
        return res.status(200).json({ 
          status: 'webhook verification',
          timestamp 
        });
      }
      
      // イベント処理
      const events = req.body.events || [];
      
      for (const event of events) {
        // すべてのイベントをログ
        await supabase.from('reservations').insert([{
          store_id: 'event-log',
          user_id: event.source?.userId || 'unknown',
          message: JSON.stringify(event),
          people: 99,
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0],
          status: 'event'
        }]);
        
        // テキストメッセージの場合
        if (event.type === 'message' && event.message?.type === 'text') {
          const userMessage = event.message.text;
          const userId = event.source?.userId || 'unknown';
          
          // 実際の予約として保存
          if (userMessage.includes('予約')) {
            let people = 2;
            let date = new Date().toISOString().split('T')[0];
            let time = '19:00:00';
            
            // 人数抽出
            const peopleMatch = userMessage.match(/(\d+)[人名]/);
            if (peopleMatch) people = parseInt(peopleMatch[1]);
            
            // 時間抽出
            const timeMatch = userMessage.match(/(\d{1,2})[時:：]/);
            if (timeMatch) {
              time = `${timeMatch[1].padStart(2, '0')}:00:00`;
            }
            
            // 日付抽出
            if (userMessage.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split('T')[0];
            }
            
            // 予約を保存
            const { data, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: process.env.STORE_ID || 'restaurant-001',
                user_id: userId,
                message: userMessage,
                people,
                date,
                time,
                status: 'pending'
              }])
              .select()
              .single();
            
            if (error) {
              await supabase.from('reservations').insert([{
                store_id: 'error-log',
                user_id: 'system',
                message: `Error: ${JSON.stringify(error)}`,
                people: 0,
                date: new Date().toISOString().split('T')[0],
                time: '00:00:00',
                status: 'error'
              }]);
            }
          }
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        timestamp,
        processed: events.length 
      });
      
    } catch (error) {
      // エラーもログ
      await supabase.from('reservations').insert([{
        store_id: 'error-catch',
        user_id: 'system',
        message: `Catch: ${error.message}`,
        people: 0,
        date: new Date().toISOString().split('T')[0],
        time: '00:00:00',
        status: 'error'
      }]);
      
      // LINEには必ず200を返す
      return res.status(200).json({ 
        error: error.message,
        timestamp 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}