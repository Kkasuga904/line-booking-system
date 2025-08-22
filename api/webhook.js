/**
 * Smart Web Works - LINE予約システム
 * Vercel Serverless Function版
 */

const line = require('@line/bot-sdk');

// LINE設定
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// セッション管理（一時的）
const userSessions = new Map();

// サービスメニュー
const SERVICES = {
    WEBSITE: {
        name: 'Webサイト制作',
        plans: [
            { id: 'web_basic', name: 'ベーシックプラン', price: '月額 5,500円' },
            { id: 'web_standard', name: 'スタンダードプラン', price: '月額 11,000円' },
            { id: 'web_premium', name: 'プレミアムプラン', price: '月額 22,000円' }
        ]
    },
    LINE_BOOKING: {
        name: 'LINE予約システム',
        plans: [
            { id: 'line_basic', name: 'ライトプラン', price: '月額 5,000円' },
            { id: 'line_standard', name: 'スタンダード', price: '月額 10,000円' },
            { id: 'line_premium', name: 'プレミアム', price: '月額 20,000円' }
        ]
    },
    CONSULTATION: {
        name: '無料相談',
        plans: [
            { id: 'consultation', name: '30分無料相談', price: '無料' }
        ]
    }
};

// Vercel Serverless Function エントリーポイント
module.exports = async (req, res) => {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    // GETリクエスト（Verify用）
    if (req.method === 'GET') {
        return res.status(200).send('OK');
    }
    
    // OPTIONSリクエスト（CORS対応）
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // POSTリクエスト（Webhook処理）
    if (req.method === 'POST') {
        // 署名検証
        const signature = req.headers['x-line-signature'];
        const body = JSON.stringify(req.body);
        
        if (!line.validateSignature(body, config.channelSecret, signature)) {
            return res.status(401).send('Unauthorized');
        }
        
        try {
            const events = req.body.events || [];
            const results = await Promise.all(events.map(handleEvent));
            return res.status(200).json({ results });
        } catch (error) {
            console.error('Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    return res.status(405).send('Method Not Allowed');
};

// イベント処理
async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return null;
    }
    
    const userId = event.source.userId;
    const userMessage = event.message.text;
    
    // 「予約する」は常に新規セッション
    if (userMessage === '予約する') {
        userSessions.delete(userId);
        userSessions.set(userId, { step: 'service_selection' });
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ご利用になりたいサービスをお選びください：\n\n1️⃣ Webサイト制作\n2️⃣ LINE予約システム\n3️⃣ 無料相談\n\n番号でお答えください。',
            quickReply: {
                items: [
                    { type: 'action', action: { type: 'message', label: '1', text: '1' }},
                    { type: 'action', action: { type: 'message', label: '2', text: '2' }},
                    { type: 'action', action: { type: 'message', label: '3', text: '3' }}
                ]
            }
        });
    }
    
    // 予約確認
    if (userMessage === '予約確認') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '現在、予約はありません。\n「予約する」から新規予約をお願いします。'
        });
    }
    
    // 料金プラン
    if (userMessage === '料金プラン') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '【料金プラン】\n\n📱 Webサイト制作\n・ベーシック: 月額5,500円\n・スタンダード: 月額11,000円\n・プレミアム: 月額22,000円\n\n💬 LINE予約システム\n・ライト: 月額5,000円\n・スタンダード: 月額10,000円\n・プレミアム: 月額20,000円\n\n詳しくは「予約する」からご相談ください！'
        });
    }
    
    // お問い合わせ
    if (userMessage === 'お問い合わせ') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '【お問い合わせ】\n\n📧 メール\nsupport@smartwebworks.com\n\n📱 LINE\nこのチャットで直接お問い合わせください\n\n🏢 営業時間\n平日 9:00-18:00\n\nお気軽にご連絡ください！'
        });
    }
    
    // ヘルプ
    if (userMessage === 'ヘルプ' || userMessage === '使い方') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '【使い方】\n\n1️⃣「予約する」をタップ\n2️⃣ サービスを選択\n3️⃣ プランを選択\n4️⃣ お客様情報を入力\n5️⃣ 予約完了！\n\nリッチメニューから各機能をご利用いただけます。'
        });
    }
    
    // セッション処理
    const session = userSessions.get(userId);
    if (!session) {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'こんにちは！Smart Web Worksです。\n「予約する」をタップして、サービスをお選びください。',
            quickReply: {
                items: [
                    { type: 'action', action: { type: 'message', label: '予約する', text: '予約する' }}
                ]
            }
        });
    }
    
    // サービス選択処理
    if (session.step === 'service_selection') {
        if (userMessage === '1' || userMessage === 'Webサイト制作') {
            session.service = 'WEBSITE';
            session.step = 'plan_selection';
            userSessions.set(userId, session);
            
            let planText = 'プランをお選びください：\n\n';
            SERVICES.WEBSITE.plans.forEach((plan, index) => {
                planText += `${index + 1}. ${plan.name} - ${plan.price}\n`;
            });
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: planText
            });
        }
        
        if (userMessage === '2' || userMessage === 'LINE予約システム') {
            session.service = 'LINE_BOOKING';
            session.step = 'plan_selection';
            userSessions.set(userId, session);
            
            let planText = 'プランをお選びください：\n\n';
            SERVICES.LINE_BOOKING.plans.forEach((plan, index) => {
                planText += `${index + 1}. ${plan.name} - ${plan.price}\n`;
            });
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: planText
            });
        }
        
        if (userMessage === '3' || userMessage === '無料相談') {
            session.service = 'CONSULTATION';
            session.step = 'contact_input';
            userSessions.set(userId, session);
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'お名前をお聞かせください：'
            });
        }
    }
    
    // プラン選択処理
    if (session.step === 'plan_selection') {
        const service = SERVICES[session.service];
        const planIndex = parseInt(userMessage) - 1;
        
        if (planIndex >= 0 && planIndex < service.plans.length) {
            session.plan = service.plans[planIndex];
            session.step = 'contact_input';
            userSessions.set(userId, session);
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'お名前をお聞かせください：'
            });
        }
    }
    
    // 連絡先入力処理
    if (session.step === 'contact_input') {
        session.name = userMessage;
        session.step = 'email_input';
        userSessions.set(userId, session);
        
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'メールアドレスをお聞かせください：'
        });
    }
    
    // メール入力処理
    if (session.step === 'email_input') {
        session.email = userMessage;
        session.step = 'confirmation';
        userSessions.set(userId, session);
        
        const service = SERVICES[session.service];
        const confirmText = `【予約内容確認】\n\nサービス: ${service.name}\nプラン: ${session.plan ? session.plan.name : '無料相談'}\nお名前: ${session.name}\nメール: ${session.email}\n\nこちらでよろしいですか？\n「はい」または「いいえ」でお答えください。`;
        
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: confirmText,
            quickReply: {
                items: [
                    { type: 'action', action: { type: 'message', label: 'はい', text: 'はい' }},
                    { type: 'action', action: { type: 'message', label: 'いいえ', text: 'いいえ' }}
                ]
            }
        });
    }
    
    // 確認処理
    if (session.step === 'confirmation') {
        if (userMessage === 'はい') {
            userSessions.delete(userId);
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '✅ 予約を受け付けました！\n\n担当者より1営業日以内にご連絡させていただきます。\n\nご利用ありがとうございました！'
            });
        }
        
        if (userMessage === 'いいえ') {
            userSessions.delete(userId);
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: '予約をキャンセルしました。\n最初からやり直す場合は「予約する」をタップしてください。'
            });
        }
    }
    
    // デフォルト応答
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '申し訳ございません。メッセージを理解できませんでした。\n「予約する」からお進みください。'
    });
}