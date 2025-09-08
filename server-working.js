// 最小限の動作するサーバー
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

// Supabase初期化
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル配信（publicディレクトリ）
console.log('Serving static files from:', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));

// ヘルスチェック
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// 予約一覧（Supabaseから取得）
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

// 予約作成
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
    
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select();
    
    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    return res.json({ success: true, reservation: data && data[0] });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ error: 'Create failed', message: e?.message });
  }
});

// 予約削除
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

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});