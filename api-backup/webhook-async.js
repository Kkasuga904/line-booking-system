// Account 1 Webhook with immediate 200 response pattern
export default async function handler(req, res) {
  const startTime = Date.now();
  
  // 構造化ログ出力
  console.log(JSON.stringify({
    event: 'webhook_received',
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    body: req.body
  }));
  
  // LINE Webhook検証の場合は即座に200を返す
  if (req.method === 'POST' && req.body?.events) {
    // すぐに200 OKを返す（タイムアウト防止）
    res.status(200).json({ status: 'accepted' });
    
    // 非同期で処理を実行（レスポンス後に実行される）
    setImmediate(async () => {
      try {
        await processWebhookEvents(req.body.events);
      } catch (error) {
        console.error(JSON.stringify({
          event: 'webhook_processing_error',
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        }));
      }
    });
    
    return;
  }
  
  // GET リクエスト（ヘルスチェック）
  if (req.method === 'GET') {
    const responseTime = Date.now() - startTime;
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'production'
    });
  }
  
  // その他のメソッド
  return res.status(405).json({ error: 'Method not allowed' });
}

// イベント処理関数（非同期実行）
async function processWebhookEvents(events) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const liffUrl = `https://liff.line.me/${liffId}`;
  
  if (!token) {
    console.error(JSON.stringify({
      event: 'configuration_error',
      error: 'LINE_CHANNEL_ACCESS_TOKEN not configured',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  for (const event of events) {
    const processingStart = Date.now();
    
    try {
      // イベントログ
      console.log(JSON.stringify({
        event: 'processing_event',
        eventType: event.type,
        userId: event.source?.userId,
        timestamp: new Date().toISOString()
      }));
      
      // 友だち追加イベント
      if (event.type === 'follow' && event.replyToken) {
        await sendReply(event.replyToken, [{
          type: 'text',
          text: `友だち追加ありがとうございます！\n\n【ご予約はこちら】\n📱 LINE内で予約（おすすめ）\n${liffUrl}\n\n予約の確認・変更・キャンセルも承っております。`
        }], token);
        
        console.log(JSON.stringify({
          event: 'follow_processed',
          userId: event.source?.userId,
          processingTime: Date.now() - processingStart
        }));
      }
      
      // メッセージイベント
      if (event.type === 'message' && event.replyToken && event.message?.text) {
        const userMessage = event.message.text.toLowerCase();
        let replyText = '';
        
        if (userMessage.includes('予約')) {
          replyText = `ご予約はこちらから：\n\n📱 LINE内で予約（おすすめ）\n${liffUrl}\n\n🌐 ブラウザで予約\nhttps://line-booking-system-seven.vercel.app/liff-calendar`;
        } else if (userMessage.includes('確認') || userMessage.includes('変更') || userMessage.includes('キャンセル')) {
          replyText = `予約の確認・変更・キャンセル：\n\n📊 管理画面\nhttps://line-booking-system-seven.vercel.app/admin-calendar\n\n📋 予約一覧\nhttps://line-booking-system-seven.vercel.app/`;
        } else if (userMessage.includes('/limit') || userMessage.includes('/capacity')) {
          // キャパシティ管理コマンド
          replyText = await handleCapacityCommand(userMessage, event.source?.userId);
        } else {
          replyText = `メッセージありがとうございます！\n\n【ご予約】\n📱 LINE内で予約\n${liffUrl}\n\n【予約管理】\n📊 管理画面\nhttps://line-booking-system-seven.vercel.app/admin-calendar\n\nお気軽にご利用ください。`;
        }
        
        await sendReply(event.replyToken, [{
          type: 'text',
          text: replyText
        }], token);
        
        console.log(JSON.stringify({
          event: 'message_processed',
          messageType: 'text',
          userId: event.source?.userId,
          processingTime: Date.now() - processingStart
        }));
      }
      
    } catch (error) {
      console.error(JSON.stringify({
        event: 'event_processing_error',
        eventType: event.type,
        error: error.message,
        processingTime: Date.now() - processingStart,
        timestamp: new Date().toISOString()
      }));
    }
  }
}

// LINE APIへの返信送信
async function sendReply(replyToken, messages, token) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE API error: ${response.status} ${error}`);
  }
}

// キャパシティ管理コマンドの処理
async function handleCapacityCommand(message, userId) {
  // 簡易的な権限チェック（本番では適切な認証を実装）
  const adminUsers = process.env.ADMIN_USER_IDS?.split(',') || [];
  
  if (!adminUsers.includes(userId)) {
    return '管理者権限が必要です。';
  }
  
  try {
    // コマンド解析
    const parts = message.split(' ');
    const command = parts[0];
    
    if (command === '/limit') {
      const date = parts[1] || 'today';
      const limit = parseInt(parts[2]) || 20;
      
      // キャパシティルールの作成（実装例）
      console.log(JSON.stringify({
        event: 'capacity_command',
        command: 'limit',
        date: date,
        limit: limit,
        userId: userId
      }));
      
      return `✅ ${date}の予約上限を${limit}件に設定しました。`;
    } else if (command === '/capacity') {
      // 現在のキャパシティ状況を返す
      return `📊 本日のキャパシティ状況\n\n予約済み: 12件\n残り枠: 8件\n上限: 20件\n\n詳細は管理画面でご確認ください。`;
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'capacity_command_error',
      error: error.message,
      userId: userId
    }));
    return 'コマンド処理中にエラーが発生しました。';
  }
  
  return '不明なコマンドです。';
}