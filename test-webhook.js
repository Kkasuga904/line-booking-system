/**
 * Webhook APIテストスクリプト
 * 使用方法: node test-webhook.js
 */

const testCases = [
  {
    name: '正常な予約リクエスト',
    body: {
      events: [{
        type: 'message',
        message: { type: 'text', text: '予約 明日 18時 4名' },
        source: { userId: 'test-user-001' },
        replyToken: 'test-token-001'
      }]
    },
    expectedStatus: 200
  },
  {
    name: '空のイベント（LINE検証）',
    body: { events: [] },
    expectedStatus: 200
  },
  {
    name: 'レート制限テスト',
    body: {
      events: Array(15).fill({
        type: 'message',
        message: { type: 'text', text: '予約確認' },
        source: { userId: 'rate-limit-test' },
        replyToken: 'test-token'
      })
    },
    expectedStatus: 200
  },
  {
    name: '不正な入力（SQLインジェクション試行）',
    body: {
      events: [{
        type: 'message',
        message: { type: 'text', text: "予約'; DROP TABLE reservations; --" },
        source: { userId: 'malicious-user' },
        replyToken: 'test-token'
      }]
    },
    expectedStatus: 200
  },
  {
    name: '範囲外の予約データ',
    body: {
      events: [{
        type: 'message',
        message: { type: 'text', text: '予約 今日 25時 100名' },
        source: { userId: 'test-user' },
        replyToken: 'test-token'
      }]
    },
    expectedStatus: 200
  }
];

async function runTests() {
  console.log('🧪 Webhook APIテスト開始\n');
  
  const baseUrl = process.env.API_URL || 'http://localhost:3000/api/webhook-secure';
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      console.log(`📝 テスト: ${test.name}`);
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Line-Signature': 'test-signature'
        },
        body: JSON.stringify(test.body)
      });
      
      if (response.status === test.expectedStatus) {
        console.log(`✅ 成功 - Status: ${response.status}\n`);
        passed++;
      } else {
        console.log(`❌ 失敗 - Expected: ${test.expectedStatus}, Got: ${response.status}\n`);
        failed++;
      }
      
      // レート制限回避のため待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}\n`);
      failed++;
    }
  }
  
  console.log('📊 テスト結果');
  console.log(`✅ 成功: ${passed}件`);
  console.log(`❌ 失敗: ${failed}件`);
  console.log(`合計: ${testCases.length}件`);
  
  // ヘルスチェック
  console.log('\n🏥 ヘルスチェック');
  try {
    const healthResponse = await fetch(baseUrl.replace('POST', 'GET'));
    const health = await healthResponse.json();
    console.log('Status:', health.status);
    console.log('Database:', health.database);
    console.log('Security:', JSON.stringify(health.security, null, 2));
  } catch (error) {
    console.log('❌ ヘルスチェック失敗:', error.message);
  }
}

// Node.js環境チェック
if (typeof window === 'undefined') {
  // Node.js環境
  const fetch = require('node-fetch');
  global.fetch = fetch;
  runTests();
} else {
  // ブラウザ環境
  runTests();
}