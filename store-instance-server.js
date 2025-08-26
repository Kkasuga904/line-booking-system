const express = require('express');
const line = require('@line/bot-sdk');
const fs = require('fs').promises;
const path = require('path');

// 店舗ごとの設定（環境変数から読み込み）
const config = {
    storeId: process.env.STORE_ID || 'default-store',
    storeName: process.env.STORE_NAME || 'デフォルト店舗',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy_token',
    channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy_secret',
    port: process.env.PORT || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    dataDir: './data',
    features: (process.env.FEATURES || 'booking,reminder,cancel').split(',')
};

// LINEクライアントの初期化（ダミートークンの場合はスキップ）
const client = config.channelAccessToken !== 'dummy_token' ? 
    new line.Client({
        channelAccessToken: config.channelAccessToken,
        channelSecret: config.channelSecret
    }) : null;

const app = express();

// 静的ファイルの提供（店舗専用管理画面）
app.use('/admin', express.static(path.join(__dirname, 'public', 'store-admin')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ルートページ（店舗情報表示）
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.storeName} - LINE予約システム</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', 'Meiryo', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .info-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .info-card h3 {
            color: #06C755;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .webhook-url {
            background: #fff;
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #06C755;
            font-family: monospace;
            word-break: break-all;
            margin-bottom: 10px;
        }
        .copy-btn {
            background: #06C755;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        .copy-btn:hover {
            background: #05a647;
        }
        .features {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .feature-tag {
            background: #e8f4ea;
            color: #06C755;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
        }
        .admin-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            margin-top: 20px;
            transition: transform 0.3s;
        }
        .admin-btn:hover {
            transform: translateY(-2px);
        }
        .status {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            padding: 15px;
            background: #e8f4ea;
            border-radius: 8px;
        }
        .status-dot {
            width: 10px;
            height: 10px;
            background: #06C755;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${config.storeName}</h1>
        <p class="subtitle">LINE予約システム</p>
        
        <div class="info-card">
            <h3>Webhook URL</h3>
            <div class="webhook-url" id="webhook-url">${config.baseUrl}/webhook</div>
            <button class="copy-btn" onclick="copyWebhook()">URLをコピー</button>
            <p style="margin-top: 10px; color: #666; font-size: 14px;">
                このURLをLINE Developers Consoleに設定してください
            </p>
        </div>
        
        <div class="info-card">
            <h3>利用可能な機能</h3>
            <div class="features">
                ${config.features.map(f => {
                    const names = {
                        'booking': '予約管理',
                        'reminder': 'リマインダー',
                        'cancel': 'キャンセル機能',
                        'reschedule': '予約変更',
                        'payment': '決済連携',
                        'analytics': '分析機能'
                    };
                    return `<span class="feature-tag">${names[f] || f}</span>`;
                }).join('')}
            </div>
        </div>
        
        <div class="status">
            <div class="status-dot"></div>
            <span>システム稼働中</span>
        </div>
        
        <a href="/admin" class="admin-btn">管理画面へアクセス</a>
    </div>
    
    <script>
        function copyWebhook() {
            const url = document.getElementById('webhook-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                alert('Webhook URLをコピーしました');
            });
        }
        
    </script>
</body>
</html>
    `);
});

// Webhook エンドポイント（各店舗専用）
app.post('/webhook', line.middleware({
    channelSecret: config.channelSecret
}), async (req, res) => {
    try {
        const events = req.body.events;
        
        await Promise.all(events.map(async (event) => {
            console.log(`[${config.storeId}] Event received:`, event.type);
            
            if (event.type === 'message' && event.message.type === 'text') {
                await handleTextMessage(event);
            } else if (event.type === 'postback') {
                await handlePostback(event);
            } else if (event.type === 'follow') {
                await handleFollow(event);
            }
        }));
        
        res.json({ success: true });
    } catch (error) {
        console.error(`[${config.storeId}] Webhook error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// フォローイベント処理
