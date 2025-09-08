// GCP Cloud Run用統合サーバー（本番用・署名検証有効）
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

// Supabase初期化（環境変数のフォールバック付き）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expressアプリケーション
const app = express();

// RAW bodyを保持するミドルウェア（署名検証用）
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));
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
    version: '2.1.0-gcp-prod',
    environment: NODE_ENV,
    service: 'line-booking-api',
    signatureCheck: 'enabled'
  });
});

// ==========================================
// 2. 認証なし管理画面API（/api/admin-noauth）
// ==========================================
app.get('/api/admin-noauth', async (req, res) => {
  try {
    const action = req.query.action || 'list';
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    
    if (action === 'list') {
      const start = req.query.start;
      const end = req.query.end;
      let q = supabase.from('reservations')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (start) q = q.gte('date', String(start).slice(0,10));
      if (end) q = q.lt('date', String(end).slice(0,10));
      const { data, error } = await q;
      if (error) return res.json({ ok: true, data: [] });
      return res.json({ ok: true, data: data || [] });
    }
    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.json({ ok: true, data: [] });
  }
});

app.post('/api/admin-noauth', async (req, res) => {
  try {
    const action = req.query.action || req.body.action;
    const storeId = req.body.store_id || process.env.STORE_ID || 'default-store';
    
    if (action === 'create') {
      const b = req.body;
      const reservation = {
        store_id: storeId,
        customer_name: b.customerName || b.customer_name || 'お客様',
        date: b.date,
        time: b.time,
        people: b.numberOfPeople || b.people || 1,
        phone: b.phone || b.phoneNumber || '',
        status: b.status || 'confirmed',
        notes: b.notes || '',
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('reservations').insert([reservation]).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, data: data?.[0] });
    }
    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(500).json({ error: 'Create failed', message: e?.message });
  }
});

app.delete('/api/admin-noauth', async (req, res) => {
  try {
    const action = req.query.action;
    const id = req.query.id;
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    
    if (action === 'delete' && id) {
      let { data, error } = await supabase.from('reservations').delete().eq('id', id).eq('store_id', storeId).select();
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) {
        const fb = await supabase.from('reservations').delete().eq('id', id).limit(1).select();
        data = fb.data;
        if (fb.error) return res.status(500).json({ error: fb.error.message });
      }
      if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true, deleted: data[0] });
    }
    return res.status(400).json({ error: 'Invalid action or missing id' });
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});

// ==========================================

// ==========================================
// 3. Admin list (no auth) + Create/Delete
// ==========================================
app.get('/api/admin/list', async (req, res) => {
  try {
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    const start = req.query.start;
    const end = req.query.end;
    let q = supabase.from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (start) q = q.gte('date', String(start).slice(0,10));
    if (end) q = q.lt('date', String(end).slice(0,10));
    const { data, error } = await q;
    if (error) return res.json({ ok: true, items: [] });
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    return res.json({ ok: true, items: [] });
  }
});

// 認証なし予約作成エンドポイント
app.post('/api/reservation/create-noauth', async (req, res) => {
  try {
    const b = req.body || {};
    const storeId = b.store_id || process.env.STORE_ID || 'default-store';
    const reservation = {
      store_id: storeId,
      customer_name: b.customerName || b.customer_name,
      date: b.date,
      time: b.time,
      people: b.numberOfPeople || b.people || 1,
      phone: b.phone || b.phoneNumber,
      status: b.status || 'confirmed',
      notes: b.notes || '',
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('reservations').insert([reservation]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ok: true, data: data?.[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Create failed', message: e?.message });
  }
});

app.post('/api/reservation/create', async (req, res) => {
  try {
    const b = req.body || {};
    const storeId = b.store_id || process.env.STORE_ID || 'default-store';
    let t = String(b.time || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(t)) t = t.padStart(5,'0') + ':00';
    else if (/^\d{1,2}:\d{2}:\d{2}(:.*)?$/.test(t)) t = t.slice(0,8);
    const row = {
      store_id: storeId,
      date: String(b.date || '').slice(0,10),
      time: t || '00:00:00',
      customer_name: b.customer_name || b.customerName || 'お客様',
      customer_phone: b.customer_phone || b.phone || null,
      people: Number(b.people || b.party_size || 1),
      seat_number: b.seat_number || b.seat_code || null,
      status: b.status || 'confirmed',
      message: b.message || b.notes || null,
      source: b.source || 'admin'
    };
    const { data, error } = await supabase.from('reservations').insert([row]).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, reservation: data && data[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Create failed', message: e?.message });
  }
});

app.delete('/api/admin/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    let { data, error } = await supabase.from('reservations').delete().eq('id', id).eq('store_id', storeId).select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) {
      const fb = await supabase.from('reservations').delete().eq('id', id).limit(1).select();
      data = fb.data; if (fb.error) return res.status(500).json({ error: fb.error.message });
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});

app.delete('/api/admin', async (req, res, next) => {
  try {
    const action = String(req.query.action || '').toLowerCase();
    if (action !== 'delete') return next();
    const id = req.query.id; if (!id) return res.status(400).json({ error: 'id missing' });
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    let { data, error } = await supabase.from('reservations').delete().eq('id', id).eq('store_id', storeId).select();
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) {
      const fb = await supabase.from('reservations').delete().eq('id', id).limit(1).select();
      data = fb.data; if (fb.error) return res.status(500).json({ error: fb.error.message });
    }
    if (!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});
// 2. LINE Webhook処理（署名検証有効）
// ==========================================
app.post('/webhook', async (req, res) => {
  // 即座に200を返す（LINE仕様）
  res.status(200).end();

  // 非同期で処理を続行
  setImmediate(async () => {
    try {
      // 署名検証
      const signature = req.get('X-Line-Signature');
      const body = req.body; // raw body
      
      if (!signature) {
        console.error('No signature provided');
        return;
      }

      // HMAC-SHA256で署名を生成
      const channelSecret = process.env.LINE_CHANNEL_SECRET || '95909cf238912a222f05e0bbe636e70c';
      const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(body)
        .digest('base64');
      
      if (signature !== hash) {
        console.error('Invalid signature', {
          provided: signature,
          expected: hash
        });
        return;
      }

      console.log('Signature verified successfully');

      // bodyをJSONとしてパース
      const jsonBody = JSON.parse(body.toString());
      const events = jsonBody.events || [];
      
      for (const event of events) {
        await processWebhookEvent(event);
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
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
// 3. API Router (削除 - requireを使用しているため)
// ==========================================
// 動的インポートは非同期なので、この部分は削除
// 個別のAPIはserver-prod.jsに直接実装済み

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
console.log('Starting server initialization...');
console.log('Environment variables check:', {
  PORT: PORT,
  NODE_ENV: NODE_ENV,
  SUPABASE_URL: SUPABASE_URL ? 'Set' : 'Not set',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? 'Set' : 'Not set'
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'Server started successfully',
    port: PORT,
    environment: NODE_ENV,
    version: '2.1.0-gcp-prod-fixed',
    timestamp: new Date().toISOString()
  }));
});

// エラーハンドリング
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});