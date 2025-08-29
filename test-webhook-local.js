// ローカルでWebhook処理をテスト
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

console.log('=== ローカルWebhookテスト ===\n');
console.log('トークン長:', LINE_CHANNEL_ACCESS_TOKEN?.length);
console.log('トークン先頭:', LINE_CHANNEL_ACCESS_TOKEN?.substring(0, 10) + '...');

// テスト用のreplyToken（実際には使えない）
const testReplyToken = 'test_reply_token_' + Date.now();

// LINE Reply APIを呼び出し（エラーになるが、401か400かで判断）
console.log('\nLINE Reply APIテスト...');

fetch('https://api.line.me/v2/bot/message/reply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    replyToken: testReplyToken,
    messages: [{
      type: 'text',
      text: 'テストメッセージ'
    }]
  })
})
.then(res => {
  console.log('ステータス:', res.status);
  if (res.status === 401) {
    console.log('❌ トークンが無効です');
  } else if (res.status === 400) {
    console.log('✅ トークンは有効（replyTokenが無効なため400）');
  }
  return res.json();
})
.then(data => {
  console.log('レスポンス:', data);
  
  if (data.message === 'Invalid reply token') {
    console.log('\n✅ トークン認証成功！');
    console.log('（replyTokenが無効なのは正常）');
    console.log('\n次のステップ:');
    console.log('1. Vercel環境変数が最新か確認');
    console.log('2. LINE DevelopersでWebhookがONか確認');
    console.log('3. 応答メッセージがOFFか確認');
  }
})
.catch(err => {
  console.error('エラー:', err);
});