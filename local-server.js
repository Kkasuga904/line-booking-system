/**
 * キャパシティ管理システム ローカルテストサーバー
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// 環境変数のモック設定
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-key-for-testing';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

const PORT = 3000;

// メモリ内データストア（簡易DB）
const dataStore = {
  rules: [
    {
      id: 'rule-001',
      store_id: 'restaurant-002',
      description: '週末ランチタイム: 1時間3件まで',
      weekdays: [0, 6],
      time_start: '11:00',
      time_end: '15:00',
      limit_type: 'per_hour',
      limit_value: 3,
      active: true,
      created_at: new Date().toISOString()
    }
  ],
  reservations: []
};

// HTTPサーバー
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  console.log(`${req.method} ${pathname}`);
  
  // ルートページ
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getIndexHTML());
    return;
  }
  
  // API: キャパシティ管理
  if (pathname === '/api/capacity') {
    await handleCapacityAPI(req, res, parsedUrl.query);
    return;
  }
  
  // API: Webhookシミュレーション
  if (pathname === '/api/webhook') {
    await handleWebhookAPI(req, res);
    return;
  }
  
  // API: 予約
  if (pathname === '/api/reservation') {
    await handleReservationAPI(req, res);
    return;
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// キャパシティAPI処理
async function handleCapacityAPI(req, res, query) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'GET') {
    const action = query.action || 'list';
    
    if (action === 'rules' || action === 'list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        rules: dataStore.rules,
        total: dataStore.rules.length
      }));
    } else if (action === 'stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        stats: [
          {
            rule: dataStore.rules[0],
            current_count: dataStore.reservations.length,
            limit_value: 3,
            utilization: dataStore.reservations.length / 3
          }
        ]
      }));
    }
  } else if (req.method === 'POST') {
    const body = await getRequestBody(req);
    
    if (body.command) {
      const result = processCommand(body.command);
      
      if (result.rule) {
        result.rule.id = 'rule-' + Date.now();
        result.rule.created_at = new Date().toISOString();
        result.rule.active = true;
        dataStore.rules.push(result.rule);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }
  } else if (req.method === 'DELETE') {
    const ruleId = query.rule_id;
    if (ruleId) {
      dataStore.rules = dataStore.rules.filter(r => r.id !== ruleId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'ルールを削除しました' }));
    }
  }
}

// Webhook API処理
async function handleWebhookAPI(req, res) {
  if (req.method === 'POST') {
    const body = await getRequestBody(req);
    const message = body.message || '';
    
    let response = { success: true };
    
    if (message.startsWith('/limit') || message.startsWith('/stop') || message === '/limits') {
      response = processCommand(message);
    } else if (message.includes('予約')) {
      response.reply = '予約はカレンダーからお願いします';
    } else {
      response.reply = 'メッセージを受信しました';
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }
}

// 予約API処理
async function handleReservationAPI(req, res) {
  if (req.method === 'POST') {
    const body = await getRequestBody(req);
    
    // キャパシティチェック
    const validation = validateCapacity(body);
    
    if (!validation.allowed) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Capacity exceeded',
        message: validation.reason
      }));
      return;
    }
    
    // 予約を保存
    const reservation = {
      ...body,
      id: 'R' + Date.now(),
      created_at: new Date().toISOString()
    };
    dataStore.reservations.push(reservation);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      reservation
    }));
  } else if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      reservations: dataStore.reservations
    }));
  }
}

// コマンド処理
function processCommand(text) {
  if (text === '/limits') {
    let message = '📋 現在の制限ルール:\n\n';
    dataStore.rules.forEach((rule, i) => {
      message += `${i+1}. ${rule.description}\n`;
    });
    return { success: true, message, rules: dataStore.rules };
  }
  
  if (text.startsWith('/limit ')) {
    const params = text.substring(7);
    const rule = parseLimit(params);
    return {
      success: true,
      message: `制限ルールを設定しました: ${params}`,
      rule
    };
  }
  
  if (text.startsWith('/stop ')) {
    const params = text.substring(6);
    return {
      success: true,
      message: `予約停止を設定しました: ${params}`,
      rule: {
        description: `予約停止: ${params}`,
        limit_type: 'stop'
      }
    };
  }
  
  return { success: false, error: '未対応のコマンド' };
}

// 制限パラメータ解析
function parseLimit(params) {
  const rule = {
    store_id: 'restaurant-002',
    description: `/limit ${params}`
  };
  
  // 簡易パース
  if (params.includes('today')) {
    rule.date_start = new Date().toISOString().split('T')[0];
    rule.date_end = rule.date_start;
  }
  
  if (params.includes('sat') || params.includes('sun') || params.includes('週末')) {
    rule.weekdays = [0, 6];
  } else if (params.includes('平日')) {
    rule.weekdays = [1, 2, 3, 4, 5];
  }
  
  const timeMatch = params.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    rule.time_start = `${timeMatch[1]}:${timeMatch[2]}`;
    rule.time_end = `${timeMatch[3]}:${timeMatch[4]}`;
  }
  
  const limitMatch = params.match(/(\d+)\/h/);
  if (limitMatch) {
    rule.limit_type = 'per_hour';
    rule.limit_value = parseInt(limitMatch[1]);
  } else {
    const numberMatch = params.match(/(\d+)$/);
    if (numberMatch) {
      rule.limit_type = 'per_day';
      rule.limit_value = parseInt(numberMatch[1]);
    }
  }
  
  return rule;
}

// キャパシティ検証
function validateCapacity(reservation) {
  for (const rule of dataStore.rules) {
    if (!rule.active) continue;
    
    // 時間帯チェック
    if (rule.time_start && rule.time_end) {
      const resTime = reservation.time;
      if (resTime < rule.time_start || resTime > rule.time_end) {
        continue;
      }
    }
    
    // 曜日チェック
    if (rule.weekdays) {
      const resDate = new Date(reservation.date);
      if (!rule.weekdays.includes(resDate.getDay())) {
        continue;
      }
    }
    
    // 制限チェック
    if (rule.limit_type === 'stop') {
      return {
        allowed: false,
        reason: rule.description || '予約停止中'
      };
    }
    
    if (rule.limit_type === 'per_hour') {
      const sameHourReservations = dataStore.reservations.filter(r => 
        r.date === reservation.date && 
        r.time.substring(0, 2) === reservation.time.substring(0, 2)
      );
      
      if (sameHourReservations.length >= rule.limit_value) {
        return {
          allowed: false,
          reason: `${rule.description} (現在${sameHourReservations.length}/${rule.limit_value}件)`
        };
      }
    }
  }
  
  return { allowed: true };
}

// リクエストボディ取得
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch(e) {
        resolve({});
      }
    });
  });
}

// HTMLページ
function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>キャパシティ管理システム - ローカルテスト</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: white;
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 10px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .card h2 {
      color: #667eea;
      margin-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 10px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      color: #555;
      margin-bottom: 5px;
      font-weight: 500;
    }
    input, textarea, select {
      width: 100%;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 25px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      transition: transform 0.2s;
      width: 100%;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
    .result {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      margin-top: 15px;
      max-height: 300px;
      overflow-y: auto;
    }
    .result.success {
      border-color: #28a745;
      background: #d4edda;
    }
    .result.error {
      border-color: #dc3545;
      background: #f8d7da;
    }
    .rule-item {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 3px;
      position: relative;
    }
    .rule-item button {
      position: absolute;
      right: 10px;
      top: 10px;
      width: auto;
      padding: 5px 10px;
      font-size: 12px;
      background: #dc3545;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
    }
    .stat-item {
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      color: #666;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
      font-size: 12px;
    }
    .command-examples {
      background: #f0f8ff;
      border: 1px solid #b8daff;
      border-radius: 5px;
      padding: 15px;
      margin-top: 15px;
    }
    .command-examples h3 {
      color: #004085;
      margin-bottom: 10px;
    }
    .command-examples code {
      display: block;
      background: white;
      padding: 5px;
      margin: 5px 0;
      border-left: 3px solid #667eea;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 キャパシティ管理システム</h1>
    
    <div class="grid">
      <!-- LINEコマンド送信 -->
      <div class="card">
        <h2>📱 LINEコマンド送信</h2>
        <div class="form-group">
          <label>コマンド入力</label>
          <textarea id="command" rows="3" placeholder="/limit today 20">/limits</textarea>
        </div>
        <button onclick="sendCommand()">コマンド実行</button>
        <div id="commandResult" class="result" style="display:none;"></div>
        
        <div class="command-examples">
          <h3>コマンド例</h3>
          <code>/limits - 現在の制限一覧</code>
          <code>/limit today 20 - 今日の予約を20件まで</code>
          <code>/limit 週末 11:00-15:00 3/h - 週末ランチ3件/時</code>
          <code>/stop today 18:00- - 今日18時以降停止</code>
        </div>
      </div>
      
      <!-- 予約テスト -->
      <div class="card">
        <h2>📅 予約テスト</h2>
        <div class="form-group">
          <label>日付</label>
          <input type="date" id="resDate" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>時間</label>
          <select id="resTime">
            <option value="11:00">11:00</option>
            <option value="12:00" selected>12:00</option>
            <option value="13:00">13:00</option>
            <option value="14:00">14:00</option>
            <option value="17:00">17:00</option>
            <option value="18:00">18:00</option>
            <option value="19:00">19:00</option>
            <option value="20:00">20:00</option>
          </select>
        </div>
        <div class="form-group">
          <label>名前</label>
          <input type="text" id="resName" value="テスト太郎">
        </div>
        <button onclick="testReservation()">予約を試す</button>
        <div id="reservationResult" class="result" style="display:none;"></div>
      </div>
      
      <!-- 現在の制限ルール -->
      <div class="card">
        <h2>⚙️ 現在の制限ルール</h2>
        <div id="rulesList"></div>
        <button onclick="loadRules()">更新</button>
      </div>
      
      <!-- 統計情報 -->
      <div class="card">
        <h2>📊 統計情報</h2>
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value" id="totalRules">0</div>
            <div class="stat-label">制限ルール</div>
          </div>
          <div class="stat-item">
            <div class="stat-value" id="totalReservations">0</div>
            <div class="stat-label">予約数</div>
          </div>
        </div>
        <div id="statsDetail"></div>
        <button onclick="loadStats()">統計更新</button>
      </div>
    </div>
  </div>
  
  <script>
    // 初期ロード
    window.onload = () => {
      loadRules();
      loadStats();
    };
    
    // コマンド送信
    async function sendCommand() {
      const command = document.getElementById('command').value;
      const resultDiv = document.getElementById('commandResult');
      
      try {
        const response = await fetch('/api/capacity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command })
        });
        
        const result = await response.json();
        
        resultDiv.style.display = 'block';
        if (result.success) {
          resultDiv.className = 'result success';
          resultDiv.innerHTML = '<strong>✅ 成功</strong><br>' + 
            (result.message || 'コマンドを実行しました').replace(/\\n/g, '<br>');
        } else {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '<strong>❌ エラー</strong><br>' + 
            (result.error || 'エラーが発生しました');
        }
        
        // ルール一覧を更新
        if (result.rule || command === '/limits') {
          setTimeout(loadRules, 500);
        }
      } catch (e) {
        resultDiv.style.display = 'block';
        resultDiv.className = 'result error';
        resultDiv.innerHTML = '<strong>❌ エラー</strong><br>' + e.message;
      }
    }
    
    // 予約テスト
    async function testReservation() {
      const date = document.getElementById('resDate').value;
      const time = document.getElementById('resTime').value;
      const name = document.getElementById('resName').value;
      const resultDiv = document.getElementById('reservationResult');
      
      try {
        const response = await fetch('/api/reservation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            time,
            customer_name: name,
            store_id: 'restaurant-002'
          })
        });
        
        const result = await response.json();
        
        resultDiv.style.display = 'block';
        if (response.status === 200) {
          resultDiv.className = 'result success';
          resultDiv.innerHTML = '<strong>✅ 予約可能</strong><br>' + 
            '予約ID: ' + result.reservation.id;
          setTimeout(loadStats, 500);
        } else {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '<strong>❌ 予約不可</strong><br>' + 
            (result.message || 'キャパシティ制限に達しています');
        }
      } catch (e) {
        resultDiv.style.display = 'block';
        resultDiv.className = 'result error';
        resultDiv.innerHTML = '<strong>❌ エラー</strong><br>' + e.message;
      }
    }
    
    // ルール一覧ロード
    async function loadRules() {
      try {
        const response = await fetch('/api/capacity?action=rules');
        const result = await response.json();
        
        const rulesDiv = document.getElementById('rulesList');
        
        if (result.rules && result.rules.length > 0) {
          rulesDiv.innerHTML = result.rules.map(rule => \`
            <div class="rule-item">
              <button onclick="deleteRule('\${rule.id}')">削除</button>
              <strong>\${rule.description}</strong><br>
              <small>
                タイプ: \${rule.limit_type || '-'}<br>
                制限値: \${rule.limit_value || '-'}<br>
                時間: \${rule.time_start || ''} - \${rule.time_end || ''}<br>
                曜日: \${rule.weekdays ? rule.weekdays.join(', ') : '-'}
              </small>
            </div>
          \`).join('');
        } else {
          rulesDiv.innerHTML = '<p style="color: #999;">制限ルールがありません</p>';
        }
        
        document.getElementById('totalRules').textContent = result.total || 0;
      } catch (e) {
        console.error('ルール読み込みエラー:', e);
      }
    }
    
    // ルール削除
    async function deleteRule(ruleId) {
      if (!confirm('このルールを削除しますか？')) return;
      
      try {
        await fetch('/api/capacity?rule_id=' + ruleId, {
          method: 'DELETE'
        });
        loadRules();
      } catch (e) {
        alert('削除エラー: ' + e.message);
      }
    }
    
    // 統計ロード
    async function loadStats() {
      try {
        const statsResponse = await fetch('/api/capacity?action=stats');
        const stats = await statsResponse.json();
        
        const resResponse = await fetch('/api/reservation');
        const reservations = await resResponse.json();
        
        document.getElementById('totalReservations').textContent = 
          reservations.reservations ? reservations.reservations.length : 0;
        
        const detailDiv = document.getElementById('statsDetail');
        if (stats.stats && stats.stats.length > 0) {
          detailDiv.innerHTML = '<h4>ルール別統計</h4>' + 
            stats.stats.map(s => \`
              <div style="margin: 10px 0;">
                <strong>\${s.rule.description}</strong><br>
                利用率: \${Math.round(s.utilization * 100)}% 
                (\${s.current_count}/\${s.limit_value}件)
              </div>
            \`).join('');
        }
      } catch (e) {
        console.error('統計読み込みエラー:', e);
      }
    }
  </script>
</body>
</html>`;
}

// サーバー起動
server.listen(PORT, () => {
  console.log(`\n✅ キャパシティ管理システム テストサーバー起動`);
  console.log(`\n🌐 ブラウザで開く: http://localhost:${PORT}`);
  console.log(`\n📋 利用可能なエンドポイント:`);
  console.log(`  - GET  / .................. テストUI`);
  console.log(`  - POST /api/capacity ...... 制限コマンド実行`);
  console.log(`  - GET  /api/capacity ...... 制限ルール取得`);
  console.log(`  - POST /api/reservation ... 予約テスト`);
  console.log(`  - POST /api/webhook ....... LINEコマンドシミュレーション`);
  console.log(`\n停止: Ctrl+C\n`);
});