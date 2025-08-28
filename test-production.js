// 本番環境動作確認スクリプト

const baseUrl = 'https://line-booking-system-seven.vercel.app';

console.log('=== 本番環境動作確認 ===\n');

// 1. APIバージョン確認
console.log('1. APIバージョン確認...');
fetch(`${baseUrl}/api/version`)
  .then(res => res.json())
  .then(data => {
    console.log('✅ APIが動作しています:', data);
  })
  .catch(err => {
    console.error('❌ API接続エラー:', err);
  });

// 2. 管理画面の予約データ取得テスト
setTimeout(() => {
  console.log('\n2. 予約データ取得テスト...');
  fetch(`${baseUrl}/api/admin`)
    .then(res => res.json())
    .then(data => {
      if (data.reservations && data.reservations.length > 0) {
        console.log(`✅ ${data.reservations.length}件の予約を取得`);
        console.log('最新の予約:', data.reservations[0]);
      } else {
        console.log('⚠️ 予約データが0件です');
        console.log('環境変数の設定を確認してください');
      }
    })
    .catch(err => {
      console.error('❌ データ取得エラー:', err);
    });
}, 1000);

// 3. 環境変数チェック
setTimeout(() => {
  console.log('\n=== 必要な環境変数 ===');
  console.log('以下が正しく設定されているか確認:');
  console.log('- SUPABASE_URL');
  console.log('- SUPABASE_ANON_KEY');
  console.log('- LINE_CHANNEL_ACCESS_TOKEN');
  console.log('- LINE_CHANNEL_SECRET');
  console.log('- LIFF_ID');
  console.log('- STORE_ID (default-store)');
  console.log('\nVercelダッシュボードで確認:');
  console.log('https://vercel.com/tatatas-projects-a26fbad6/line-booking-system/settings/environment-variables');
}, 2000);