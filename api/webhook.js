// LINE Webhook for Vercel
const line = require('@line/bot-sdk');

// セッション管理
const userSessions = new Map();

// Vercel Serverless Function
module.exports = async (req, res) => {
    console.log('Webhook called:', req.method);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    
    // GET request (for LINE Verify)
    if (req.method === 'GET') {
        console.log('GET request received');
        return res.status(200).json({ 
            status: 'OK',
            message: 'LINE Webhook is ready'
        });
    }
    
    // OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // POST request (LINE Webhook)
    if (req.method === 'POST') {
        console.log('POST request received');
        
        const config = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET
        };
        
        // Check config
        if (!config.channelAccessToken || !config.channelSecret) {
            console.error('Missing credentials');
            return res.status(500).json({ error: 'Missing credentials' });
        }
        
        const client = new line.Client(config);
        
        try {
            // Signature validation
            const signature = req.headers['x-line-signature'];
            const body = JSON.stringify(req.body);
            
            if (!line.validateSignature(body, config.channelSecret, signature)) {
                console.error('Invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
            
            // Process events
            const events = req.body.events || [];
            console.log('Events:', events.length);
            
            for (const event of events) {
                if (event.type === 'message' && event.message.type === 'text') {
                    const userId = event.source.userId;
                    const userMessage = event.message.text;
                    
                    console.log(`Message from ${userId}: ${userMessage}`);
                    
                    // 予約する - Always start fresh
                    if (userMessage === '予約する') {
                        userSessions.delete(userId);
                        userSessions.set(userId, { step: 'service' });
                        
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: 'サービスをお選びください：\n\n1️⃣ Webサイト制作\n2️⃣ LINE予約システム\n3️⃣ 無料相談'
                        });
                        continue;
                    }
                    
                    // 予約確認
                    if (userMessage === '予約確認') {
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: '現在、予約はありません。'
                        });
                        continue;
                    }
                    
                    // 料金プラン
                    if (userMessage === '料金プラン') {
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: '【料金プラン】\n\n📱 Webサイト制作\n・月額5,500円〜\n\n💬 LINE予約システム\n・月額5,000円〜'
                        });
                        continue;
                    }
                    
                    // お問い合わせ
                    if (userMessage === 'お問い合わせ') {
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: '📧 support@smartwebworks.com\n📱 このLINEでお問い合わせください'
                        });
                        continue;
                    }
                    
                    // ヘルプ
                    if (userMessage === 'ヘルプ') {
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: '「予約する」をタップして開始してください。'
                        });
                        continue;
                    }
                    
                    // Session handling
                    const session = userSessions.get(userId);
                    
                    if (session && session.step === 'service') {
                        if (userMessage === '1') {
                            session.service = 'Webサイト制作';
                            session.step = 'name';
                            userSessions.set(userId, session);
                            
                            await client.replyMessage(event.replyToken, {
                                type: 'text',
                                text: 'お名前をお聞かせください：'
                            });
                            continue;
                        }
                        if (userMessage === '2') {
                            session.service = 'LINE予約システム';
                            session.step = 'name';
                            userSessions.set(userId, session);
                            
                            await client.replyMessage(event.replyToken, {
                                type: 'text',
                                text: 'お名前をお聞かせください：'
                            });
                            continue;
                        }
                        if (userMessage === '3') {
                            session.service = '無料相談';
                            session.step = 'name';
                            userSessions.set(userId, session);
                            
                            await client.replyMessage(event.replyToken, {
                                type: 'text',
                                text: 'お名前をお聞かせください：'
                            });
                            continue;
                        }
                    }
                    
                    if (session && session.step === 'name') {
                        session.name = userMessage;
                        session.step = 'complete';
                        userSessions.set(userId, session);
                        
                        await client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: `✅ 予約を受け付けました！\n\nサービス: ${session.service}\nお名前: ${session.name}\n\n担当者よりご連絡いたします。`
                        });
                        
                        userSessions.delete(userId);
                        continue;
                    }
                    
                    // Default
                    await client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: 'こんにちは！「予約する」をタップしてください。'
                    });
                }
            }
            
            return res.status(200).json({ success: true });
            
        } catch (error) {
            console.error('Error:', error);
            return res.status(500).json({ 
                error: 'Internal error',
                message: error.message 
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};