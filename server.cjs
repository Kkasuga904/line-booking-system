const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DIST_DIR = path.join(__dirname, 'public');

const app = express();
const PORT = process.env.PORT || 8080;

const SUPABASE_URL = process.env.SUPABASE_URL || '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '***REMOVED-ROTATE-CREDENTIAL***';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '***REMOVED-ROTATE-CREDENTIAL***';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// 繧ｵ繝ｼ繝薙せ繝ｭ繝ｼ繝ｫ繧ｭ繝ｼ縺檎┌蜉ｹ縺ｪ縺ｮ縺ｧ縲∽ｸ譎ら噪縺ｫANON繧ｭ繝ｼ繧剃ｽｿ逕ｨ
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('WARNING: Using ANON key for admin operations due to invalid service role key');

console.log('Starting server on port', PORT);
console.log('Supabase URL:', SUPABASE_URL);

// 螳ｹ驥上Ν繝ｼ繝ｫ繝・・ｽE繝悶Ν蛻晄悄蛹・
async function initializeCapacityRules() {
  try {
    // 18:00-21:00繧・邨・・ｽ・ｽ髯舌↓縺吶ｋ繧ｵ繝ｳ繝励Ν繝ｫ繝ｼ繝ｫ謖ｿ蜈･
    const { error } = await supabaseAdmin
      .from('capacity_control_rules')
      .upsert([
        {
          store_id: '***REMOVED-ROTATE-CREDENTIAL***',
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
      console.log('笨・Capacity rules initialized: 18:00-21:00 = 1 group limit');
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
        .eq('store_id', '***REMOVED-ROTATE-CREDENTIAL***')
        .eq('date', date);
      
      if (!error && data && data.length > 0) {
        const rules = data.map(row => ({
          time: row.time,
          limit: row.limit,
          status: row.status || 'available'
        }));
        
        const key = `***REMOVED-ROTATE-CREDENTIAL***_${date}`;
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
app.use('/js', (req, res, next) => {
  res.set('Content-Type', 'application/javascript; charset=UTF-8');
  res.set('Cache-Control', 'no-store, must-revalidate');
  next();
});
app.use(express.static(DIST_DIR));

app.get('/debug/asset-hash', (req, res) => {
  try {
    const file = (req.query.file || 'js/liff-booking-page.js').toString();
    const sanitized = file.replace(/^\/+/,'');
    const target = path.resolve(DIST_DIR, sanitized);
    const relative = path.relative(DIST_DIR, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(400).json({ error: 'invalid_path', file });
    }
    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: 'not_found', file });
    }
    const buffer = fs.readFileSync(target);
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    res.json({ file: sanitized || 'js/liff-booking-page.js', bytes: buffer.length, sha1 });
  } catch (error) {
    res.status(500).json({ error: 'hash_failed', message: String(error) });
  }
});


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
  // admin-simple.html縺ｸ縺ｮ繧｢繧ｯ繧ｻ繧ｹ繧ゅき繝ｬ繝ｳ繝繝ｼ縺ｫ繝ｪ繝繧､繝ｬ繧ｯ繝・  res.redirect('/admin-full-featured.html');
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
    html = html.replace(/2006487876-Xd1A5qJB/g, '***REMOVED-ROTATE-CREDENTIAL***');
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

// LIFF逕ｨ險ｭ螳壹お繝ｳ繝会ｿｽE繧､繝ｳ繝・app.get('/api/config:1', (req, res) => {
  res.json({
    liffId: process.env.LIFF_ID || '2006487876-Xd1A5qJB',
    apiUrl: process.env.API_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app',
    storeId: process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***',
    storeName: 'Demo Restaurant',
    businessHours: {
      open: '11:00',
      close: '21:00'
    }
  });
});

// LIFF ContextToken 繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ・IFF SDK逕ｨ・ｽE・ｽEapp.post('/api/liff/v2/contextToken:1', (req, res) => {
  res.json({
    contextToken: 'dummy-context-token-' + Date.now(),
    expires_in: 3600
  });
});

