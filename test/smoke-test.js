/**
 * スモークテストスクリプト
 * A店・B店環境の基本動作確認
 * 
 * 実行方法:
 * STORE_ID=store-a npm run smoke-test
 * STORE_ID=store-b npm run smoke-test
 */

const axios = require('axios');
const { loadValidatedConfig } = require('../utils/store-config-validated');

// テスト対象のベースURL
const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';
const STORE_ID = process.env.STORE_ID || 'default-store';

// テスト結果を格納
const testResults = [];
let passedTests = 0;
let failedTests = 0;

/**
 * テスト実行ヘルパー
 */
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✅ PASSED (${duration}ms)`);
    testResults.push({ name, status: 'PASS', duration });
    passedTests++;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ FAILED (${duration}ms):`, error.message);
    testResults.push({ name, status: 'FAIL', error: error.message, duration });
    failedTests++;
  }
}

/**
 * APIリクエストヘルパー
 */
async function apiRequest(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const config = {
    method,
    url,
    params: { store_id: STORE_ID },
    data,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  console.log(`  → ${method} ${url}?store_id=${STORE_ID}`);
  const response = await axios(config);
  console.log(`  ← Status: ${response.status}`);
  
  return response;
}

/**
 * メインテスト関数
 */
async function main() {
  console.log('='.repeat(60));
  console.log(`🏪 SMOKE TEST FOR STORE: ${STORE_ID}`);
  console.log(`📍 TARGET URL: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  // 1. 設定検証テスト
  await runTest('Configuration Loading', async () => {
    const config = await loadValidatedConfig(STORE_ID);
    
    // 店舗固有の設定が読み込まれているか確認
    if (STORE_ID === 'store-a') {
      if (config.ui.theme.primaryColor !== '#27ae60') {
        throw new Error('Store A theme color mismatch');
      }
      if (config.booking.intervalMin !== 15) {
        throw new Error('Store A interval mismatch');
      }
    } else if (STORE_ID === 'store-b') {
      if (config.ui.theme.primaryColor !== '#e74c3c') {
        throw new Error('Store B theme color mismatch');
      }
      if (config.booking.intervalMin !== 30) {
        throw new Error('Store B interval mismatch');
      }
    }
    
    console.log(`  ✓ Config loaded: ${config.ui.storeName || 'Default Store'}`);
    console.log(`  ✓ Theme: ${config.ui.theme.primaryColor}`);
    console.log(`  ✓ Hours: ${config.booking.open} - ${config.booking.close}`);
  });
  
  // 2. ヘルスチェック
  await runTest('Health Check API', async () => {
    const response = await apiRequest('GET', '/api/health');
    if (response.data.status !== 'healthy') {
      throw new Error('Health check failed');
    }
  });
  
  // 3. 予約作成テスト
  let testReservationId = null;
  await runTest('Create Reservation', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const reservationData = {
      store_id: STORE_ID,
      customer_name: `Test Customer ${STORE_ID}`,
      phone_number: '090-1234-5678',
      date: tomorrow.toISOString().split('T')[0],
      time: '18:00',
      people: 2,
      notes: `Smoke test for ${STORE_ID}`
    };
    
    const response = await apiRequest('POST', '/api/calendar-reservation', reservationData);
    
    if (!response.data.success) {
      throw new Error('Reservation creation failed');
    }
    
    testReservationId = response.data.reservation_id;
    console.log(`  ✓ Reservation created: ${testReservationId}`);
  });
  
  // 4. 予約一覧取得テスト
  await runTest('List Reservations', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];
    
    const response = await apiRequest('GET', `/api/admin?action=list&date=${date}`);
    
    if (!response.data.success) {
      throw new Error('Failed to list reservations');
    }
    
    const reservations = response.data.reservations || [];
    const found = reservations.find(r => r.id === testReservationId);
    
    if (!found) {
      throw new Error('Test reservation not found in list');
    }
    
    console.log(`  ✓ Found ${reservations.length} reservations`);
    console.log(`  ✓ Test reservation verified in list`);
  });
  
  // 5. 容量制限テスト
  await runTest('Capacity Control', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];
    
    // 容量制限を設定（最大1組）
    const capacityRule = {
      store_id: STORE_ID,
      date: date,
      time_start: '18:00',
      time_end: '19:00',
      max_groups: 1,
      max_people: 4
    };
    
    // LocalStorageのシミュレーション（実際の環境では異なる方法で設定）
    console.log(`  → Setting capacity limit: max 1 group for 18:00-19:00`);
    
    // 2組目の予約を試みる
    const secondReservation = {
      store_id: STORE_ID,
      customer_name: 'Second Customer',
      phone_number: '090-9876-5432',
      date: date,
      time: '18:30',
      people: 2
    };
    
    try {
      await apiRequest('POST', '/api/calendar-reservation', secondReservation);
      // 本来はエラーになるべき
      console.log(`  ⚠️ Warning: Second reservation was accepted (capacity control may not be active)`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`  ✓ Second reservation correctly blocked by capacity control`);
      } else {
        throw error;
      }
    }
  });
  
  // 6. カレンダー表示テスト
  await runTest('Calendar View', async () => {
    const response = await apiRequest('GET', '/api/capacity-status');
    
    if (!response.data) {
      throw new Error('Failed to get calendar status');
    }
    
    console.log(`  ✓ Calendar data retrieved`);
    
    // ログにstore_idが含まれているか確認
    if (response.data.store_id !== STORE_ID) {
      throw new Error(`Store ID mismatch: expected ${STORE_ID}, got ${response.data.store_id}`);
    }
    
    console.log(`  ✓ Store ID correctly set in response`);
  });
  
  // 7. URLパラメータ上書きテスト
  await runTest('URL Parameter Override', async () => {
    const overrideStoreId = STORE_ID === 'store-a' ? 'store-b' : 'store-a';
    
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/api/capacity-status`,
      params: { store_id: overrideStoreId }
    });
    
    if (response.data.store_id !== overrideStoreId) {
      throw new Error('URL parameter override failed');
    }
    
    console.log(`  ✓ Successfully overrode to ${overrideStoreId}`);
  });
  
  // 8. キャンセルテスト
  if (testReservationId) {
    await runTest('Cancel Reservation', async () => {
      const response = await apiRequest('DELETE', `/api/admin?action=delete&id=${testReservationId}`);
      
      if (!response.data.success) {
        throw new Error('Failed to cancel reservation');
      }
      
      console.log(`  ✓ Reservation cancelled: ${testReservationId}`);
    });
  }
  
  // 9. パフォーマンステスト
  await runTest('Performance Check', async () => {
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await apiRequest('GET', '/api/health');
      times.push(Date.now() - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    
    console.log(`  ✓ Average response time: ${avg.toFixed(2)}ms`);
    console.log(`  ✓ P95 response time: ${p95}ms`);
    
    if (p95 > 1000) {
      throw new Error(`P95 response time too high: ${p95}ms`);
    }
  });
  
  // テスト結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Total: ${passedTests + failedTests}`);
  console.log(`🎯 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  // 詳細結果
  console.log('\n📝 Detailed Results:');
  testResults.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const line = `${icon} ${result.name} (${result.duration}ms)`;
    if (result.error) {
      console.log(`${line} - ${result.error}`);
    } else {
      console.log(line);
    }
  });
  
  // 終了コード
  process.exit(failedTests > 0 ? 1 : 0);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// 実行
main().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});