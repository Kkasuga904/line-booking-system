// テスト用エンドポイント
module.exports = async (req, res) => {
    console.log('Test endpoint called');
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    
    res.status(200).json({
        status: 'OK',
        method: req.method,
        timestamp: new Date().toISOString(),
        env: {
            hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
            hasSecret: !!process.env.LINE_CHANNEL_SECRET
        }
    });
};