// 騾壼ｸｸ縺ｮconfig・ｽE・ｽE1縺ｪ縺暦ｼ・app.get('/api/config', (req, res) => {
  // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
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
    // 邂｡逅・・ｽ・ｽ髱｢繧Ｔtore-a繧偵ョ繝輔か繝ｫ繝医↓
    const storeId = req.query.store_id || 'store-a';
    
    // DB謗･邯壹ユ繧ｹ繝・    if (action === 'test_db') {
      try {
        const { data, error } = await supabase
          .from('capacity_control_rules')
          .select('count')
          .limit(1);
        
        if (error) {
          return res.json({ 
            success: false, 
            error: 'DB謗･邯壹お繝ｩ繝ｼ',
            details: error.message 
          });
        }
        
        return res.json({ 
          success: true, 
          message: 'DB謗･邯夲ｿｽE蜉・,
          table: 'capacity_control_rules' 
        });
      } catch (error) {
        return res.json({ 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // 逕溘ョ繝ｼ繧ｿ蜿門ｾ・    if (action === 'get_raw_capacity_rules') {
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
        
        // 莉頑律縺ｮ譌･莉倥→豈碑ｼ・        const today = new Date().toISOString().slice(0, 10);
        const todayRules = data.filter(r => r.date === today);
        const sep7Rules = data.filter(r => r.date === '2025-09-07');
        
        console.log(`[get_raw_capacity_rules] Total: ${data.length}, Today: ${todayRules.length}, Sep7: ${sep7Rules.length}`);
        
        return res.json({ 
          success: true,
          totalRules: data.length,
          todayRules: todayRules,
          sep7Rules: sep7Rules,
          rules: data,
          message: `蜈ｨ${data.length}莉ｶ縺ｮ繝ｫ繝ｼ繝ｫ縲∽ｻ頑律${todayRules.length}莉ｶ縲・/7: ${sep7Rules.length}莉ｶ`
        });
      } catch (error) {
        return res.json({ 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // action=capacity 縺ｮ蝣ｴ蜷医∝ｮｹ驥上Ν繝ｼ繝ｫ繧定ｿ斐☆
    if (action === 'capacity') {
      try {
        // Get all capacity rules for this store
        const { data, error } = await supabase
          .from('capacity_control_rules')
          .select('*')
          .order('date', { ascending: true });
        
        console.log(`[capacity] 蜿門ｾ励＠縺溘Ν繝ｼ繝ｫ謨ｰ: ${data ? data.length : 0}`);
        if (data && data.length > 0) {
          const sep7Rule = data.find(r => r.date === '2025-09-07');
          if (sep7Rule) {
            console.log('[capacity] 9譛・譌･縺ｮ繝ｫ繝ｼ繝ｫ:', sep7Rule);
          }
        }
        
        if (error) {
          console.error('Error fetching capacity rules:', error);
          return res.json({ success: false, error: error.message });
        }
        
        // Convert to the format expected by the frontend
        // 螳滄圀縺ｮ繝・・ｽE繝悶Ν讒矩縺ｫ蝓ｺ縺･縺・・ｽ・ｽ蜃ｦ逅・        const rules = (data || []).map(row => {
          // start_time縺ｨend_time繧ｫ繝ｩ繝縺九ｉ譎る俣繧貞叙蠕・          const startTime = row.start_time ? row.start_time.substring(0, 5) : '18:00';
          const endTime = row.end_time ? row.end_time.substring(0, 5) : '21:00';
          
          return {
            id: row.id,
            date: row.date,
            startTime: startTime,
            endTime: endTime,
            maxGroups: 1,  // 繝・・ｽ・ｽ繧ｩ繝ｫ繝医〒1邨・・ｽ・ｽ髯・            maxPeople: null,
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
    
    // action=list縺ｮ蝣ｴ蜷医ｂ蜷ｫ繧√※縲∽ｺ育ｴ・・ｽ・ｽ隕ｧ繧定ｿ斐☆
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

      // 繝・・ｽE繧ｿ蠖｢蠑上ｒ邂｡逅・・ｽ・ｽ髱｢縺ｫ蜷医ｏ縺帙ｋ
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
      // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
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
      // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
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
      
      // supabaseAdmin縺ｮ遒ｺ隱・      if (!supabaseAdmin) {
        console.error('supabaseAdmin is not initialized!');
        return res.json({ success: false, error: 'Database connection not initialized' });
      }
      
      const storeId = req.body.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
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
        // start_time縺ｨend_time繧ｫ繝ｩ繝縺ｫ逶ｴ謗･菫晏ｭ・        const newRules = dateRules.map(rule => ({
          store_id: storeId,  // store_id繧定ｿｽ蜉
          control_type: 'time_based',  // control_type繧定ｿｽ蜉・ｽE・ｽ蠢・・ｽ・ｽ繧ｫ繝ｩ繝・ｽE・ｽE          date: rule.date,
          start_time: rule.startTime + ':00',  // HH:mm:ss蠖｢蠑上↓螟画鋤
          end_time: rule.endTime + ':00',      // HH:mm:ss蠖｢蠑上↓螟画鋤
          max_groups: rule.maxGroups || null,
          max_people: rule.maxPeople || null,
          max_per_group: rule.maxPerGroup || null,
          start_date: null,
          end_date: null,
          weekday: null
        }));
        
        if (newRules.length > 0) {
          console.log('Inserting rules:', JSON.stringify(newRules));
          
          // 縺ｾ縺壹ユ繝ｼ繝悶Ν縺ｮ蟄伜惠繧堤｢ｺ隱・          const { data: tableCheck, error: tableError } = await supabaseAdmin
            .from('capacity_control_rules')
            .select('*')
            .limit(1);
          
          if (tableError) {
            console.error('Table access error:', tableError);
            console.error('Table error details:', JSON.stringify(tableError));
            
            // API繧ｭ繝ｼ繧ｨ繝ｩ繝ｼ縺ｮ蝣ｴ蜷・            if (tableError.message && tableError.message.includes('API key')) {
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
      // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
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
    const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';

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
      store_id: req.query.store_id || '***REMOVED-ROTATE-CREDENTIAL***',
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
    
    // 繝・・ｽE繧ｿ繝呻ｿｽE繧ｹ縺九ｉ隧ｲ蠖捺律縺ｮ莠育ｴ・・ｽ・ｽ蜿門ｾ・    const { data: reservations, error } = await supabase
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
  const storeId = String(req.query.store_id || req.headers['x-store-id'] || '***REMOVED-ROTATE-CREDENTIAL***');
  const dateISO = String(req.query.date || '').slice(0, 10); // 'YYYY-MM-DD'
  const trace = { storeId, dateISO, rev: process.env.K_REVISION || 'dev' };

  // 螟ｱ謨励＠縺ｦ繧・UI 繧呈ｭ｢繧√↑縺・  function okEmpty(extra = {}) {
    return res.json({ ok: true, store_id: storeId, date: dateISO, slots: {}, ...extra });
  }

  // 蜈･蜉帙ヰ繝ｪ繝・・ｽE繧ｷ繝ｧ繝ｳ
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    console.warn('[capacity] invalid-date', trace);
    return okEmpty({ warn: 'invalid-date' });
  }

  if (!supabaseAdmin) {
    console.error('[capacity] supabase-init-failed', trace);
    return okEmpty({ warn: 'supabase-init-failed' });
  }

  try {
    // 1) 莠育ｴ・・ｽ・ｽ險茨ｼ医く繝｣繝ｳ繧ｻ繝ｫ莉･螟厄ｼ・    let reservations = [];
    const { data: resData, error: rerr } = await supabaseAdmin
      .from('reservations')
      .select('time, people, status')
      .eq('store_id', storeId)
      .eq('date', dateISO)
      .or('status.is.null,status.neq.canceled'); // 竊・PostgREST縺ｮ or 讒区枚
    if (rerr) {
      console.error('[capacity] reservations-error', { ...trace, err: rerr });
      // Continue with empty reservations instead of returning early
      reservations = [];
    } else {
      reservations = resData || [];
    }

    // 2) 繝ｫ繝ｼ繝ｫ蜿門ｾ暦ｼ・apacity_control_rules繝・・ｽE繝悶Ν縺九ｉ・ｽE・ｽE    const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // TZ繧ｺ繝ｬ髦ｲ豁｢
    let rules = [];
    const { data: rulesData, error: derr } = await supabaseAdmin
      .from('capacity_control_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', dateISO);  // store_id縺ｨdate繧ｫ繝ｩ繝繧剃ｽｿ逕ｨ
    if (derr) {
      console.error('[capacity] rules-error', { ...trace, err: derr });
      // Continue with empty rules, temporary override will still work
      rules = [];
    } else {
      rules = rulesData || [];
    }

    // 3) 髮・・ｽ・ｽE    const reservedByTime = {};
    for (const r of reservations || []) {
      const t = (r.time || '').slice(0, 5); // 'HH:mm'
      if (!t) continue;
      const add = 1; // 邨・・ｽ・ｽ縲ゆｺｺ謨ｰ繝呻ｿｽE繧ｹ縺ｫ縺吶ｋ縺ｪ繧・Number(r.people||0)
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
      // capacity_control_rules繝・・ｽE繝悶Ν縺九ｉ繝ｫ繝ｼ繝ｫ繧帝←逕ｨ
      // start_time縺ｨend_time繧ｫ繝ｩ繝繧堤峩謗･菴ｿ逕ｨ
      for (const rule of rules) {
        if (!rule.start_time || !rule.end_time) continue;
        
        // 譎る俣遽・・ｽ・ｽ繧偵メ繧ｧ繝・・ｽ・ｽ (HH:mm:ss蠖｢蠑上ｒHH:mm蠖｢蠑上↓螟画鋤)
        const startTime = rule.start_time.substring(0, 5);
        const endTime = rule.end_time.substring(0, 5);
        
        if (hhmm >= startTime && hhmm <= endTime) {
          // max_groups繧ｫ繝ｩ繝縺ｮ蛟､繧剃ｽｿ逕ｨ・ｽE・ｽEull縺ｮ蝣ｴ蜷茨ｿｽE蛻ｶ髯舌↑縺暦ｼ・          return rule.max_groups || null;
        }
      }
      
      // 證ｫ螳壹が繝ｼ繝撰ｿｽE繝ｩ繧､繝会ｼ亥霧讌ｭ蜆ｪ蜈茨ｼ・ 繝ｫ繝ｼ繝ｫ縺後↑縺・・ｽ・ｽ蜷茨ｿｽE縺ｿ
      if (hhmm >= '18:00' && hhmm < '21:00' && storeId === '***REMOVED-ROTATE-CREDENTIAL***' && rules.length === 0) {
        return 1;
      }
      return null; // 繝ｫ繝ｼ繝ｫ辟｡縺代ｌ縺ｰ譛ｪ險ｭ螳・    };

    // 4) 蛻ｶ髯先凾髢灘ｸｯ蛻･縺ｮ莠育ｴ・・ｽ・ｽ謨ｰ繧定ｨ育ｮ・    const ruleReservedTotals = {};
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
          available = 999; status = 'available'; // 繝ｫ繝ｼ繝ｫ譛ｪ險ｭ螳夲ｿｽE邱・        } else {
          // 隧ｲ蠖薙☆繧句宛髯先凾髢灘ｸｯ繧定ｦ九▽縺代※縲√◎縺ｮ譎る俣蟶ｯ蜈ｨ菴難ｿｽE莠育ｴ・・ｽ・ｽ繧偵メ繧ｧ繝・・ｽ・ｽ
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
    const storeId = req.body.storeId || req.body.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
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

// 譎る俣譫蜿門ｾ励お繝ｳ繝会ｿｽE繧､繝ｳ繝茨ｼ・INE莠育ｴ・・ｽ・ｽ・ｽE・ｽEapp.get('/api/slots', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const storeId = req.query.store_id || process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  
  // 蛻ｩ逕ｨ蜿ｯ閭ｽ縺ｪ譎る俣譫繧定ｿ斐☆
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

// :1莉倥″縺ｮ繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝医ｂ霑ｽ蜉・ｽE・ｽEIFF SDK逕ｨ・ｽE・ｽEapp.post('/api/reservation:1', async (req, res) => {
  try {
    // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
    const storeId = 'store-a';
    const reservation = {
      store_id: storeId,
      date: req.body.date,
      time: req.body.time,
      customer_name: req.body.customer_name || req.body.name || 'LINE繝ｦ繝ｼ繧ｶ繝ｼ',
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
      message: '莠育ｴ・・ｽ・ｽ螳御ｺ・・ｽ・ｽ縺ｾ縺励◆'
    });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ success: false, error: 'Create failed' });
  }
});

// LINE莠育ｴ・・ｽ・ｽ・ｽE繧ｨ繝ｳ繝会ｿｽE繧､繝ｳ繝・app.post('/api/reservation', async (req, res) => {
  try {
    // 邨ｱ荳繝昴Μ繧ｷ繝ｼ: 縺吶∋縺ｦ store-a 繧剃ｽｿ逕ｨ
    const storeId = 'store-a';
    const reservation = {
      store_id: storeId,
      date: req.body.date,
      time: req.body.time,
      customer_name: req.body.customer_name || req.body.name || 'LINE繝ｦ繝ｼ繧ｶ繝ｼ',
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
      message: '莠育ｴ・・ｽ・ｽ螳御ｺ・・ｽ・ｽ縺ｾ縺励◆'
    });
  } catch (e) {
    console.error('Create error:', e);
    return res.status(500).json({ success: false, error: 'Create failed' });
  }
});

