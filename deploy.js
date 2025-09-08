const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDI5OCwiZXhwIjoyMDcxNzUwMjk4fQ.xKN7DHEV0iQ0XPx6x6BwqE9k1fGjMhh-Sj8OZPJ7vLc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// サービスロールキーが無効なので、一時的にANONキーを使用
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('WARNING: Using ANON key for admin operations due to invalid service role key');

console.log('Starting server on port', PORT);
console.log('Supabase URL:', SUPABASE_URL);

// 容量ルールテーブル初期化
async function initializeCapacityRules() {
  try {
    // 18:00-21:00を1組制限にするサンプルルール挿入
    const { error } = await supabaseAdmin
      .from('capacity_control_rules')
      .upsert([
        {
          store_id: 'default-store',
          rule_type: 'date',
          target_date: '2025-09-07',
          start_time: '18:00:00',
          end_time: '22:00:00',
          limit_per_slot: 1,
          slot_minutes: 30,
          is_active: true
        }
      ], {
        onConflict: 'store_id,target_date,start_time,end_time'
      });
    
    if (error) {
      console.log('Capacity rule upsert result:', error.message);
    } else {
      console.log('✅ Capacity rules initialized: 18:00-21:00 = 1 group limit');
    }
  } catch (error) {
    console.log('Capacity rules initialization error:', error.message);
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// In-memory storage for capacity rules (shared between admin and LIFF)
const capacityRulesStorage = new Map();

// Load capacity rules from database on startup
async function loadCapacityRulesFromDB() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    
    // Load rules for today and tomorrow
    for (const date of [today, tomorrow]) {
      const { data, error } = await supabase
        .from('capacity_control_rules')
        .select('*')
        .eq('store_id', 'default-store')
        .eq('date', date);
      
      if (!error && data && data.length > 0) {
        const rules = data.map(row => ({
          time: row.time,
          limit: row.limit,
          status: row.status || 'available'
        }));
        
        const key = `default-store_${date}`;
        capacityRulesStorage.set(key, rules);
        console.log(`[Startup] Loaded ${rules.length} capacity rules from DB for ${key}`);
      }
    }
  } catch (error) {
    console.error('[Startup] Error loading capacity rules from DB:', error);
  }
}

// Load rules on startup
loadCapacityRulesFromDB();

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Root and admin routes - redirect to calendar view
app.get('/', (req, res) => {
  res.redirect('/admin-full-featured.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin-full-featured.html');
});

app.get('/admin.html', (req, res) => {
  res.redirect('/admin-full-featured.html');
});

app.get('/admin-simple.html', (req, res) => {
  // admin-simple.htmlへのアクセスもカレンダーにリダイレクト
  res.redirect('/admin-full-featured.html');
});

// Redirect /public/* to correct paths
app.get('/public/*', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const correctPath = req.path.replace('/public/', '/');
  res.redirect(301, correctPath + query);
});

// Serve LIFF pages with ID override support (via ?liff_id=) and case normalization
function serveLiffWithOverride(filename, req, res) {
  try {
    const fp = path.join(__dirname, 'public', filename);
    let html = fs.readFileSync(fp, 'utf8');
    // Normalize known casing drift
    html = html.replace(/2006487876-Xd1A5qJB/g, '2006487876-xd1A5qJB');
    // Inject override snippet so ?liff_id=... can force an ID at runtime
    const inject = "<script>(function(){try{var p=new URLSearchParams(location.search||'');var id=p.get('liff_id');if(id){window.LIFF_ID=id;console.log('[LIFF] override id via query:',id);} }catch(e){}})();</script>";
    html = html.replace('</body>', inject + '</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    return res.sendFile(path.join(__dirname, 'public', filename));
  }
}

app.get('/liff-booking.html', (req, res) => serveLiffWithOverride('liff-booking.html', req, res));
app.get('/liff-booking-enhanced.html', (req, res) => serveLiffWithOverride('liff-booking-enhanced.html', req, res));

// Admin page
app.get('/admin-full-featured.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'admin-full-featured.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Admin page not found');
  }
});

