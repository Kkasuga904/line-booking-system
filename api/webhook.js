/**
 * Smart Web Works - LINE注文受付システム
 * LINE公式アカウントで注文を自動受付・管理
 * 
 * === Vercelデプロイ版 ===
 * PC再起動しても同じURLで動作し続ける
 * 24時間365日稼働
 */

const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

// ===== LINE設定 =====
// Vercel環境変数から取得
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// ===== データストア =====
// 注文データストア（Vercelでは一時的なメモリ使用）
// TODO: 本番環境ではSupabase等のDBに変更推奨
const orders = new Map();
const userSessions = new Map();

// ===== サービスメニュー定義 =====
const SERVICES = {
    WEBSITE: {
        name: 'Webサイト制作',
        plans: [
            { id: 'web_basic', name: 'ベーシックプラン', price: '月額 5,500円', description: 'シンプルな1ページサイト' },
            { id: 'web_standard', name: 'スタンダードプラン', price: '月額 11,000円', description: '5ページまでのサイト' },
            { id: 'web_premium', name: 'プレミアムプラン', price: '月額 22,000円', description: '10ページ＋ブログ機能' }
        ]
    },
    LINE_BOOKING: {
        name: 'LINE予約システム',
        plans: [
            { id: 'line_basic', name: 'ライトプラン', price: '月額 5,000円', description: '基本予約機能' },
            { id: 'line_standard', name: 'スタンダード', price: '月額 10,000円', description: '予約＋顧客管理' },
            { id: 'line_premium', name: 'プレミアム', price: '月額 20,000円', description: 'フル機能＋カスタマイズ' }
        ]
    },
    CONSULTATION: {
        name: '無料相談',
        plans: [
            { id: 'consultation', name: '30分無料相談', price: '無料', description: 'まずはお気軽にご相談ください' }
        ]
    }
};

// ===== Webhookエンドポイント =====
app.post('/api/webhook', line.middleware(config), async (req, res) => {
    console.log('Webhook受信:', new Date().toISOString());
    console.log('Events:', JSON.stringify(req.body.events, null, 2));
    
    try {
        await Promise.all(req.body.events.map(handleEvent));
        res.json({ status: 'success' });
    } catch (err) {
        console.error('Webhook Error:', err);
        console.error('Error Stack:', err.stack);
        res.status(500).end();
    }
});

