// 認証不要の予約システムサーバー
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

// Supabase初期化（環境変数またはデフォルト値）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

console.log('Initializing Supabase (no auth required)...');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル配信
console.log('Serving static files from:', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));

// CORS対応
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ヘルスチェック
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', auth: 'not-required', timestamp: new Date().toISOString() });
});

// バージョン情報
app.get('/api/version', (req, res) => {
  res.json({
    version: '4.0.0-noauth',
    environment: process.env.NODE_ENV || 'production',
    service: 'line-booking-api',
    auth_required: false
  });
});

// 予約一覧取得（認証不要）
app.get('/api/admin/list', async (req, res) => {
  try {
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (error) {
      console.error('Database error:', error);
      return res.json({ ok: true, items: [] });
    }
    
    return res.json({ ok: true, items: data || [] });
  } catch (e) {
    console.error('List error:', e);
    return res.json({ ok: true, items: [] });
  }
});

// 予約作成（認証不要）
app.post('/api/reservation/create', async (req, res) => {
  try {
    const b = req.body || {};
    const storeId = b.store_id || process.env.STORE_ID || 'default-store';
    
    const reservation = {
      store_id: storeId,
      date: b.date,
      time: b.time,
      customer_name: b.customer_name || b.customerName || 'お客様',
      customer_phone: b.customer_phone || b.phone || null,
      people: Number(b.people || b.party_size || 1),
      status: b.status || 'confirmed',
      message: b.message || b.notes || null,
      source: b.source || 'admin'
    };
    
    console.log('Creating reservation:', reservation);
    
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select();
    
    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Reservation created:', data);
    return res.json({ success: true, reservation: data && data[0] });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ error: 'Create failed', message: e?.message });
  }
});

// 予約削除（認証不要）
app.delete('/api/admin/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
    
    const { data, error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId)
      .select();
    
    if (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    console.error('Delete error:', e);
    return res.status(500).json({ error: 'Delete failed', message: e?.message });
  }
});

// 管理画面用API（認証不要）
app.get('/api/admin', async (req, res) => {
  const action = req.query.action || 'list';
  
  if (action === 'supabase' || action === 'list') {
    try {
      const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      
      if (error) {
        console.error('Database error:', error);
        return res.json({ ok: true, data: [] });
      }
      
      return res.json({ ok: true, data: data || [] });
    } catch (e) {
      console.error('Admin list error:', e);
      return res.json({ ok: true, data: [] });
    }
  }
  
  res.json({ ok: true, data: [] });
});

// LINE Webhook（シンプル版）
app.post('/webhook', async (req, res) => {
  res.status(200).end(); // 即座に200を返す
  console.log('Webhook received');
});

// 404ハンドラー
app.use((req, res) => {
  // HTMLファイルのリクエストの場合はindex.htmlを返す
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found', path: req.url });
  }
});

// サーバー起動
console.log('Starting server on port', PORT);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} - NO AUTHENTICATION REQUIRED`);
  console.log('Static files served from /public directory');
  console.log('Health check: /api/ping');
  console.log('Version: /api/version');
});

// エラーハンドリング
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});