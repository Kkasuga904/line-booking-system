// GCP Cloud Run用統合サーバー
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

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
  res.json({ 
    ok: true, 
    ts: Date.now(),
    version: '2.0.0-gcp',
    environment: NODE_ENV
  });
});

// ==========================================
// 2. LINE Webhook（即応答 + 非同期処理）
// ==========================================
app.post('/webhook', async (req, res) => {
  // 即座に200を返す（LINE要件）
  res.status(200).end();
  
  // 非同期でイベント処理
  setImmediate(async () => {
    try {
      const events = req.body?.events || [];
      for (const event of events) {
        await handleLineEvent(event);
      }
    } catch (error) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        message: 'Webhook processing failed',
        error: error.message,
        stack: error.stack
      }));
    }
  });
});

// LINE イベント処理
async function handleLineEvent(event) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const liffId = process.env.LIFF_ID || '2006487876-xd1A5qJB';
  const liffUrl = `https://liff.line.me/${liffId}`;

  if (!token || !event.replyToken) return;

  let replyMessage = '';
  
  if (event.type === 'follow') {
    replyMessage = `友だち追加ありがとうございます！\n\n【ご予約はこちら】\n📱 ${liffUrl}`;
  } else if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.toLowerCase();
    if (text.includes('予約')) {
      replyMessage = `ご予約はこちらから：\n📱 ${liffUrl}`;
    } else {
      replyMessage = `メッセージありがとうございます！\n予約は以下から：\n📱 ${liffUrl}`;
    }
  }
  
  if (replyMessage) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyMessage }]
      })
    });
  }
}

// ==========================================
// 3. 統合APIルーター
// ==========================================
app.all('/api/router', async (req, res) => {
  const act = req.query.act || req.body?.act;
  
  try {
    switch (act) {
      case 'create_reservation':
        return await createReservation(req, res);
      case 'get_slots':
        return await getSlots(req, res);
      case 'check_availability':
        return await checkAvailability(req, res);
      case 'list_reservations':
        return await listReservations(req, res);
      case 'manage_seats':
        return await manageSeats(req, res);
      default:
        return res.status(400).json({ error: 'unknown action', act });
    }
  } catch (error) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      action: act,
      error: error.message
    }));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 予約作成
async function createReservation(req, res) {
  const { date, time, customer_name, phone, seats, menu, user_id } = req.body;
  
  const { data, error } = await supabase
    .from('reservations')
    .insert([{
      store_id: process.env.STORE_ID || 'default-store',
      date,
      time,
      customer_name,
      phone,
      number_of_people: seats || 1,
      menu_items: menu,
      user_id: user_id || 'api-user',
      status: 'confirmed',
      created_at: new Date().toISOString()
    }])
    .select();
  
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  
  res.json({ success: true, reservation: data[0] });
}

// 予約スロット取得
async function getSlots(req, res) {
  const { date } = req.query;
  
  const { data, error } = await supabase
    .from('reservations')
    .select('time, number_of_people')
    .eq('store_id', process.env.STORE_ID || 'default-store')
    .eq('date', date)
    .eq('status', 'confirmed');
  
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  
  // 時間帯ごとの予約状況を集計
  const slots = {};
  for (let hour = 9; hour <= 20; hour++) {
    for (let min of ['00', '30']) {
      const time = `${hour.toString().padStart(2, '0')}:${min}`;
      const reserved = data.filter(r => r.time === time)
        .reduce((sum, r) => sum + r.number_of_people, 0);
      slots[time] = {
        available: 20 - reserved, // 最大20席と仮定
        reserved
      };
    }
  }
  
  res.json({ date, slots });
}

// 空席確認
async function checkAvailability(req, res) {
  const { date, time, seats } = req.query;
  
  const { data, error } = await supabase
    .from('reservations')
    .select('number_of_people')
    .eq('store_id', process.env.STORE_ID || 'default-store')
    .eq('date', date)
    .eq('time', time)
    .eq('status', 'confirmed');
  
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  
  const totalReserved = data.reduce((sum, r) => sum + r.number_of_people, 0);
  const available = 20 - totalReserved >= parseInt(seats || 1);
  
  res.json({ available, remaining: 20 - totalReserved });
}

// 予約一覧取得
async function listReservations(req, res) {
  const { date, limit = 50 } = req.query;
  
  let query = supabase
    .from('reservations')
    .select('*')
    .eq('store_id', process.env.STORE_ID || 'default-store')
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(limit);
  
  if (date) {
    query = query.eq('date', date);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  
  res.json({ reservations: data, count: data.length });
}

// 席管理
async function manageSeats(req, res) {
  const { action, date, seats } = req.body;
  
  // 簡易的な実装（実際はより複雑な席管理が必要）
  if (action === 'set_capacity') {
    // キャパシティ設定をSupabaseに保存
    const { data, error } = await supabase
      .from('seat_capacity')
      .upsert([{
        store_id: process.env.STORE_ID || 'default-store',
        date,
        total_seats: seats,
        updated_at: new Date().toISOString()
      }]);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ success: true, capacity: seats });
  } else {
    res.status(400).json({ error: 'unknown action' });
  }
}

