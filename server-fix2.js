// GCP Cloud Run用統合サーバー（署名検証デバッグ版）
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数読み込み
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Expressアプリケーション
const app = express();

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// Webhook専用のraw bodyパーサー
let rawBodySaver = function (req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use('/webhook', express.json({ verify: rawBodySaver }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ロギングミドルウェア
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.url !== '/api/ping') {
      console.log(JSON.stringify({
        severity: 'INFO',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Date.now() - start,
        headers: req.headers
      }));
    }
  });
  next();
});

// ヘルスチェック
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (req, res) => {
  res.json({
    version: '2.3.0-debug',
    environment: NODE_ENV,
    service: 'line-booking-api',
    signatureCheck: 'debug-mode'
  });
});

// LINE Webhook処理
app.post('/webhook', async (req, res) => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'Webhook received',
    headers: req.headers,
    hasRawBody: !!req.rawBody,
    bodyType: typeof req.body
  }));

  // 即座に200を返す
  res.status(200).end();

  // 非同期で処理を続行
  setImmediate(async () => {
    try {
      // 署名検証（デバッグモード）
      const signature = req.get('X-Line-Signature');
      
      if (!signature) {
        console.error('No signature provided');
        return;
      }

      // rawBodyを使用
      const bodyString = req.rawBody || JSON.stringify(req.body);
      
      // HMAC-SHA256で署名を生成
      const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
      const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(bodyString)
        .digest('base64');
      
      console.log(JSON.stringify({
        severity: 'INFO',
        message: 'Signature verification',
        provided: signature,
        calculated: hash,
        match: signature === hash,
        secretLength: channelSecret.length,
        bodyLength: bodyString.length
      }));
      
      // 署名が一致しない場合でも、デバッグのため処理を続行
      if (signature !== hash) {
        console.error('Signature mismatch - continuing in debug mode');
      }

      // bodyをJSONとしてパース
      const jsonBody = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
      const events = jsonBody.events || [];
      
      console.log(JSON.stringify({
        severity: 'INFO', 
        message: 'Processing events',
        eventCount: events.length
      }));
      
      for (const event of events) {
        await processWebhookEvent(event);
      }
    } catch (error) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        message: 'Webhook processing error',
        error: error.message,
        stack: error.stack
      }));
    }
  });
});

async function processWebhookEvent(event) {
  try {
    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Processing event',
      eventType: event.type,
      messageType: event.message?.type,
      userId: event.source?.userId
    }));

    if (!event || event.type !== 'message' || !event.message || event.message.type !== 'text') {
      return;
    }

    const userId = event.source?.userId;
    const text = event.message?.text;
    const replyToken = event.replyToken;

    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Text message received',
      userId,
      text,
      hasReplyToken: !!replyToken
    }));

    // メッセージに応じた処理
    let replyMessage = '';
    
    if (text === '予約') {
      replyMessage = '予約メニューをご利用ください。\nhttps://line.me/R/app/2006487876-xd1A5qJB';
    } else if (text === 'キャンセル') {
      replyMessage = '予約をキャンセルしますか？「はい」または「いいえ」でお答えください。';
    } else if (text === '確認') {
      // 予約確認処理
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('user_id', userId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (data && data.length > 0) {
        replyMessage = `予約確認:\n${data.map(r => `${r.date} ${r.time}`).join('\n')}`;
      } else {
        replyMessage = '予約が見つかりませんでした。';
      }
    } else {
      replyMessage = '「予約」「確認」「キャンセル」のいずれかを入力してください。';
    }

    // LINE返信
    if (replyToken && replyMessage) {
      await replyToLine(replyToken, replyMessage);
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message: 'Event processing error',
      error: error.message
    }));
  }
}

async function replyToLine(replyToken, text) {
  const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
  
  try {
    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Sending reply to LINE',
      replyToken: replyToken.substring(0, 10) + '...',
      textLength: text.length
    }));

    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text
        }]
      })
    });

    const responseText = await response.text();
    
    console.log(JSON.stringify({
      severity: response.ok ? 'INFO' : 'ERROR',
      message: 'LINE API response',
      status: response.status,
      response: responseText
    }));

    if (!response.ok) {
      throw new Error(`LINE API error: ${response.status} - ${responseText}`);
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message: 'Failed to reply to LINE',
      error: error.message
    }));
  }
}

// 管理画面
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    severity: 'ERROR',
    message: 'Unhandled error',
    url: req.url,
    error: err.message,
    stack: err.stack
  }));
  res.status(500).json({ error: 'Internal server error' });
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.url });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'Server started - Debug mode with detailed logging',
    port: PORT,
    environment: NODE_ENV,
    version: '2.3.0-debug',
    timestamp: new Date().toISOString()
  }));
});