async function handleFollow(event) {
    const userId = event.source.userId;
    
    const welcomeMessage = {
        type: 'text',
        text: `${config.storeName}へようこそ！\n\n予約をご希望の場合は「予約」とメッセージをお送りください。\n\n【ご利用可能なコマンド】\n・予約\n・予約確認\n・キャンセル\n・お問い合わせ`
    };
    
    if (client) await client.replyMessage(event.replyToken, welcomeMessage);
    
    // ユーザー情報を保存
    const userPath = path.join(config.dataDir, 'users.json');
    await saveUser(userId, { followedAt: new Date().toISOString() });
}

// テキストメッセージ処理
async function handleTextMessage(event) {
    const userId = event.source.userId;
    const message = event.message.text;
    
    let replyMessage;
    
    if (message.includes('予約')) {
        replyMessage = await createBookingMenu();
    } else if (message.includes('確認')) {
        replyMessage = await getReservationList(userId);
    } else if (message.includes('キャンセル')) {
        replyMessage = await getCancelMenu(userId);
    } else if (message.includes('問い合わせ')) {
        replyMessage = {
            type: 'text',
            text: `お問い合わせありがとうございます。\n\n営業時間：10:00-20:00\n定休日：毎週水曜日\n\nお急ぎの場合はお電話でもお問い合わせください。\nTEL: 03-1234-5678`
        };
    } else {
        replyMessage = {
            type: 'text',
            text: 'メニューから選択してください：\n・予約する\n・予約確認\n・キャンセル\n・お問い合わせ'
        };
    }
    
    if (client) await client.replyMessage(event.replyToken, replyMessage);
}

// 予約メニューの作成
async function createBookingMenu() {
    return {
        type: 'template',
        altText: '予約メニュー',
        template: {
            type: 'buttons',
            title: '予約メニュー',
            text: 'ご希望のメニューを選択してください',
            actions: [
                {
                    type: 'postback',
                    label: 'カット',
                    data: 'action=select_menu&menu=cut'
                },
                {
                    type: 'postback',
                    label: 'カラー',
                    data: 'action=select_menu&menu=color'
                },
                {
                    type: 'postback',
                    label: 'パーマ',
                    data: 'action=select_menu&menu=perm'
                }
            ]
        }
    };
}

// 予約一覧の取得
async function getReservationList(userId) {
    const reservationPath = path.join(config.dataDir, 'reservations.json');
    
    try {
        const data = await fs.readFile(reservationPath, 'utf-8');
        const reservations = JSON.parse(data);
        const userReservations = reservations.filter(r => r.userId === userId && r.status === 'active');
        
        if (userReservations.length === 0) {
            return {
                type: 'text',
                text: '現在、予約はありません。'
            };
        }
        
        const list = userReservations.map(r => 
            `📅 ${r.date} ${r.time}\n📍 ${r.menu}\n予約番号: ${r.id}`
        ).join('\n\n');
        
        return {
            type: 'text',
            text: `現在の予約:\n\n${list}`
        };
    } catch (error) {
        return {
            type: 'text',
            text: '予約情報の取得に失敗しました。'
        };
    }
}

// Postback処理
async function handlePostback(event) {
    const userId = event.source.userId;
    const params = new URLSearchParams(event.postback.data);
    const action = params.get('action');
    
    let replyMessage;
    
    switch (action) {
        case 'select_menu':
            const menu = params.get('menu');
            replyMessage = await showDatePicker(menu);
            break;
        case 'select_date':
            const selectedMenu = params.get('menu');
            const date = params.get('date');
            replyMessage = await showTimePicker(selectedMenu, date);
            break;
        case 'confirm_booking':
            replyMessage = await confirmBooking(userId, params);
            break;
        case 'cancel_reservation':
            const reservationId = params.get('id');
            replyMessage = await cancelReservation(userId, reservationId);
            break;
        default:
            replyMessage = { type: 'text', text: '不明なアクションです。' };
    }
    
    if (client) await client.replyMessage(event.replyToken, replyMessage);
}