// ===== イベント処理メイン =====
async function handleEvent(event) {
    // テキストメッセージ以外は処理しない
    if (event.type !== 'message' || event.message.type !== 'text') {
        return null;
    }

    const userId = event.source.userId;
    const userMessage = event.message.text;
    
    // === 「予約する」は常に新規セッション開始 ===
    // リッチメニューから何度押しても最初から始まる
    if (userMessage === '予約する') {
        userSessions.delete(userId);  // 既存セッションを完全削除
        userSessions.set(userId, { step: 'initial', history: [] });
        return handleInitial(event, userSessions.get(userId));
    }
    
    // === 新規ユーザーの処理 ===
    if (!userSessions.has(userId)) {
        userSessions.set(userId, { step: 'initial', history: [] });
        return handleInitial(event, userSessions.get(userId));
    }
    
    const session = userSessions.get(userId);
    
    // === ナビゲーションコマンド ===
    if (userMessage === '前に戻る' || userMessage === '戻る') {
        console.log('戻る処理開始 - 現在のステップ:', session.step);
        
        if (session.history && session.history.length > 0) {
            const previousState = session.history.pop();
            Object.assign(session, previousState);
            userSessions.set(userId, session);
            return navigateToStep(event, session);
        } else {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'これ以上戻れません。最初からやり直しますか？',
                quickReply: {
                    items: [
                        {
                            type: 'action',
                            action: {
                                type: 'message',
                                label: '最初から',
                                text: '最初から'
                            }
                        }
                    ]
                }
            });
        }
    } 
    
    // === リセットコマンド ===
    else if (userMessage === '最初から' || userMessage === 'リセット' || userMessage === 'スタート' || userMessage === 'はじめる') {
        userSessions.delete(userId);  // セッション削除
        userSessions.set(userId, { step: 'initial', history: [] });
        return handleInitial(event, userSessions.get(userId));
    } 
    
    // === リッチメニュー：予約確認 ===
    else if (userMessage === '予約確認') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '📋 予約確認\n\n現在、予約はありません。\n\n新規予約は「予約する」ボタンからお申し込みください。',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '予約する',
                            text: '予約する'
                        }
                    }
                ]
            }
        });
    } 
    
    // === リッチメニュー：料金プラン ===
    else if (userMessage === '料金プラン' || userMessage === '料金') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `💰 料金プラン\n\n【Webサイト制作】\n✅ ベーシック：月額 5,500円\n✅ スタンダード：月額 11,000円\n✅ プレミアム：月額 22,000円\n\n【LINE予約システム】\n✅ ライト：月額 5,000円\n✅ スタンダード：月額 10,000円\n✅ プレミアム：月額 20,000円\n\n詳しくは「予約する」からお問い合わせください！`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '予約する',
                            text: '予約する'
                        }
                    }
                ]
            }
        });
    } 
    
    // === リッチメニュー：お問い合わせ ===
    else if (userMessage === 'お問い合わせ' || userMessage === '問合せ') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '💬 お問い合わせ\n\nご質問やご相談がございましたら、こちらのチャットに直接メッセージをお送りください。\n\n営業時間：平日 9:00-18:00\n\nお急ぎの場合は「予約する」から無料相談をお申し込みください。',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '予約する',
                            text: '予約する'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '料金プラン',
                            text: '料金プラン'
                        }
                    }
                ]
            }
        });
    } 
    
    // === リッチメニュー：ヘルプ ===
    else if (userMessage === 'ヘルプ' || userMessage === '使い方') {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `❓ ヘルプ\n\n【使い方】\n1️⃣「予約する」をタップ\n2️⃣ サービスを選択\n3️⃣ プランを選択\n4️⃣ お客様情報を入力\n5️⃣ 確認して完了！\n\n【よくある質問】\n❓ キャンセルは可能？\n→ はい、24時間前まで可能です\n\n❓ 支払い方法は？\n→ クレジットカード、銀行振込対応\n\n❓ 制作期間は？\n→ 最短3営業日〜`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '予約する',
                            text: '予約する'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '料金プラン',
                            text: '料金プラン'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'お問い合わせ',
                            text: 'お問い合わせ'
                        }
                    }
                ]
            }
        });
    }
    
    // === ステップごとの処理 ===
    switch (session.step) {
        case 'initial':
            return handleInitial(event, session);
        case 'select_service':
            return handleServiceSelection(event, session);
        case 'select_plan':
            return handlePlanSelection(event, session);
        case 'input_company':
            return handleCompanyInput(event, session);
        case 'input_name':
            return handleNameInput(event, session);
        case 'input_phone':
            return handlePhoneInput(event, session);
        case 'input_email':
            return handleEmailInput(event, session);
        case 'confirm_order':
            return handleOrderConfirmation(event, session);
        default:
            return handleInitial(event, session);
    }
}

// ===== ナビゲーション処理 =====
async function navigateToStep(event, session) {
    console.log('navigateToStep - ステップ:', session.step);
    
    switch (session.step) {
        case 'initial':
            return handleInitial(event, session);
        case 'select_service':
            return handleInitial(event, session);
        case 'select_plan':
            const service = SERVICES[session.service];
            const quickReplyItems = service.plans.map(plan => ({
                type: 'action',
                action: {
                    type: 'message',
                    label: plan.name,
                    text: plan.name
                }
            }));
            
            quickReplyItems.push(
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '前に戻る',
                        text: '前に戻る'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '最初から',
                        text: '最初から'
                    }
                }
            );
            
            const planDetails = service.plans.map(plan => 
                `【${plan.name}】\n${plan.price}\n${plan.description}`
            ).join('\n\n');
            
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `${service.name}ですね！\n\nプランをお選びください：\n\n${planDetails}`,
                quickReply: { items: quickReplyItems }
            });
        default:
            return handleInitial(event, session);
    }
}

// ===== 初期メッセージ =====
async function handleInitial(event, session) {
    session.step = 'select_service';
    
    const message = {
        type: 'text',
        text: 'こんにちは！SmartWeb Worksです✨\nご希望のサービスをお選びください',
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: 'Webサイト制作',
                        text: 'Webサイト制作'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: 'LINE予約システム',
                        text: 'LINE予約システム'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '無料相談',
                        text: '無料相談'
                    }
                }
            ]
        }
    };
    
    return client.replyMessage(event.replyToken, message);
}