app.post('/api/reservation/create', async (req, res) => {
  try {
    // 繝帙せ繝亥錐縺九ｉ蛻､螳壹＠縺ｦ閾ｪ蜍慕噪縺ｫstore-a繧剃ｽｿ逕ｨ
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

// 繧ｷ繧ｹ繝・・ｽ・ｽ險ｭ螳哂PI
app.get('/api/settings', async (req, res) => {
  try {
    const storeId = req.query.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
    
    // 繧ｷ繧ｹ繝・・ｽ・ｽ險ｭ螳壹ユ繝ｼ繝悶Ν縺九ｉ蜿門ｾ・    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Get settings error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get settings' });
    }
    
    // 繝・・ｽ・ｽ繧ｩ繝ｫ繝郁ｨｭ螳・    const defaultSettings = {
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
        name: '莠育ｴ・・ｽ・ｽ逅・・ｽ・ｽ繧ｹ繝・・ｽ・ｽ',
        phone: '03-1234-5678',
        address: '譚ｱ莠ｬ驛ｽ貂玖ｰｷ蛹ｺ',
        bookingMessage: '縺比ｺ育ｴ・・ｽ・ｽ繧翫′縺ｨ縺・・ｽ・ｽ縺悶＞縺ｾ縺吶・
      }
    };
    
    // 繝・・ｽE繧ｿ縺後≠繧鯉ｿｽE菴ｿ逕ｨ縲√↑縺代ｌ縺ｰ繝・・ｽ・ｽ繧ｩ繝ｫ繝・    const settings = data ? data.settings : defaultSettings;
    
    return res.json({ success: true, settings });
  } catch (e) {
    console.error('Get settings error:', e);
    return res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const storeId = req.body.store_id || '***REMOVED-ROTATE-CREDENTIAL***';
    const settings = req.body.settings;
    
    if (!settings) {
      return res.status(400).json({ success: false, error: 'Settings required' });
    }
    
    // upsert・ｽE・ｽ蟄伜惠縺吶ｌ縺ｰ譖ｴ譁ｰ縲√↑縺代ｌ縺ｰ菴懶ｿｽE・ｽE・ｽE    const { data, error } = await supabase
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



