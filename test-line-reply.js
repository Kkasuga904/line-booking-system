// LINE返信テストスクリプト
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

console.log('=== LINE返信機能診断 ===\n');

// 1. 環境変数チェック
console.log('1. 環境変数チェック');
if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
  console.log('\n解決方法:');
  console.log('1. .env.localファイルを確認');
  console.log('2. LINE_CHANNEL_ACCESS_TOKENが正しく設定されているか確認');
  process.exit(1);
}
console.log('✅ LINE_CHANNEL_ACCESS_TOKEN: 設定済み');
console.log(`   長さ: ${LINE_CHANNEL_ACCESS_TOKEN.length}文字`);
console.log(`   先頭: ${LINE_CHANNEL_ACCESS_TOKEN.substring(0, 10)}...`);

// 2. トークン検証
console.log('\n2. アクセストークン検証');
console.log('LINE APIでトークンを検証中...');

fetch('https://api.line.me/v2/bot/info', {
  headers: {
    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
  }
})
.then(response => {
  console.log(`   ステータス: ${response.status}`);
  return response.json();
})
.then(data => {
  if (data.userId) {
    console.log('✅ トークン有効');
    console.log(`   Bot名: ${data.displayName}`);
    console.log(`   Bot ID: ${data.userId}`);
  } else {
    console.error('❌ トークンが無効です');
    console.log('\n解決方法:');
    console.log('1. LINE Developersコンソールで新しいトークンを発行');
    console.log('2. .env.localを更新');
    console.log('3. Vercel環境変数を更新:');
    console.log('   vercel env rm LINE_CHANNEL_ACCESS_TOKEN production');
    console.log('   vercel env add LINE_CHANNEL_ACCESS_TOKEN production');
  }
})
.catch(error => {
  console.error('❌ API呼び出しエラー:', error.message);
});

// 3. Webhook設定確認方法
setTimeout(() => {
  console.log('\n3. Webhook設定確認');
  console.log('LINE Developers Consoleで以下を確認:');
  console.log('   - Webhook URL: https://line-booking-system-seven.vercel.app/api/webhook-simple');
  console.log('   - Webhookの利用: ON');
  console.log('   - 応答メッセージ: OFF（重要！）');
  
  console.log('\n4. 本番環境のWebhook状態');
  fetch('https://line-booking-system-seven.vercel.app/api/webhook-simple')
    .then(res => res.json())
    .then(data => {
      console.log('✅ Webhookエンドポイント: 正常');
      console.log('   レスポンス:', JSON.stringify(data));
    })
    .catch(err => {
      console.error('❌ Webhookエンドポイント: エラー');
    });
}, 1000);

// 5. トラブルシューティング
setTimeout(() => {
  console.log('\n=== トラブルシューティング ===');
  console.log('\n返信が来ない場合の確認事項:');
  console.log('1. LINE Developersで「Webhook」がONか確認');
  console.log('2. LINE Developersで「応答メッセージ」がOFFか確認');
  console.log('3. Webhook URLが最新か確認');
  console.log('4. アクセストークンが有効期限内か確認');
  console.log('\nコマンド:');
  console.log('  検証: node test-line-reply.js');
  console.log('  修正: node prevent-issues.js');
  console.log('  確認: vercel logs https://line-booking-system-seven.vercel.app');
}, 2000);