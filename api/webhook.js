// Account 1 - Complete webhook with reservation features
// Version: FINAL-2.0
// Store: account-001

export default async function handler(req, res) {
  console.log('=== Account 1 Webhook FINAL v2.0 START ===');
  
  try {
    const body = req.body;
    const event = body?.events?.[0];
    
    // 返信不要なイベントは即200
    if (!event || event.type !== 'message' || !event.replyToken) {
      console.log('Skipping non-message event');
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!token) {
      console.error('CRITICAL: LINE_CHANNEL_ACCESS_TOKEN not set!');
      res.status(200).json({ ok: false, error: 'No token' });
      return;
    }

    console.log('Message received:', event.message?.text);
    
    // メッセージ内容に応じて返信を作成
    const userMessage = event.message?.text || '';
    let replyText = '';
    
    if (userMessage.includes('予約')) {
      replyText = `📅 ご予約を承ります！

下記リンクから詳細をご入力ください：
https://liff.line.me/2008001308-gDrXL5Y1

【営業時間】
月〜金: 10:00-20:00
土日祝: 10:00-18:00

お待ちしております！
[Account 1 - Store: account-001]`;
    } else if (userMessage.includes('キャンセル')) {
      replyText = `❌ 予約のキャンセルをご希望ですね。

恐れ入りますが、予約番号とお名前を
このメッセージに返信してお知らせください。

確認後、キャンセル処理をさせていただきます。
[Account 1 - Store: account-001]`;
    } else if (userMessage.includes('変更')) {
      replyText = `✏️ 予約の変更をご希望ですね。

恐れ入りますが、予約番号とご希望の
変更内容をこのメッセージに返信して
お知らせください。

確認後、変更処理をさせていただきます。
[Account 1 - Store: account-001]`;
    } else if (userMessage.includes('確認')) {
      replyText = `📋 予約の確認をご希望ですね。

恐れ入りますが、予約番号またはお名前を
このメッセージに返信してお知らせください。

予約内容を確認させていただきます。
[Account 1 - Store: account-001]`;
    } else if (userMessage.includes('営業') || userMessage.includes('時間')) {
      replyText = `🕐 営業時間のご案内

【通常営業】
月〜金: 10:00-20:00
土日祝: 10:00-18:00

【定休日】
年末年始（12/31-1/3）

ご予約は営業時間内で承っております。
[Account 1 - Store: account-001]`;
    } else if (userMessage.includes('場所') || userMessage.includes('アクセス')) {
      replyText = `📍 アクセス情報

【住所】
東京都渋谷区〇〇1-2-3
〇〇ビル 5F

【最寄駅】
JR渋谷駅 徒歩5分
東京メトロ〇〇駅 徒歩3分

Googleマップ:
https://maps.google.com/example

[Account 1 - Store: account-001]`;
    } else if (userMessage.toLowerCase().includes('hello') || userMessage.includes('こんにちは')) {
      replyText = `こんにちは！Account 1へようこそ 😊

ご利用いただきありがとうございます。
以下のメニューからお選びください：

📅 「予約」- 新規予約
❌ 「キャンセル」- 予約取消
✏️ 「変更」- 予約変更
📋 「確認」- 予約確認
🕐 「営業時間」- 営業時間案内
📍 「アクセス」- 場所案内

お気軽にメッセージをお送りください！
[Account 1 - Store: account-001]`;
    } else {
      replyText = `メッセージありがとうございます。

ご希望の内容をお選びください：

📅 「予約」- 新規予約
❌ 「キャンセル」- 予約取消
✏️ 「変更」- 予約変更
📋 「確認」- 予約確認
🕐 「営業時間」- 営業時間案内
📍 「アクセス」- 場所案内

その他のお問い合わせは、
お電話（03-XXXX-XXXX）でも承っております。

[Account 1 - Store: account-001]`;
    }
    
    // awaitで同期的に送信
    console.log('Sending reply to LINE API...');
    
    const r = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: replyText
        }]
      })
    });

    const responseText = await r.text();
    
    if (!r.ok) {
      console.error('LINE API Error:', r.status, responseText);
      res.status(200).json({ ok: false, lineStatus: r.status });
      return;
    }

    console.log('✅ Reply sent successfully!');
    res.status(200).json({ ok: true, sent: true });
    
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(200).json({ ok: false, error: e.message });
  }
  
  console.log('=== Account 1 Webhook FINAL v2.0 END ===');
}