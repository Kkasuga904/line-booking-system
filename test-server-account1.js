/**
 * Account 1 LINE予約システム テストサーバー
 * キャパシティ管理機能付き
 */

import http from 'http';
import url from 'url';

// 環境変数のモック
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-key';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.LIFF_ID = '2006487877-9VQRr38M';

const PORT = 3001;

// メモリ内データストア
const dataStore = {
  rules: [
    {
      id: 'rule-001',
      store_id: 'account-001',
      description: '週末ランチタイム: 1時間3件まで',
      weekdays: [0, 6],
      time_start: '11:00',
      time_end: '15:00',
      limit_type: 'per_hour',
      limit_value: 3,
      active: true
    }
  ],
  reservations: [],
  messages: []
};

// HTTPサーバー
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  console.log(`${req.method} ${pathname}`);
  
  // ルートページ
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getIndexHTML());
    return;
  }
  
  // API: LINE Webhook シミュレーション
  if (pathname === '/api/webhook') {
    await handleWebhook(req, res);
    return;
  }
  
  // API: キャパシティコマンド
  if (pathname === '/api/capacity') {
    await handleCapacity(req, res);
    return;
  }
  
  // API: メッセージ履歴
  if (pathname === '/api/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: dataStore.messages }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// Webhook処理
async function handleWebhook(req, res) {
  if (req.method === 'POST') {
    const body = await getRequestBody(req);
    const userMessage = body.message || '';
    let replyMessage = '';
    
    // キャパシティ管理コマンド
    if (userMessage.startsWith('/limit') || userMessage.startsWith('/stop') || userMessage === '/limits') {
      const result = processCapacityCommand(userMessage);
      replyMessage = result.message;
    }
    // 通常のメッセージ処理
    else if (userMessage.includes('予約')) {
      replyMessage = `【予約オプション】
新規予約をご希望ですか？

✅ はい（予約画面へ）
📋 予約を確認する`;
    }
    else if (userMessage.includes('営業') || userMessage.includes('時間')) {
      replyMessage = `📍 Account 1 店舗

【営業時間】
月〜金: 11:00〜22:00 (L.O. 21:30)
土日祝: 10:00〜23:00 (L.O. 22:30)

【定休日】
年中無休（年末年始を除く）

【アクセス】
〒100-0001
東京都千代田区サンプル1-2-3

☎️ 03-0000-0000

本日のご予約はいかがですか？
📅 今すぐ予約
🍽 本日のメニュー`;
    }
    else if (userMessage.includes('メニュー') || userMessage.includes('料理')) {
      replyMessage = `🍽 本日のおすすめ

【ランチ】11:00-15:00
・日替わりパスタ ¥1,200
・本日の魚料理 ¥1,500
・黒毛和牛ハンバーグ ¥1,800

【ディナー】17:00-22:00
・シェフおまかせコース ¥5,000〜
・アラカルト各種

※価格は税込です`;
    }
    else if (userMessage.includes('問い合わせ') || userMessage.includes('電話')) {
      replyMessage = `📞 お問い合わせ

お電話: 03-0000-0000
受付時間: 10:00-21:00

LINEでもご質問を承っております。
お気軽にメッセージをお送りください！`;
    }
    else if (userMessage.startsWith('R') && userMessage.length > 8) {
      replyMessage = `予約番号 ${userMessage} を確認中...

申し訳ございません。現在システムメンテナンス中です。
お手数ですが、お電話（03-0000-0000）でご確認ください。`;
    }
    else {
      replyMessage = `こんにちは！ご用件をお選びください👇

🍴 新規予約
📋 予約確認  
⏰ 営業時間
🍽 メニュー
📞 お問い合わせ`;
    }
    
    // メッセージを保存
    dataStore.messages.push({
      type: 'user',
      text: userMessage,
      timestamp: new Date().toISOString()
    });
    dataStore.messages.push({
      type: 'bot',
      text: replyMessage,
      timestamp: new Date().toISOString()
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      reply: replyMessage 
    }));
  }
}

// キャパシティコマンド処理
async function handleCapacity(req, res) {
  if (req.method === 'POST') {
    const body = await getRequestBody(req);
    const result = processCapacityCommand(body.command);
    
    if (result.rule) {
      result.rule.id = 'rule-' + Date.now();
      dataStore.rules.push(result.rule);
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
  else if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      rules: dataStore.rules,
      total: dataStore.rules.length
    }));
  }
}

