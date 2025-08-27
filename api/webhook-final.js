// Account 1 - Final webhook with await-based reply
// Version: FINAL-1.0
// Store: account-001

export default async function handler(req, res) {
  console.log('=== Account 1 Webhook FINAL v1.0 START ===');
  
  try {
    const body = req.body;
    const event = body?.events?.[0];
    
    console.log('Event received:', JSON.stringify(event, null, 2));

    // 返信不要なイベントは即200
    if (!event || event.type !== 'message' || !event.replyToken) {
      console.log('Skipping non-message event');
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    // Account 1用のトークン
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!token) {
      console.error('CRITICAL: LINE_CHANNEL_ACCESS_TOKEN not set!');
      res.status(200).json({ ok: false, error: 'No token' });
      return;
    }

    console.log('Token exists, length:', token.length);
    console.log('Reply token:', event.replyToken.substring(0, 20) + '...');
    console.log('Message text:', event.message?.text);

    // ---- awaitで同期的に送信（バックグラウンドにしない） ----
    console.log('Sending reply to LINE API...');
    
    const replyBody = JSON.stringify({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `[Account 1] メッセージを受信しました: ${event.message?.text || 'unknown'}\nStore: account-001\n時刻: ${new Date().toISOString()}`
      }]
    });
    
    console.log('Request body:', replyBody);
    
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: replyBody
    });

    const responseText = await r.text();
    console.log('LINE API Response Status:', r.status);
    console.log('LINE API Response Headers:', JSON.stringify(Object.fromEntries(r.headers), null, 2));
    console.log('LINE API Response Body:', responseText);

    if (!r.ok) {
      // エラー詳細をログ出力
      console.error('LINE API Error:', {
        status: r.status,
        statusText: r.statusText,
        body: responseText
      });
      
      // 典型的なエラー
      if (r.status === 400) {
        console.error('400 Bad Request - Invalid reply token or expired');
      } else if (r.status === 401) {
        console.error('401 Unauthorized - Token invalid or wrong account');
      }
      
      res.status(200).json({ 
        ok: false, 
        lineStatus: r.status, 
        lineError: responseText 
      });
      return;
    }

    console.log('✅ Reply sent successfully!');
    res.status(200).json({ ok: true, sent: true });
    
  } catch (e) {
    console.error('Webhook error:', e);
    console.error('Stack trace:', e.stack);
    // LINE側の再送を避けるため200を返す
    res.status(200).json({ ok: false, error: e.message });
  }
  
  console.log('=== Account 1 Webhook FINAL END ===');
}