// ==========================================
// 4. 管理画面
// ==========================================
app.get('/admin', (req, res) => {
  // Basic認証（簡易実装）
  const auth = req.headers.authorization;
  if (process.env.ADMIN_BASIC_USER) {
    const credentials = Buffer.from(auth?.split(' ')[1] || '', 'base64').toString();
    const [user, pass] = credentials.split(':');
    
    if (user !== process.env.ADMIN_BASIC_USER || pass !== process.env.ADMIN_BASIC_PASS) {
      res.status(401).set('WWW-Authenticate', 'Basic realm="Admin"').send('Unauthorized');
      return;
    }
  }
  
  // 管理画面HTMLを返す
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
app.listen(PORT, () => {
  console.log(JSON.stringify({
    severity: 'INFO',
    message: 'Server started',
    port: PORT,
    environment: NODE_ENV,
    version: '2.0.0-gcp',
    timestamp: new Date().toISOString()
  }));
});

const PORT = process.env.PORT || 3001;

// MIMEタイプ
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// サーバー作成
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // ルーティング
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // APIエンドポイント
  if (pathname.startsWith('/api/')) {
    handleAPI(pathname, req, res);
    return;
  }
  
  // 静的ファイル配信
  let filePath = path.join(__dirname, pathname);
  
  // admin-send.htmlへの直接アクセスを許可
  if (pathname === '/admin-send.html') {
    filePath = path.join(__dirname, 'admin-send.html');
  }
  
  // restaurant-admin.htmlへの直接アクセスを許可
  if (pathname === '/restaurant-admin.html' || pathname === '/restaurant') {
    filePath = path.join(__dirname, 'restaurant-admin.html');
  }
  
  // admin-dashboard.htmlへの直接アクセスを許可
  if (pathname === '/admin-dashboard.html') {
    filePath = path.join(__dirname, 'admin-dashboard.html');
  }
  
  // seat-config.htmlへの直接アクセスを許可
  if (pathname === '/seat-config.html' || pathname === '/seat-config') {
    filePath = path.join(__dirname, 'seat-config.html');
  }
  
  // service-flow.htmlへの直接アクセスを許可
  if (pathname === '/service-flow.html' || pathname === '/service-flow') {
    filePath = path.join(__dirname, 'service-flow.html');
  }
  
  // ファイル読み込み
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - ページが見つかりません</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      const ext = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    }
  });
});

