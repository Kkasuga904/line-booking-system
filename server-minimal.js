const express = require('express');
const app = express();

// 環境変数からポートを取得（Cloud Runが自動設定）
const PORT = process.env.PORT || 8080;

console.log('Starting minimal server on port:', PORT);

// 基本ミドルウェア
app.use(express.json());

// ヘルスチェック
app.get('/api/ping', (req, res) => {
    console.log('Health check requested');
    res.status(200).json({ 
        status: 'ok', 
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// ルートパス
app.get('/', (req, res) => {
    res.status(200).send('Server is running on port ' + PORT);
});

// 404ハンドラー
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// エラーハンドラー
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// サーバー起動
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server successfully started on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/ping`);
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});