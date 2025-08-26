/**
 * LINE Bot 管理サーバー
 * ローカルで管理画面を起動
 * 
 * 起動方法:
 * node server.js
 * 
 * アクセス:
 * http://localhost:3001
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

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