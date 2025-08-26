const express = require('express');
const line = require('@line/bot-sdk');
const fs = require('fs').promises;
const path = require('path');

// 環境変数から設定を読み込み
const config = {
    tenantId: process.env.TENANT_ID || 'default',
    port: process.env.PORT || 3000,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    webhookPath: process.env.WEBHOOK_PATH || '/webhook',
    dataDir: process.env.DATA_DIR || './data',
    baseUrl: process.env.BASE_URL || 'http://localhost'
};

// LINEクライアントの初期化
const client = new line.Client({
    channelAccessToken: config.channelAccessToken,
    channelSecret: config.channelSecret
});

const app = express();

// 静的ファイルの提供（管理画面）
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        tenant: config.tenantId,
        timestamp: new Date().toISOString()
    });
});

// テナント情報エンドポイント
app.get('/api/info', (req, res) => {
    res.json({
        tenantId: config.tenantId,
        webhookUrl: `${config.baseUrl}${config.webhookPath}`,
        version: '2.0.0',
        features: ['booking', 'reminder', 'multi-language']
    });
});

// Webhook設定（テナント固有のパス）
app.post(config.webhookPath, line.middleware({
    channelSecret: config.channelSecret
}), async (req, res) => {
    try {
        const events = req.body.events;
        
        // イベント処理
        await Promise.all(events.map(async (event) => {
            console.log(`[${config.tenantId}] Event received:`, event.type);
            
            if (event.type === 'message' && event.message.type === 'text') {
                await handleTextMessage(event);
            } else if (event.type === 'postback') {
                await handlePostback(event);
            }
        }));
        
        res.json({ success: true });
    } catch (error) {
        console.error(`[${config.tenantId}] Webhook error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// メッセージ処理
async function handleTextMessage(event) {
    const userId = event.source.userId;
    const message = event.message.text;
    
    // テナント固有のデータディレクトリ
    const dataPath = path.join(config.dataDir, config.tenantId);
    await ensureDir(dataPath);
    
    // メッセージログの保存
    const logPath = path.join(dataPath, 'messages.json');
    const log = {
        userId,
        message,
        timestamp: new Date().toISOString(),
        tenant: config.tenantId
    };
    
    await appendToFile(logPath, log);
    
    // 返信メッセージ
    let replyText = '';
    
    if (message.includes('予約')) {
        replyText = await getBookingMenu();
    } else if (message.includes('確認')) {
        replyText = await getReservationStatus(userId);
    } else if (message.includes('キャンセル')) {
        replyText = await getCancelMenu(userId);
    } else {
        replyText = `[${config.tenantId}] メニューから選択してください：\n` +
                   '・予約する\n' +
                   '・予約確認\n' +
                   '・キャンセル';
    }
    
    await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText
    });
}

// Postback処理
async function handlePostback(event) {
    const userId = event.source.userId;
    const data = querystring.parse(event.postback.data);
    
    console.log(`[${config.tenantId}] Postback data:`, data);
    
    let replyMessage;
    
    switch (data.action) {
        case 'book':
            replyMessage = await processBooking(userId, data);
            break;
        case 'confirm':
            replyMessage = await confirmReservation(userId, data);
            break;
        case 'cancel':
            replyMessage = await cancelReservation(userId, data);
            break;
        default:
            replyMessage = { type: 'text', text: '不明なアクションです' };
    }
    
    await client.replyMessage(event.replyToken, replyMessage);
}

// 予約メニューの取得
async function getBookingMenu() {
    // テナント固有の予約メニューを返す
    const menuPath = path.join(config.dataDir, config.tenantId, 'menu.json');
    
    try {
        const menuData = await fs.readFile(menuPath, 'utf-8');
        const menu = JSON.parse(menuData);
        
        return `予約可能なメニュー:\n${menu.map(item => 
            `・${item.name} (${item.duration}分) ¥${item.price}`
        ).join('\n')}`;
    } catch (error) {
        return '現在予約可能なメニューがありません。';
    }
}

// 予約状況の確認
async function getReservationStatus(userId) {
    const reservationPath = path.join(config.dataDir, config.tenantId, 'reservations.json');
    
    try {
        const data = await fs.readFile(reservationPath, 'utf-8');
        const reservations = JSON.parse(data);
        const userReservations = reservations.filter(r => r.userId === userId);
        
        if (userReservations.length === 0) {
            return '現在予約はありません。';
        }
        
        return `あなたの予約:\n${userReservations.map(r => 
            `📅 ${r.date} ${r.time}\n📍 ${r.service}`
        ).join('\n\n')}`;
    } catch (error) {
        return '予約情報の取得に失敗しました。';
    }
}

// ディレクトリの確認と作成
async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// ファイルへの追記
async function appendToFile(filePath, data) {
    try {
        const existing = await fs.readFile(filePath, 'utf-8');
        const records = JSON.parse(existing);
        records.push(data);
        await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    } catch {
        // ファイルが存在しない場合は新規作成
        await fs.writeFile(filePath, JSON.stringify([data], null, 2));
    }
}

// 予約処理
async function processBooking(userId, data) {
    const reservation = {
        id: `${config.tenantId}-${Date.now()}`,
        userId,
        date: data.date,
        time: data.time,
        service: data.service,
        tenant: config.tenantId,
        createdAt: new Date().toISOString()
    };
    
    const reservationPath = path.join(config.dataDir, config.tenantId, 'reservations.json');
    await appendToFile(reservationPath, reservation);
    
    return {
        type: 'text',
        text: `✅ 予約が完了しました！\n\n` +
              `予約番号: ${reservation.id}\n` +
              `日時: ${data.date} ${data.time}\n` +
              `サービス: ${data.service}\n\n` +
              `ご来店をお待ちしております。`
    };
}

// 予約確定
async function confirmReservation(userId, data) {
    // 予約確定処理
    return {
        type: 'text',
        text: '予約を確定しました。'
    };
}

// 予約キャンセル
async function cancelReservation(userId, data) {
    const reservationPath = path.join(config.dataDir, config.tenantId, 'reservations.json');
    
    try {
        const fileData = await fs.readFile(reservationPath, 'utf-8');
        let reservations = JSON.parse(fileData);
        
        // キャンセル対象の予約を削除
        reservations = reservations.filter(r => 
            !(r.userId === userId && r.id === data.reservationId)
        );
        
        await fs.writeFile(reservationPath, JSON.stringify(reservations, null, 2));
        
        return {
            type: 'text',
            text: `予約（${data.reservationId}）をキャンセルしました。`
        };
    } catch (error) {
        return {
            type: 'text',
            text: 'キャンセルに失敗しました。'
        };
    }
}

// 管理API：予約一覧の取得
app.get('/api/reservations', async (req, res) => {
    const reservationPath = path.join(config.dataDir, config.tenantId, 'reservations.json');
    
    try {
        const data = await fs.readFile(reservationPath, 'utf-8');
        const reservations = JSON.parse(data);
        res.json({
            tenant: config.tenantId,
            count: reservations.length,
            reservations
        });
    } catch (error) {
        res.json({
            tenant: config.tenantId,
            count: 0,
            reservations: []
        });
    }
});

// 管理API：統計情報の取得
app.get('/api/stats', async (req, res) => {
    const reservationPath = path.join(config.dataDir, config.tenantId, 'reservations.json');
    const messagePath = path.join(config.dataDir, config.tenantId, 'messages.json');
    
    let stats = {
        tenant: config.tenantId,
        reservations: 0,
        messages: 0,
        lastActivity: null
    };
    
    try {
        const reservationData = await fs.readFile(reservationPath, 'utf-8');
        const reservations = JSON.parse(reservationData);
        stats.reservations = reservations.length;
        
        if (reservations.length > 0) {
            stats.lastActivity = reservations[reservations.length - 1].createdAt;
        }
    } catch {}
    
    try {
        const messageData = await fs.readFile(messagePath, 'utf-8');
        const messages = JSON.parse(messageData);
        stats.messages = messages.length;
    } catch {}
    
    res.json(stats);
});

// サーバー起動
app.listen(config.port, () => {
    console.log('='.repeat(50));
    console.log(`🚀 マルチテナント LINE Bot サーバー起動`);
    console.log('='.repeat(50));
    console.log(`📍 テナントID: ${config.tenantId}`);
    console.log(`📍 ポート: ${config.port}`);
    console.log(`📍 Webhook URL: ${config.baseUrl}${config.webhookPath}`);
    console.log(`📍 管理画面: http://localhost:${config.port}/admin`);
    console.log('='.repeat(50));
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
    console.log(`[${config.tenantId}] SIGTERM received. Shutting down gracefully.`);
    process.exit(0);
});