// System settings page
app.get('/system-settings.html', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'system-settings.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('System settings page not found');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LIFF用設定エンドポイント
app.get('/api/config:1', (req, res) => {
  res.json({
    liffId: process.env.LIFF_ID || '2006487876-Xd1A5qJB',
    apiUrl: process.env.API_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app',
    storeId: process.env.STORE_ID || 'default-store',
    storeName: 'Demo Restaurant',
    businessHours: {
      open: '11:00',
      close: '21:00'
    }
  });
});

// LIFF ContextToken エンドポイント（LIFF SDK用）
app.post('/api/liff/v2/contextToken:1', (req, res) => {
  res.json({
    contextToken: 'dummy-context-token-' + Date.now(),
    expires_in: 3600
  });
});

// 通常のconfig（:1なし）
app.get('/api/config', (req, res) => {
  // 統一ポリシー: すべて store-a を使用
  res.json({
    liffId: process.env.LIFF_ID || '2006487876-Xd1A5qJB',
    apiUrl: process.env.API_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app',
    storeId: 'store-a',
    storeName: 'Demo Restaurant',
    businessHours: {
      open: '11:00',
      close: '21:00'
    }
  });
});

// API endpoints
app.get('/api/admin', async (req, res) => {
  try {
    const action = req.query.action;
    // 管理画面もstore-aをデフォルトに
    const storeId = req.query.store_id || 'store-a';
    
    // DB接続テスト
    if (action === 'test_db') {
      try {
        const { data, error } = await supabase
          .from('capacity_control_rules')
          .select('count')
          .limit(1);
        
        if (error) {
          return res.json({ 
            success: false, 
            error: 'DB接続エラー',
            details: error.message 
          });
        }
        
        return res.json({ 
          success: true, 
          message: 'DB接続成功',
          table: 'capacity_control_rules' 
        });
      } catch (error) {
        return res.json({ 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // 生データ取得
    if (action === 'get_raw_capacity_rules') {
      try {
        const { data, error } = await supabase
          .from('capacity_control_rules')
          .select('*')
          .order('date', { ascending: true });
        
        if (error) {
          return res.json({ 
            success: false, 
            error: error.message 
          });
        }
        
        // 今日の日付と比較
        const today = new Date().toISOString().slice(0, 10);
        const todayRules = data.filter(r => r.date === today);
        const sep7Rules = data.filter(r => r.date === '2025-09-07');
        
        console.log(`[get_raw_capacity_rules] Total: ${data.length}, Today: ${todayRules.length}, Sep7: ${sep7Rules.length}`);
        
        return res.json({ 
          success: true,
          totalRules: data.length,
          todayRules: todayRules,
          sep7Rules: sep7Rules,
          rules: data,
          message: `全${data.length}件のルール、今日${todayRules.length}件、9/7: ${sep7Rules.length}件`
        });
      } catch (error) {
        return res.json({ 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // action=capacity の場合、容量ルールを返す
    if (action === 'capacity') {
      try {
        // Get all capacity rules for this store
        const { data, error } = await supabase
          .from('capacity_control_rules')
          .select('*')
          .order('date', { ascending: true });
        
        console.log(`[capacity] 取得したルール数: ${data ? data.length : 0}`);
        if (data && data.length > 0) {
          const sep7Rule = data.find(r => r.date === '2025-09-07');
          if (sep7Rule) {
            console.log('[capacity] 9月7日のルール:', sep7Rule);
          }
        }
        
        if (error) {
          console.error('Error fetching capacity rules:', error);
          return res.json({ success: false, error: error.message });
        }
        
        // Convert to the format expected by the frontend
        // 実際のテーブル構造に基づいて処理
        const rules = (data || []).map(row => {
          // start_timeとend_timeカラムから時間を取得
          const startTime = row.start_time ? row.start_time.substring(0, 5) : '18:00';
          const endTime = row.end_time ? row.end_time.substring(0, 5) : '21:00';
          
          return {
            id: row.id,
            date: row.date,
            startTime: startTime,
            endTime: endTime,
            maxGroups: 1,  // デフォルトで1組制限
            maxPeople: null,
            maxPerGroup: null,
            createdAt: row.created_at || new Date().toISOString()
          };
        });
        
        return res.json({ 
          success: true, 
          settings: { rules }
        });
      } catch (e) {
        console.error('Get capacity error:', e);
        return res.json({ success: false, error: 'Get failed' });
      }
    }
    
    // action=listの場合も含めて、予約一覧を返す
    if (!action || action === 'list') {
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

      // データ形式を管理画面に合わせる
      const formattedData = (data || []).map(item => ({
        id: item.id,
        store_id: item.store_id,
        date: item.date,
        time: item.time,
        customer_name: item.customer_name,
        customer_phone: item.phone,
        phone: item.phone,
        people: item.people,
        status: item.status || 'confirmed',
        message: item.message,
        source: item.source,
        created_at: item.created_at
      }));

      return res.json({ ok: true, items: formattedData });
    }
    
    return res.json({ ok: true, items: [] });
  } catch (e) {
    console.error('List error:', e);
    return res.json({ ok: true, items: [] });
  }
});

app.get('/api/admin/list', async (req, res) => {
  try {
    const storeId = req.query.store_id || 'store-a';
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

// Handle both POST and PUT methods for admin operations
app.post('/api/admin', handleAdminRequest);
app.put('/api/admin', handleAdminRequest);

async function handleAdminRequest(req, res) {
  const action = req.query.action || req.body.action;
  const id = req.query.id || req.body.id;
  
  if (action === 'create') {
    try {
      // 統一ポリシー: すべて store-a を使用
      const storeId = 'store-a';
      const reservation = {
        store_id: storeId,
        date: req.body.date,
        time: req.body.time,
        customer_name: req.body.customer_name || 'Unknown',
        phone: req.body.customer_phone || req.body.phone || null,
        people: Number(req.body.people || 1),
        status: req.body.status || 'confirmed',
        message: req.body.message || null,
        source: 'admin'
      };

      const { data, error } = await supabase
        .from('reservations')
        .insert([reservation])
        .select();

      if (error) {
        console.error('Create error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true, data: data[0] });
    } catch (e) {
      console.error('Create error:', e);
      return res.status(500).json({ error: 'Create failed' });
    }
  } else if (action === 'update' && id) {
    try {
      // 統一ポリシー: すべて store-a を使用
      const storeId = 'store-a';
      const updates = {
        date: req.body.date,
        time: req.body.time,
        customer_name: req.body.customer_name,
        phone: req.body.customer_phone || req.body.phone,
        people: Number(req.body.people || 1),
        status: req.body.status || 'confirmed',
        message: req.body.message
      };

      const { data, error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
        .eq('store_id', storeId)
        .select();

      if (error) {
        console.error('Update error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ success: true, data: data[0] });
    } catch (e) {
      console.error('Update error:', e);
      return res.status(500).json({ error: 'Update failed' });
    }
  } else if (action === 'saveCapacity') {
    try {
      console.log('saveCapacity called with:', JSON.stringify(req.body));
      
      // supabaseAdminの確認
      if (!supabaseAdmin) {
        console.error('supabaseAdmin is not initialized!');
        return res.json({ success: false, error: 'Database connection not initialized' });
      }
      
      const storeId = req.body.store_id || 'default-store';
      const settings = req.body.settings;
      
      if (!settings || !settings.rules) {
        console.log('No rules provided in request');
        return res.json({ success: false, error: 'No rules provided' });
      }
      
      console.log(`Processing ${settings.rules.length} rules for store ${storeId}`);
      
      // Extract all unique dates from rules
      const uniqueDates = [...new Set(settings.rules.map(r => r.date))];
      console.log('Unique dates:', uniqueDates);
      
      for (const date of uniqueDates) {
        // Delete existing rules for this date
        console.log(`Deleting existing rules for store ${storeId}, date: ${date}`);
        const { error: deleteError } = await supabaseAdmin
          .from('capacity_control_rules')
          .delete()
          .eq('store_id', storeId)
          .eq('date', date);
        
        if (deleteError) {
          console.error('Error deleting existing rules:', deleteError);
          // Continue anyway - might be no existing rules
        }
        
        // Get rules for this date
        const dateRules = settings.rules.filter(r => r.date === date);
        
        // Insert new rules in the capacity_control_rules table format
        // start_timeとend_timeカラムに直接保存
        const newRules = dateRules.map(rule => ({
          store_id: storeId,  // store_idを追加
          control_type: 'time_based',  // control_typeを追加（必須カラム）
          date: rule.date,
          start_time: rule.startTime + ':00',  // HH:mm:ss形式に変換
          end_time: rule.endTime + ':00',      // HH:mm:ss形式に変換
          max_groups: rule.maxGroups || null,
          max_people: rule.maxPeople || null,
          max_per_group: rule.maxPerGroup || null,
          start_date: null,
          end_date: null,
          weekday: null
        }));
        
        if (newRules.length > 0) {
          console.log('Inserting rules:', JSON.stringify(newRules));
          
          // まずテーブルの存在を確認
          const { data: tableCheck, error: tableError } = await supabaseAdmin
            .from('capacity_control_rules')
            .select('*')
            .limit(1);
          
          if (tableError) {
            console.error('Table access error:', tableError);
            console.error('Table error details:', JSON.stringify(tableError));
            
            // APIキーエラーの場合
            if (tableError.message && tableError.message.includes('API key')) {
              return res.json({ success: false, error: 'Invalid API key' });
            }
            
            return res.json({ success: false, error: `Table error: ${tableError.message}` });
          }
          
          const { data: insertData, error } = await supabaseAdmin
            .from('capacity_control_rules')
            .insert(newRules);
          
          if (error) {
            console.error('Error saving capacity rules:', error);
            console.error('Error details:', JSON.stringify(error));
            console.error('Error code:', error.code);
            console.error('Error hint:', error.hint);
            return res.json({ success: false, error: error.message || 'Database error' });
          }
          console.log('Successfully inserted rules:', insertData);
        }
      }
      
      console.log('Capacity rules saved successfully');
      return res.json({ success: true, message: 'Capacity rules saved' });
    } catch (e) {
      console.error('Save capacity error:', e);
      console.error('Error stack:', e.stack);
      return res.json({ success: false, error: e.message || 'Save failed' });
    }
  } else if (action === 'delete' && id) {
    try {
      // 統一ポリシー: すべて store-a を使用
      const storeId = 'store-a';
      
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

      return res.json({ success: true, data: data ? data[0] : null });
    } catch (e) {
      console.error('Delete error:', e);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}

// Handle DELETE method with action=delete query parameter
app.delete('/api/admin', async (req, res) => {
  const action = req.query.action;
  const id = req.query.id;
  
  if (action === 'delete' && id) {
    try {
      const storeId = req.query.store_id || 'store-a';
      
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

      return res.json({ success: true, data: data ? data[0] : null });
    } catch (e) {
      console.error('Delete error:', e);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }
  
  return res.status(400).json({ error: 'Invalid delete request' });
});

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

    return res.json({ success: true, deleted: data[0] });
  } catch (e) {
    console.error('Delete error:', e);
    return res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/admin/slots', (req, res) => {
  const slots = [];
  const times = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
                 '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', 
                 '19:00', '19:30', '20:00', '20:30', '21:00'];
  
  for (const time of times) {
    slots.push({
      time: time,
      available: Math.random() > 0.3,
      capacity: 10,
      booked: Math.floor(Math.random() * 5)
    });
  }
  
  res.json({ ok: true, slots });
});

app.get('/api/admin/analytics', (req, res) => {
  res.json({
    ok: true,
    stats: {
      today: { reservations: 15, revenue: 45000 },
      week: { reservations: 87, revenue: 261000 },
      month: { reservations: 342, revenue: 1026000 }
    }
  });
});

app.get('/api/admin/settings', (req, res) => {
  res.json({
    ok: true,
    settings: {
      store_name: 'Demo Restaurant',
      opening_time: '11:00',
      closing_time: '21:00',
      max_party_size: 10,
      reservation_interval: 30
    }
  });
});

app.get('/api/store/settings', (req, res) => {
  res.json({
    ok: true,
    settings: {
      store_id: req.query.store_id || 'default-store',
      store_name: 'Demo Restaurant',
      opening_time: '11:00',
      closing_time: '21:00'
    }
  });
});

// Capacity rules are now handled via the admin API endpoints above

app.get('/api/capacity-status', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const storeId = req.query.store_id || 'store-a';
    
    // データベースから該当日の予約を取得
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .neq('status', 'cancelled');
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    res.json({
      success: true,
      ok: true,
      date: date,
      items: reservations || [],
      capacity: {
        total: 50,
        reserved: reservations ? reservations.length : 0,
        available: 50 - (reservations ? reservations.length : 0)
      }
    });
  } catch (error) {
    console.error('Capacity status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backward-/Cross-page compatible availability API used by enhanced LIFF page
app.get('/api/capacity-availability', async (req, res) => {
  const storeId = String(req.query.store_id || req.headers['x-store-id'] || 'default-store');
  const dateISO = String(req.query.date || '').slice(0, 10); // 'YYYY-MM-DD'
  const trace = { storeId, dateISO, rev: process.env.K_REVISION || 'dev' };

  // 失敗しても UI を止めない
  function okEmpty(extra = {}) {
    return res.json({ ok: true, store_id: storeId, date: dateISO, slots: {}, ...extra });
  }

  // 入力バリデーション
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    console.warn('[capacity] invalid-date', trace);
    return okEmpty({ warn: 'invalid-date' });
  }

  if (!supabaseAdmin) {
    console.error('[capacity] supabase-init-failed', trace);
    return okEmpty({ warn: 'supabase-init-failed' });
  }

  try {
    // 1) 予約集計（キャンセル以外）
    let reservations = [];
    const { data: resData, error: rerr } = await supabaseAdmin
      .from('reservations')
      .select('time, people, status')
      .eq('store_id', storeId)
      .eq('date', dateISO)
      .or('status.is.null,status.neq.canceled'); // ← PostgRESTの or 構文
    if (rerr) {
      console.error('[capacity] reservations-error', { ...trace, err: rerr });
      // Continue with empty reservations instead of returning early
      reservations = [];
    } else {
      reservations = resData || [];
    }

    // 2) ルール取得（capacity_control_rulesテーブルから）
    const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // TZズレ防止
    let rules = [];
    const { data: rulesData, error: derr } = await supabaseAdmin
      .from('capacity_control_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', dateISO);  // store_idとdateカラムを使用
    if (derr) {
      console.error('[capacity] rules-error', { ...trace, err: derr });
      // Continue with empty rules, temporary override will still work
      rules = [];
    } else {
      rules = rulesData || [];
    }

    // 3) 集計
    const reservedByTime = {};
    for (const r of reservations || []) {
      const t = (r.time || '').slice(0, 5); // 'HH:mm'
      if (!t) continue;
      const add = 1; // 組数。人数ベースにするなら Number(r.people||0)
      reservedByTime[t] = (reservedByTime[t] || 0) + add;
    }

    const slotMinutes = rules[0]?.slot_minutes ?? 30;
    const slotStart = '11:00', slotEnd = '22:00';
    function* slotsIter() {
      // Parse time properly
      const [startHour, startMin] = slotStart.split(':').map(Number);
      const [endHour, endMin] = slotEnd.split(':').map(Number);
      
      let currentHour = startHour;
      let currentMin = startMin;
      
      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const hh = String(currentHour).padStart(2,'0');
        const mm = String(currentMin).padStart(2,'0');
        yield `${hh}:${mm}`;
        
        // Add slot minutes
        currentMin += slotMinutes;
        if (currentMin >= 60) {
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;
        }
      }
    }
    const pickLimit = (hhmm) => {
      // capacity_control_rulesテーブルからルールを適用
      // start_timeとend_timeカラムを直接使用
      for (const rule of rules) {
        if (!rule.start_time || !rule.end_time) continue;
        
        // 時間範囲をチェック (HH:mm:ss形式をHH:mm形式に変換)
        const startTime = rule.start_time.substring(0, 5);
        const endTime = rule.end_time.substring(0, 5);
        
        if (hhmm >= startTime && hhmm <= endTime) {
          // max_groupsカラムの値を使用（nullの場合は制限なし）
          return rule.max_groups || null;
        }
      }
      
      // 暫定オーバーライド（営業優先）- ルールがない場合のみ
      if (hhmm >= '18:00' && hhmm < '21:00' && storeId === 'default-store' && rules.length === 0) {
        return 1;
      }
      return null; // ルール無ければ未設定
    };

    // 4) 制限時間帯別の予約総数を計算
    const ruleReservedTotals = {};
    for (const rule of rules) {
      if (!rule.start_time || !rule.end_time) continue;
      
      const startTime = rule.start_time.substring(0, 5);
      const endTime = rule.end_time.substring(0, 5);
      const ruleKey = `${startTime}-${endTime}`;
      
      let totalReserved = 0;
      for (const time in reservedByTime) {
        if (time >= startTime && time <= endTime) {
          totalReserved += reservedByTime[time];
        }
      }
      ruleReservedTotals[ruleKey] = totalReserved;
      
      console.log(`[capacity] Rule ${startTime}-${endTime}: total reserved=${totalReserved}, limit=${rule.max_groups}`);
    }

    const slots = {};
    try {
      for (const hhmm of slotsIter()) {
        const limit = pickLimit(hhmm);
        const reserved = reservedByTime[hhmm] || 0;
        let available, status;
        
        if (limit == null) {
          available = 999; status = 'available'; // ルール未設定は緑
        } else {
          // 該当する制限時間帯を見つけて、その時間帯全体の予約数をチェック
          let ruleBlocked = false;
          for (const rule of rules) {
            if (!rule.start_time || !rule.end_time) continue;
            
            const startTime = rule.start_time.substring(0, 5);
            const endTime = rule.end_time.substring(0, 5);
            
            if (hhmm >= startTime && hhmm <= endTime) {
              const ruleKey = `${startTime}-${endTime}`;
              const ruleTotalReserved = ruleReservedTotals[ruleKey] || 0;
              const ruleLimit = rule.max_groups || null;
              
              if (ruleLimit && ruleTotalReserved >= ruleLimit) {
                ruleBlocked = true;
                console.log(`[capacity] Time ${hhmm} blocked by rule ${startTime}-${endTime} (${ruleTotalReserved}/${ruleLimit})`);
                break;
              }
            }
          }
          
          if (ruleBlocked) {
            available = 0;
            status = 'full';
          } else {
            available = Math.max(0, limit - reserved);
            status = (available <= 0) ? 'full'
                  : (available/limit <= 0.3) ? 'limited'
                  : 'available';
          }
        }
        
        slots[hhmm] = { limit, reserved, available, status };
      }
    } catch (slotError) {
      console.error('[capacity] slot generation error', { err: slotError.message, stack: slotError.stack });
      throw slotError;
    }

    const warnings = [];
    if (rerr) warnings.push('reservations-error');
    if (derr) warnings.push('rules-error');

    return res.json({ 
      ok: true, 
      store_id: storeId, 
      date: dateISO, 
      slots, 
      debug: { 
        weekday, 
        reservations: reservations?.length || 0, 
        rules: rules?.length || 0,
        warnings: warnings.length > 0 ? warnings : undefined
      } 
    });
  } catch (e) {
    console.error('[capacity] exception', { ...trace, err: String(e?.message || e), stack: e?.stack });
    return okEmpty({ warn: 'exception', error: String(e?.message || e) });
  }
});

// GET endpoint for capacity rules
app.get('/api/capacity-rules', async (req, res) => {
  try {
    const storeId = req.query.store_id;
    console.log('[GET /api/capacity-rules] Fetching rules for store:', storeId || 'ALL');
    
    // Get capacity rules from database
    let query = supabaseAdmin
      .from('capacity_control_rules')
      .select('*');
    
    // Filter by store_id only if specified and not 'all'
    if (storeId && storeId !== 'all') {
      query = query.eq('store_id', storeId);
    }
    
    const { data, error } = await query.order('date', { ascending: true });
    
    if (error) {
      console.error('[GET /api/capacity-rules] Error:', error);
      return res.json({ 
        success: false, 
        error: error.message 
      });
    }
    
    console.log(`[GET /api/capacity-rules] Found ${data ? data.length : 0} rules`);
    
    return res.json({
      success: true,
      rules: data || []
    });
  } catch (error) {
    console.error('[GET /api/capacity-rules] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST endpoint for capacity rules
app.post('/api/capacity-rules', async (req, res) => {
  try {
    const storeId = req.body.storeId || req.body.store_id || 'default-store';
    const date = req.body.date;
    const rules = req.body.rules || [];
    
    console.log('[POST /api/capacity-rules] Saving rules for store:', storeId, 'date:', date);
    console.log('[POST /api/capacity-rules] Rules:', JSON.stringify(rules));
    
    if (!date || !rules) {
      return res.status(400).json({
        success: false,
        error: 'Date and rules are required'
      });
    }
    
    // Delete existing rules for this store and date
    const { error: deleteError } = await supabaseAdmin
      .from('capacity_control_rules')
      .delete()
      .eq('store_id', storeId)
      .eq('date', date);
    
    if (deleteError) {
      console.error('[POST /api/capacity-rules] Delete error:', deleteError);
      // Continue anyway
    }
    
    // Insert new rules if any
    if (rules.length > 0) {
      const newRules = rules.map(rule => ({
        store_id: storeId,
        control_type: 'time_based',
        date: rule.date || date,
        start_time: (rule.startTime || '00:00') + ':00',
        end_time: (rule.endTime || '23:59') + ':00',
        max_groups: rule.maxGroups || null,
        max_people: rule.maxPeople || null,
        max_per_group: rule.maxPerGroup || null
      }));
      
      console.log('[POST /api/capacity-rules] Inserting rules:', JSON.stringify(newRules));
      
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('capacity_control_rules')
        .insert(newRules);
      
      if (insertError) {
        console.error('[POST /api/capacity-rules] Insert error:', insertError);
        return res.json({
          success: false,
          error: insertError.message
        });
      }
      
      console.log('[POST /api/capacity-rules] Successfully saved rules');
    } else {
      console.log('[POST /api/capacity-rules] No rules to save, cleared existing rules');
    }
    
    return res.json({
      success: true,
      message: 'Capacity rules saved'
    });
    
  } catch (error) {
    console.error('[POST /api/capacity-rules] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/seat-assignments', (req, res) => {
  res.json({
    ok: true,
    reservation_id: req.query.reservation_id,
    seats: [
      { id: 1, name: 'Table 1', status: 'available' },
      { id: 2, name: 'Table 2', status: 'occupied' }
    ]
  });
});

// Capacity rules endpoints - unified in admin API handlers above

// 時間枠取得エンドポイント（LINE予約用）
app.get('/api/slots', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const storeId = req.query.store_id || process.env.STORE_ID || 'default-store';
  
  // 利用可能な時間枠を返す
  const slots = [];
  const times = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', 
                 '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', 
                 '19:00', '19:30', '20:00', '20:30'];
  
  for (const time of times) {
    slots.push({
      time: time,
      available: Math.random() > 0.3,
      remaining: Math.floor(Math.random() * 10)
    });
  }
  
  res.json({ ok: true, slots });
});

// :1付きのエンドポイントも追加（LIFF SDK用）
app.post('/api/reservation:1', async (req, res) => {
  try {
    // 統一ポリシー: すべて store-a を使用
    const storeId = 'store-a';
    const reservation = {
      store_id: storeId,
      date: req.body.date,
      time: req.body.time,
      customer_name: req.body.customer_name || req.body.name || 'LINEユーザー',
      phone: req.body.phone || req.body.customer_phone || null,
      people: Number(req.body.people || req.body.partySize || 1),
      status: 'confirmed',
      message: req.body.message || req.body.notes || null,
      source: 'line'
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select();

    if (error) {
      console.error('Create error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ 
      success: true, 
      reservation: data[0],
      message: '予約が完了しました'
    });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ success: false, error: 'Create failed' });
  }
});

// LINE予約作成エンドポイント
app.post('/api/reservation', async (req, res) => {
  try {
    // 統一ポリシー: すべて store-a を使用
    const storeId = 'store-a';
    const reservation = {
      store_id: storeId,
      date: req.body.date,
      time: req.body.time,
      customer_name: req.body.customer_name || req.body.name || 'LINEユーザー',
      phone: req.body.phone || req.body.customer_phone || null,
      people: Number(req.body.people || req.body.partySize || 1),
      status: 'confirmed',
      message: req.body.message || req.body.notes || null,
      source: 'line'
    };

    console.log('Creating reservation:', reservation);

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select();

    if (error) {
      console.error('Create error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ 
      success: true, 
      reservation: data[0],
      message: '予約が完了しました'
    });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ success: false, error: 'Create failed' });
  }
});

app.post('/api/reservation/create', async (req, res) => {
  try {
    // ホスト名から判定して自動的にstore-aを使用
    const host = req.get('host') || '';
    const storeId = req.body.store_id || 
                    (host.includes('line-booking-api') ? 'store-a' : process.env.STORE_ID) || 
                    'store-a';
    const reservation = {
      store_id: storeId,
      date: req.body.date,
      time: req.body.time,
      customer_name: req.body.customer_name || 'Unknown',
      phone: req.body.customer_phone || req.body.phone || null,
      people: Number(req.body.people || 1),
      status: 'confirmed',
      message: req.body.message || null,
      source: 'web'
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert([reservation])
      .select();

    if (error) {
      console.error('Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data: data[0] });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ error: 'Create failed' });
  }
});

// システム設定API
app.get('/api/settings', async (req, res) => {
  try {
    const storeId = req.query.store_id || 'default-store';
    
    // システム設定テーブルから取得
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Get settings error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get settings' });
    }
    
    // デフォルト設定
    const defaultSettings = {
      businessHours: {
        openTime: '10:00',
        closeTime: '20:00',
        closedDays: []
      },
      booking: {
        startDays: 1,
        deadlineHours: 2,
        timeSlotDuration: 30,
        maxGroupSize: 8
      },
      notifications: {
        lineEnabled: true,
        emailEnabled: false,
        sendConfirmation: true,
        sendReminder: true
      },
      store: {
        name: '予約管理システム',
        phone: '03-1234-5678',
        address: '東京都渋谷区',
        bookingMessage: 'ご予約ありがとうございます。'
      }
    };
    
    // データがあれば使用、なければデフォルト
    const settings = data ? data.settings : defaultSettings;
    
    return res.json({ success: true, settings });
  } catch (e) {
    console.error('Get settings error:', e);
    return res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const storeId = req.body.store_id || 'default-store';
    const settings = req.body.settings;
    
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings required' });
    }
    
    // upsert（存在すれば更新、なければ作成）
    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          store_id: storeId,
          settings: settings,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'store_id'
        }
      )
      .select()
      .single();
    
    if (error) {
      console.error('Save settings error:', error);
      return res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
    
    return res.json({ success: true, data });
  } catch (e) {
    console.error('Save settings error:', e);
    return res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on port ${PORT}`);
  // 容量ルール初期化
  await initializeCapacityRules();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