// ===== サービス選択処理 =====
async function handleServiceSelection(event, session) {
    const userMessage = event.message.text;
    
    // 履歴を保存
    session.history = session.history || [];
    session.history.push({
        step: session.step,
        service: session.service
    });
    
    let service;
    if (userMessage === 'Webサイト制作') {
        service = SERVICES.WEBSITE;
        session.service = 'WEBSITE';
    } else if (userMessage === 'LINE予約システム') {
        service = SERVICES.LINE_BOOKING;
        session.service = 'LINE_BOOKING';
    } else if (userMessage === '無料相談') {
        service = SERVICES.CONSULTATION;
        session.service = 'CONSULTATION';
    } else {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'サービスを選択してください',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'Webサイト制作',
                            text: 'Webサイト制作'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: 'LINE予約システム',
                            text: 'LINE予約システム'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '無料相談',
                            text: '無料相談'
                        }
                    }
                ]
            }
        });
    }
    
    session.step = 'select_plan';
    userSessions.set(event.source.userId, session);
    
    const quickReplyItems = service.plans.map(plan => ({
        type: 'action',
        action: {
            type: 'message',
            label: plan.name,
            text: plan.name
        }
    }));
    
    quickReplyItems.push({
        type: 'action',
        action: {
            type: 'message',
            label: '前に戻る',
            text: '前に戻る'
        }
    });
    
    const planDetails = service.plans.map(plan => 
        `【${plan.name}】\n${plan.price}\n${plan.description}`
    ).join('\n\n');
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${service.name}ですね！\n\nプランをお選びください：\n\n${planDetails}`,
        quickReply: { items: quickReplyItems }
    });
}

// ===== プラン選択以降の処理（簡略化） =====
async function handlePlanSelection(event, session) {
    const userMessage = event.message.text;
    const service = SERVICES[session.service];
    const selectedPlan = service.plans.find(p => p.name === userMessage);
    
    if (!selectedPlan) {
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'プランを選択してください'
        });
    }
    
    session.plan = selectedPlan;
    session.step = 'input_company';
    userSessions.set(event.source.userId, session);
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `【${selectedPlan.name}】を選択されました！\n\n続いてお客様情報をお伺いします。\n\n会社名・店舗名を教えてください：`
    });
}

// ===== その他の入力処理（省略） =====
async function handleCompanyInput(event, session) {
    session.company = event.message.text;
    session.step = 'input_name';
    userSessions.set(event.source.userId, session);
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'お名前を教えてください：'
    });
}

async function handleNameInput(event, session) {
    session.name = event.message.text;
    session.step = 'input_phone';
    userSessions.set(event.source.userId, session);
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '電話番号を教えてください：'
    });
}

async function handlePhoneInput(event, session) {
    session.phone = event.message.text;
    session.step = 'input_email';
    userSessions.set(event.source.userId, session);
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'メールアドレスを教えてください：'
    });
}

async function handleEmailInput(event, session) {
    session.email = event.message.text;
    session.step = 'confirm_order';
    userSessions.set(event.source.userId, session);
    
    const confirmMessage = `
【ご注文内容の確認】

サービス：${SERVICES[session.service].name}
プラン：${session.plan.name}
料金：${session.plan.price}

【お客様情報】
会社名：${session.company}
お名前：${session.name}
電話番号：${session.phone}
メール：${session.email}

こちらの内容でよろしいですか？`;
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: confirmMessage,
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '注文を確定する',
                        text: '注文を確定する'
                    }
                },
                {
                    type: 'action',
                    action: {
                        type: 'message',
                        label: '最初から',
                        text: '最初から'
                    }
                }
            ]
        }
    });
}

async function handleOrderConfirmation(event, session) {
    if (event.message.text === '注文を確定する') {
        const orderId = `ORD-${Date.now()}`;
        const order = {
            id: orderId,
            ...session,
            timestamp: new Date().toISOString(),
            status: 'new'
        };
        
        orders.set(orderId, order);
        userSessions.delete(event.source.userId);
        
        return client.replyMessage(event.replyToken, [
            {
                type: 'text',
                text: `✅ ご注文を承りました！\n\n注文番号：${orderId}\n\n24時間以内に担当者よりご連絡させていただきます。`
            }
        ]);
    }
    
    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '「注文を確定する」をタップしてください。'
    });
}

// ===== ヘルスチェック =====
app.get('/api/webhook', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'LINE Webhook Server is running on Vercel',
        timestamp: new Date().toISOString()
    });
});

// ===== Vercel用エクスポート =====
module.exports = app;