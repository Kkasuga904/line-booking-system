// GCP Cloud Run用統合サーバー（署名検証を一時無効化）
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数読み込み（Secret Manager経由）
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Supabase初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Expressアプリケーション
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// ロギングミドルウェア（構造化ログ）
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.url !== '/api/ping') { // ヘルスチェックは除外
      console.log(JSON.stringify({
        severity: 'INFO',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: Date.now() - start,
        userAgent: req.headers['user-agent']
      }));
    }
  });
  next();
});

// ==========================================
// 1. ヘルスチェック & バージョン
// ==========================================
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.1-gcp-nosig',
    environment: NODE_ENV,
    service: 'line-booking-api'
  });
});

// ==========================================
// 2. LINE Webhook処理
// ==========================================
app.post('/webhook', async (req, res) => {
  // 即座に200を返す（LINE仕様）
  res.status(200).end();

  // 非同期で処理を続行
  setImmediate(async () => {
    console.log('Webhook received - signature check DISABLED for testing');
    
    // イベント処理
    const events = req.body.events || [];
    for (const event of events) {
      await processWebhookEvent(event);
    }
  });
});

async function processWebhookEvent(event) {
  try {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return;
    }

    const userId = event.source.userId;
    const text = event.message.text;
    const replyToken = event.replyToken;

    console.log(JSON.stringify({
      severity: 'INFO',
      message: 'Webhook event received',
      userId,
      text,
      eventType: event.type
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

    // LINE返信（必要に応じて）
    if (replyToken && replyMessage) {
      await replyToLine(replyToken, replyMessage);
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message: 'Webhook processing error',
      error: error.message
    }));
  }
}

async function replyToLine(replyToken, text) {
  const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
  
  try {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LINE API error: ${response.status} - ${errorText}`);
      throw new Error(`LINE API error: ${response.status}`);
    } else {
      console.log('Reply sent successfully');
    }
  } catch (error) {
    console.error('Failed to reply to LINE:', error);
  }
}

// ==========================================
// 3. API Router (Vercel互換)
// ==========================================
app.use('/api', (req, res, next) => {
  const apiPath = req.path.substring(1); // Remove leading /
  const apiFile = path.join(__dirname, 'api', `${apiPath}.js`);
  
  try {
    if (require.resolve(apiFile)) {
      const handler = require(apiFile);
      handler.default(req, res);
    } else {
      next();
    }
  } catch (error) {
    next();
  }
});

// ==========================================
// 4. 管理画面
// ==========================================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==========================================
// 5. エラーハンドリング
// ==========================================
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

// ==========================================
// 6. サーバー起動
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'Server started - SIGNATURE CHECK DISABLED',
    port: PORT,
    environment: NODE_ENV,
    version: '2.0.1-gcp-nosig',
    timestamp: new Date().toISOString()
  }));
});