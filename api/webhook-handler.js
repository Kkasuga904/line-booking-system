// LINE Webhook Handler - Version 1.0.2 - Using ES Modules
// Deploy Date: 2025-08-27
// IMPORTANT: Update VERSION when making changes to force cache refresh
import https from 'https';

const WEBHOOK_VERSION = '1.0.2';
const DEPLOY_DATE = '2025-08-27';

// Supabase設定
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

export default async function handler(req, res) {
  console.log(`=== Webhook v${WEBHOOK_VERSION} Start (${DEPLOY_DATE}) ===`);
  
  // 即座に200を返す（重要！）
  res.status(200).end();
  
  // バックグラウンドで処理
  processWebhook(req.body).catch(err => {
    console.error('Background process error:', err);
  });
};

// Webhookイベントを処理する非同期関数
async function processWebhook(body) {
  try {
    // 受信したボディをログ出力（デバッグ用）
    console.log('Body:', JSON.stringify(body));
    
    // イベントが存在しない場合は処理を終了
    if (!body?.events?.[0]) {
      console.log('No events');
      return;
    }
    
    // 最初のイベントを取得（LINEは複数イベントを送る場合がある）
    const event = body.events[0];
    
    // メッセージイベントの処理
    if (event.type === 'message' && event.message?.type === 'text') {
      const messageText = event.message.text.toLowerCase();
      console.log('Message:', event.message.text);
      console.log('User:', event.source?.userId || 'unknown');
      
      let replyText = '';
      
      // メッセージ内容に応じて返信を作成
      if (messageText.includes('予約')) {
        replyText = `ご予約はこちらから：\nhttps://liff.line.me/2006487876-xd1A5qJB\n\nまたは以下のリンクから：\nhttps://line-booking-system-seven.vercel.app/`;
      } else if (messageText.includes('確認') || messageText.includes('変更') || messageText.includes('キャンセル')) {
        replyText = '予約の確認・変更・キャンセルはこちら：\nhttps://line-booking-system-seven.vercel.app/manage';
      } else {
        replyText = `メッセージありがとうございます！\n\n【ご予約】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n【予約確認・変更】\nhttps://line-booking-system-seven.vercel.app/manage\n\nお気軽にご利用ください。`;
      }
      
      // LINE APIに返信
      await sendReplyWithHttps(event.replyToken, replyText);
    }
    
    // フォローイベントの処理
    if (event.type === 'follow') {
      console.log('New follower:', event.source?.userId);
      const welcomeText = `友だち追加ありがとうございます！\n\n【ご予約はこちら】\nhttps://liff.line.me/2006487876-xd1A5qJB\n\n予約の確認・変更・キャンセルも承っております。`;
      await sendReplyWithHttps(event.replyToken, welcomeText);
    }
    
  } catch (err) {
    console.error('Process error:', err);
  }
}

// HTTPSモジュールを使用したLINE返信
// fetch APIの代わりにNode.js標準のhttpsモジュールを使用（Vercelキャッシュ問題対策）
function sendReplyWithHttps(replyToken, text) {
  return new Promise((resolve, reject) => {
    // 環境変数からLINEアクセストークンを取得
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.error('NO TOKEN!');
      reject(new Error('No LINE token'));
      return;
    }
    
    console.log('Token found, preparing reply...');
    
    // LINE APIに送信するデータを準備
    const postData = JSON.stringify({
      replyToken: replyToken,  // 返信用の一時トークン（30秒間有効）
      messages: [{
        type: 'text',
        text: text  // 返信メッセージ本文
      }]
    });
    
    // HTTPSリクエストオプション
    const options = {
      hostname: 'api.line.me',
      port: 443,
      path: '/v2/bot/message/reply',  // LINE Reply APIエンドポイント
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,  // Bearer認証
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)  // Content-Lengthは必須
      }
    };
    
    console.log('Sending HTTPS request to LINE...');
    
    // HTTPSリクエストを作成・送信
    const req = https.request(options, (res) => {
      console.log('LINE Response Status:', res.statusCode);
      
      // レスポンスデータを収集
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // レスポンス完了時の処理
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Reply sent successfully!');
          resolve(data);
        } else {
          console.error('❌ LINE API Error:', res.statusCode);
          console.error('Response:', data);
          reject(new Error(`LINE API Error: ${res.statusCode}`));
        }
      });
    });
    
    // エラーハンドリング
    req.on('error', (e) => {
      console.error('HTTPS Error:', e);
      reject(e);
    });
    
    // POSTデータを送信してリクエストを終了
    req.write(postData);
    req.end();
  });
}