// 予約の確定
async function confirmBooking(userId, params) {
    const reservation = {
        id: `${config.storeId}-${Date.now()}`,
        userId,
        storeId: config.storeId,
        storeName: config.storeName,
        menu: params.get('menu'),
        date: params.get('date'),
        time: params.get('time'),
        status: 'active',
        createdAt: new Date().toISOString()
    };
    
    // 予約を保存
    const reservationPath = path.join(config.dataDir, 'reservations.json');
    await saveReservation(reservation);
    
    return {
        type: 'text',
        text: `✅ 予約が確定しました！\n\n店舗: ${config.storeName}\n日時: ${reservation.date} ${reservation.time}\nメニュー: ${getMenuName(reservation.menu)}\n予約番号: ${reservation.id}\n\n前日にリマインダーをお送りします。`
    };
}

// メニュー名の取得
function getMenuName(menu) {
    const names = {
        'cut': 'カット',
        'color': 'カラー',
        'perm': 'パーマ'
    };
    return names[menu] || menu;
}

// データ保存関数
async function saveReservation(reservation) {
    const filePath = path.join(config.dataDir, 'reservations.json');
    
    try {
        await fs.access(config.dataDir);
    } catch {
        await fs.mkdir(config.dataDir, { recursive: true });
    }
    
    let reservations = [];
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        reservations = JSON.parse(data);
    } catch {}
    
    reservations.push(reservation);
    await fs.writeFile(filePath, JSON.stringify(reservations, null, 2));
}

// ユーザー情報保存
async function saveUser(userId, userData) {
    const filePath = path.join(config.dataDir, 'users.json');
    
    try {
        await fs.access(config.dataDir);
    } catch {
        await fs.mkdir(config.dataDir, { recursive: true });
    }
    
    let users = {};
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        users = JSON.parse(data);
    } catch {}
    
    users[userId] = { ...users[userId], ...userData };
    await fs.writeFile(filePath, JSON.stringify(users, null, 2));
}

// API: 予約一覧
app.get('/api/reservations', async (req, res) => {
    const filePath = path.join(config.dataDir, 'reservations.json');
    
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const reservations = JSON.parse(data);
        res.json({
            storeId: config.storeId,
            storeName: config.storeName,
            count: reservations.length,
            reservations
        });
    } catch (error) {
        res.json({
            storeId: config.storeId,
            storeName: config.storeName,
            count: 0,
            reservations: []
        });
    }
});

// API: 統計情報
app.get('/api/stats', async (req, res) => {
    const reservationPath = path.join(config.dataDir, 'reservations.json');
    const userPath = path.join(config.dataDir, 'users.json');
    
    let stats = {
        storeId: config.storeId,
        storeName: config.storeName,
        totalReservations: 0,
        activeReservations: 0,
        totalUsers: 0,
        todayReservations: 0
    };
    
    try {
        const reservationData = await fs.readFile(reservationPath, 'utf-8');
        const reservations = JSON.parse(reservationData);
        stats.totalReservations = reservations.length;
        stats.activeReservations = reservations.filter(r => r.status === 'active').length;
        
        const today = new Date().toISOString().split('T')[0];
        stats.todayReservations = reservations.filter(r => r.date === today).length;
    } catch {}
    
    try {
        const userData = await fs.readFile(userPath, 'utf-8');
        const users = JSON.parse(userData);
        stats.totalUsers = Object.keys(users).length;
    } catch {}
    
    res.json(stats);
});

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        storeId: config.storeId,
        storeName: config.storeName,
        timestamp: new Date().toISOString()
    });
});

// サーバー起動
app.listen(config.port, () => {
    console.log('='.repeat(60));
    console.log(`🏪 ${config.storeName} - LINE予約システム`);
    console.log('='.repeat(60));
    console.log(`📍 Store ID: ${config.storeId}`);
    console.log(`🌐 URL: ${config.baseUrl}`);
    console.log(`🔗 Webhook: ${config.baseUrl}/webhook`);
    console.log(`👨‍💼 管理画面: ${config.baseUrl}/admin`);
    console.log(`✨ 機能: ${config.features.join(', ')}`);
    console.log('='.repeat(60));
});