// コマンド処理
function processCapacityCommand(text) {
  if (text === '/limits') {
    let message = '📋 現在の制限ルール:\n\n';
    dataStore.rules.forEach((rule, i) => {
      message += `${i+1}. ${rule.description}\n`;
    });
    message += '\n利用可能なコマンド:\n';
    message += '/limit today 20 ... 今日の予約を20件まで\n';
    message += '/limit sat,sun lunch 5/h ... 週末ランチ5件/時\n';
    message += '/stop today 18:00- ... 今日18時以降停止';
    return { success: true, message };
  }
  
  if (text.startsWith('/limit ')) {
    const params = text.substring(7);
    const rule = {
      store_id: 'account-001',
      description: text,
      active: true
    };
    
    // 簡易パース
    if (params.includes('today')) {
      rule.date_start = new Date().toISOString().split('T')[0];
    }
    if (params.includes('sat') || params.includes('sun')) {
      rule.weekdays = [0, 6];
    }
    const limitMatch = params.match(/(\d+)/);
    if (limitMatch) {
      rule.limit_value = parseInt(limitMatch[1]);
    }
    
    return {
      success: true,
      message: `✅ 制限ルールを設定しました:\n${text}`,
      rule
    };
  }
  
  if (text.startsWith('/stop ')) {
    return {
      success: true,
      message: `⛔ 予約停止を設定しました:\n${text}`,
      rule: {
        description: text,
        limit_type: 'stop'
      }
    };
  }
  
  return { success: false, error: '未対応のコマンド' };
}