// API処理
function handleAPI(pathname, req, res) {
  const parsedUrl = url.parse(req.url, true);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 店舗一覧
  if (pathname === '/api/stores') {
    const configDir = path.join(__dirname, 'config');
    
    if (!fs.existsSync(configDir)) {
      res.writeHead(200);
      res.end(JSON.stringify({ stores: [] }));
      return;
    }
    
    const files = fs.readdirSync(configDir)
      .filter(file => file.endsWith('.env') && file !== 'template.env');
    
    const stores = files.map(file => {
      const storeId = file.replace('.env', '');
      const configPath = path.join(configDir, file);
      const content = fs.readFileSync(configPath, 'utf8');
      
      const config = {};
      content.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            config[key.trim()] = value.trim();
          }
        }
      });
      
      // デプロイ情報
      const deployPath = path.join(__dirname, 'deployments', `${storeId}.json`);
      let deployInfo = null;
      if (fs.existsSync(deployPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
      }
      
      return {
        storeId,
        storeName: config.STORE_NAME || '未設定',
        businessHours: config.BUSINESS_HOURS || '未設定',
        closedDays: config.CLOSED_DAYS || '未設定',
        deployed: !!deployInfo,
        url: deployInfo?.url || null,
        deployedAt: deployInfo?.deployedAt || null
      };
    });
    
    res.writeHead(200);
    res.end(JSON.stringify({ stores }));
    
  // 予約データ取得・保存
  } else if (pathname === '/api/reservations') {
    const dataFile = path.join(__dirname, 'data', 'reservations.json');
    
    if (req.method === 'GET') {
      // 予約データ取得
      if (!fs.existsSync(dataFile)) {
        fs.mkdirSync(path.dirname(dataFile), { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify({ reservations: [] }));
      }
      
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      res.writeHead(200);
      res.end(JSON.stringify(data));
      
    } else if (req.method === 'POST') {
      // 予約データ保存
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const newReservation = JSON.parse(body);
          
          if (!fs.existsSync(dataFile)) {
            fs.mkdirSync(path.dirname(dataFile), { recursive: true });
            fs.writeFileSync(dataFile, JSON.stringify({ reservations: [] }));
          }
          
          const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
          
          // 予約に必要な情報を追加
          newReservation.id = `R${Date.now()}`;
          newReservation.createdAt = new Date().toISOString();
          newReservation.status = newReservation.status || 'confirmed';
          
          data.reservations.push(newReservation);
          
          // 最新の50件のみ保持
          if (data.reservations.length > 50) {
            data.reservations = data.reservations.slice(-50);
          }
          
          fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
          
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, reservation: newReservation }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else if (req.method === 'DELETE') {
      // 予約削除
      const urlParts = pathname.split('/');
      const reservationId = urlParts[urlParts.length - 1];
      
      if (reservationId && reservationId !== 'reservations') {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        data.reservations = data.reservations.filter(r => r.id !== reservationId);
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Reservation ID required' }));
      }
    }
    
  // 統計情報
  } else if (pathname === '/api/stats') {
    const stats = {
      totalStores: 0,
      activeStores: 0,
      totalReservations: 150,
      todayReservations: 12,
      thisMonthReservations: 89,
      cancelRate: 8.5
    };
    
    // 実際の店舗数を計算
    const configDir = path.join(__dirname, 'config');
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir)
        .filter(file => file.endsWith('.env') && file !== 'template.env');
      stats.totalStores = files.length;
      
      // デプロイ済み店舗数
      const deploymentsDir = path.join(__dirname, 'deployments');
      if (fs.existsSync(deploymentsDir)) {
        stats.activeStores = fs.readdirSync(deploymentsDir)
          .filter(file => file.endsWith('.json')).length;
      }
    }
    
    res.writeHead(200);
    res.end(JSON.stringify(stats));
    
  // 席配置の保存・読み込み
  } else if (pathname === '/api/seat-layout') {
    const layoutFile = path.join(__dirname, 'data', 'seat-layouts.json');
    
    if (req.method === 'GET') {
      // 席配置を取得
      const storeId = parsedUrl.query.storeId || 'default';
      
      if (!fs.existsSync(layoutFile)) {
        res.writeHead(200);
        res.end(JSON.stringify({ layout: null }));
        return;
      }
      
      const layouts = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
      res.writeHead(200);
      res.end(JSON.stringify({ layout: layouts[storeId] || null }));
      
    } else if (req.method === 'POST') {
      // 席配置を保存
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { storeId, layout } = data;
          
          if (!fs.existsSync(path.dirname(layoutFile))) {
            fs.mkdirSync(path.dirname(layoutFile), { recursive: true });
          }
          
          let layouts = {};
          if (fs.existsSync(layoutFile)) {
            layouts = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
          }
          
          layouts[storeId] = layout;
          fs.writeFileSync(layoutFile, JSON.stringify(layouts, null, 2));
          
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    }
    
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }
}

// モック予約データ生成
function generateMockReservations() {
  const statuses = ['confirmed', 'cancelled', 'pending'];
  const stores = ['store-001', 'store-002', 'store-003'];
  const names = ['田中様', '佐藤様', '鈴木様', '高橋様', '渡辺様'];
  
  return Array.from({ length: 20 }, (_, i) => {
    const date = new Date();
    date.setHours(date.getHours() - Math.random() * 168); // 過去1週間
    
    return {
      id: `R${Date.now() - i * 100000}`,
      storeId: stores[Math.floor(Math.random() * stores.length)],
      customerName: names[Math.floor(Math.random() * names.length)],
      timestamp: date.toISOString(),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      service: ['カット', 'カラー', 'パーマ', 'トリートメント'][Math.floor(Math.random() * 4)],
      amount: Math.floor(Math.random() * 10000) + 3000
    };
  });
}

// サーバー起動
server.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('   🚀 LINE Bot 管理サーバー起動');
  console.log('===========================================');
  console.log('');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 利用可能なページ:');
  console.log(`   統合管理画面: http://localhost:${PORT}/`);
  console.log(`   ダッシュボード: http://localhost:${PORT}/admin-dashboard.html`);
  console.log(`   飲食店席管理: http://localhost:${PORT}/restaurant-admin.html`);
  console.log(`   メッセージ送信: http://localhost:${PORT}/admin-send.html`);
  console.log('');
  console.log('📡 APIエンドポイント:');
  console.log(`   店舗一覧: http://localhost:${PORT}/api/stores`);
  console.log(`   予約一覧: http://localhost:${PORT}/api/reservations`);
  console.log(`   統計情報: http://localhost:${PORT}/api/stats`);
  console.log('');
  console.log('停止: Ctrl+C');
  console.log('===========================================');
});