// リクエストボディ取得
function getRequestBody(req) {
  return new Promise((resolve) => {
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
  <title>Account 1 - LINE予約システムテスト</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
      background: #f7f7f7;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      background: linear-gradient(135deg, #06c755 0%, #00b900 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 30px;
      text-align: center;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .card h2 {
      color: #06c755;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f0f0f0;
    }
    .chat-container {
      height: 400px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 10px;
      background: #f9f9f9;
      margin-bottom: 10px;
    }
    .message {
      margin: 10px 0;
      display: flex;
    }
    .message.user {
      justify-content: flex-end;
    }
    .message.bot {
      justify-content: flex-start;
    }
    .message-bubble {
      max-width: 70%;
      padding: 10px 15px;
      border-radius: 20px;
      white-space: pre-line;
    }
    .user .message-bubble {
      background: #06c755;
      color: white;
    }
    .bot .message-bubble {
      background: white;
      border: 1px solid #e0e0e0;
    }
    .input-group {
      display: flex;
      gap: 10px;
    }
    input, textarea, select {
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
    }
    button {
      background: #06c755;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover {
      background: #00b900;
    }
    .quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 15px 0;
    }
    .quick-reply {
      padding: 8px 15px;
      background: white;
      border: 1px solid #06c755;
      color: #06c755;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
    }
    .quick-reply:hover {
      background: #06c755;
      color: white;
    }
    .rule-item {
      background: #f0f8ff;
      border-left: 4px solid #06c755;
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
    }
    .command-examples {
      background: #f0f0f0;
      padding: 15px;
      border-radius: 5px;
      margin-top: 15px;
    }
    .command-examples code {
      display: block;
      background: white;
      padding: 5px 10px;
      margin: 5px 0;
      border-left: 3px solid #06c755;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍽️ Account 1 - LINE予約システム（ローカルテスト）</h1>
    
    <div class="grid">
      <!-- LINE チャットシミュレーター -->
      <div class="card">
        <h2>💬 LINE チャットシミュレーター</h2>
        <div class="chat-container" id="chatContainer"></div>
        
        <div class="quick-replies">
          <div class="quick-reply" onclick="sendQuickMessage('予約したい')">🍴 新規予約</div>
          <div class="quick-reply" onclick="sendQuickMessage('予約確認')">📋 予約確認</div>
          <div class="quick-reply" onclick="sendQuickMessage('営業時間')">⏰ 営業時間</div>
          <div class="quick-reply" onclick="sendQuickMessage('メニュー')">🍽 メニュー</div>
          <div class="quick-reply" onclick="sendQuickMessage('お問い合わせ')">📞 お問い合わせ</div>
        </div>
        
        <div class="input-group">
          <input type="text" id="messageInput" placeholder="メッセージを入力..." onkeypress="if(event.key==='Enter')sendMessage()">
          <button onclick="sendMessage()">送信</button>
        </div>
      </div>
      
      <!-- キャパシティ管理 -->
      <div class="card">
        <h2>⚙️ キャパシティ管理コマンド</h2>
        
        <div class="input-group" style="margin-bottom: 20px;">
          <input type="text" id="commandInput" placeholder="/limits" value="/limits">
          <button onclick="sendCommand()">実行</button>
        </div>
        
        <div id="commandResult" style="margin: 20px 0; padding: 10px; background: #f0f8ff; border-radius: 5px; display: none;"></div>
        
        <div id="rulesList"></div>
        
        <div class="command-examples">
          <strong>コマンド例:</strong>
          <code onclick="setCommand('/limits')">/limits - 現在の制限一覧</code>
          <code onclick="setCommand('/limit today 30')">/limit today 30 - 今日30件まで</code>
          <code onclick="setCommand('/limit sat,sun 11:00-15:00 3/h')">/limit sat,sun 11:00-15:00 3/h</code>
          <code onclick="setCommand('/stop today 18:00-')">/stop today 18:00- - 18時以降停止</code>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // 初期化
    loadMessages();
    loadRules();
    
    // メッセージ送信
    async function sendMessage() {
      const input = document.getElementById('messageInput');
      const message = input.value.trim();
      if (!message) return;
      
      input.value = '';
      
      try {
        const response = await fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        loadMessages();
      } catch (e) {
        console.error('Error:', e);
      }
    }
    
    // クイックメッセージ送信
    function sendQuickMessage(text) {
      document.getElementById('messageInput').value = text;
      sendMessage();
    }
    
    // メッセージ履歴読み込み
    async function loadMessages() {
      try {
        const response = await fetch('/api/messages');
        const data = await response.json();
        
        const container = document.getElementById('chatContainer');
        container.innerHTML = data.messages.map(msg => \`
          <div class="message \${msg.type}">
            <div class="message-bubble">\${msg.text}</div>
          </div>
        \`).join('');
        
        container.scrollTop = container.scrollHeight;
      } catch (e) {
        console.error('Error:', e);
      }
    }
    
    // コマンド実行
    async function sendCommand() {
      const input = document.getElementById('commandInput');
      const command = input.value.trim();
      if (!command) return;
      
      try {
        const response = await fetch('/api/capacity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command })
        });
        
        const result = await response.json();
        
        const resultDiv = document.getElementById('commandResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = result.success 
          ? '✅ ' + (result.message || 'コマンド実行成功').replace(/\\n/g, '<br>')
          : '❌ ' + (result.error || 'エラー');
        
        if (result.rule) {
          loadRules();
        }
      } catch (e) {
        console.error('Error:', e);
      }
    }
    
    // コマンド設定
    function setCommand(cmd) {
      document.getElementById('commandInput').value = cmd;
    }
    
    // ルール一覧読み込み
    async function loadRules() {
      try {
        const response = await fetch('/api/capacity');
        const data = await response.json();
        
        const container = document.getElementById('rulesList');
        if (data.rules && data.rules.length > 0) {
          container.innerHTML = '<h3>現在の制限ルール:</h3>' +
            data.rules.map(rule => \`
              <div class="rule-item">
                <strong>\${rule.description}</strong><br>
                <small>タイプ: \${rule.limit_type || '-'} | 制限値: \${rule.limit_value || '-'}</small>
              </div>
            \`).join('');
        }
      } catch (e) {
        console.error('Error:', e);
      }
    }
    
    // 初期メッセージ
    setTimeout(() => {
      sendQuickMessage('こんにちは');
    }, 500);
  </script>
</body>
</html>`;
}

// サーバー起動
server.listen(PORT, () => {
  console.log(`\n✅ Account 1 テストサーバー起動`);
  console.log(`\n🌐 ブラウザで開く: http://localhost:${PORT}`);
  console.log(`\n📋 機能テスト:`);
  console.log(`  - LINE チャットシミュレーション`);
  console.log(`  - キャパシティ管理コマンド`);
  console.log(`  - クイックリプライボタン`);
  console.log(`\n停止: Ctrl+C\n`);
});