/**
 * 🧪 予約システム自動テスト
 * 
 * 予約機能の包括的なテストスイート
 * APIエンドポイント、データ検証、エラーハンドリングをテスト
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// テスト結果を格納
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// カラー出力用
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * テスト実行ヘルパー
 */
async function test(name, testFn) {
  process.stdout.write(`  ${name} ... `);
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✓${colors.reset} ${colors.gray}(${duration}ms)${colors.reset}`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed', duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`${colors.red}✗${colors.reset} ${colors.gray}(${duration}ms)${colors.reset}`);
    console.log(`    ${colors.red}Error: ${error.message}${colors.reset}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message, duration });
  }
}

/**
 * アサーション関数
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected non-null value, but got ${value}`);
  }
}

function assertIncludes(array, value, message) {
  if (!array.includes(value)) {
    throw new Error(
      message || `Expected array to include ${JSON.stringify(value)}`
    );
  }
}

/**
 * テストスイート: 予約作成
 */
async function testReservationCreation() {
  console.log(`\n${colors.blue}📝 予約作成テスト${colors.reset}`);
  
  await test('正常な予約作成', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const reservationData = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: tomorrow.toISOString().split('T')[0],
      time: '19:00:00',
      people: 2,
      customer_name: 'テスト太郎',
      phone: '090-1234-5678',
      message: 'テスト予約',
      user_id: 'test-' + Date.now()
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationData)
    });
    
    assert(response.ok, `Response status: ${response.status}`);
    
    const result = await response.json();
    assert(result.success, 'Reservation should be successful');
    assertNotNull(result.reservation, 'Reservation object should exist');
    assertNotNull(result.reservation.id, 'Reservation ID should exist');
    
    // クリーンアップ
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase
      .from('reservations')
      .delete()
      .eq('id', result.reservation.id);
  });
  
  await test('必須項目なしでエラー', async () => {
    const invalidData = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: '2024-12-31',
      time: '19:00:00'
      // customer_name と phone が欠落
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData)
    });
    
    assert(!response.ok, 'Response should fail');
    assertEquals(response.status, 400, 'Should return 400 Bad Request');
  });
  
  await test('過去の日付でエラー', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const pastData = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: yesterday.toISOString().split('T')[0],
      time: '19:00:00',
      people: 2,
      customer_name: 'テスト太郎',
      phone: '090-1234-5678',
      user_id: 'test-past'
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pastData)
    });
    
    assert(!response.ok, 'Should not allow past date reservation');
  });
  
  await test('無効な人数でエラー', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const invalidPeople = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: tomorrow.toISOString().split('T')[0],
      time: '19:00:00',
      people: -1, // 無効な人数
      customer_name: 'テスト太郎',
      phone: '090-1234-5678',
      user_id: 'test-invalid-people'
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPeople)
    });
    
    assert(!response.ok, 'Should not allow negative people count');
  });
}

/**
 * テストスイート: 予約取得
 */
async function testReservationRetrieval() {
  console.log(`\n${colors.blue}🔍 予約取得テスト${colors.reset}`);
  
  await test('Store IDによる予約取得', async () => {
    const response = await fetch(
      `${BASE_URL}/api/admin?action=supabase&store_id=***REMOVED-ROTATE-CREDENTIAL***`
    );
    
    assert(response.ok, `Response status: ${response.status}`);
    
    const result = await response.json();
    assert(Array.isArray(result.data), 'Should return array of reservations');
  });
  
  await test('日付範囲での予約取得', async () => {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(
      `${BASE_URL}/api/calendar-slots?store_id=***REMOVED-ROTATE-CREDENTIAL***&date=${today}`
    );
    
    assert(response.ok, `Response status: ${response.status}`);
    
    const result = await response.json();
    assertNotNull(result.slots, 'Should return slots object');
  });
}

/**
 * テストスイート: 席管理
 */
async function testSeatManagement() {
  console.log(`\n${colors.blue}🪑 席管理テスト${colors.reset}`);
  
  await test('席一覧の取得', async () => {
    const response = await fetch(
      `${BASE_URL}/api/seats-manage?store_id=***REMOVED-ROTATE-CREDENTIAL***`
    );
    
    assert(response.ok, `Response status: ${response.status}`);
    
    const result = await response.json();
    assert(result.success, 'Should successfully retrieve seats');
    assert(Array.isArray(result.seats), 'Should return array of seats');
  });
  
  await test('席のロック/アンロック', async () => {
    // まず席を取得
    const getResponse = await fetch(
      `${BASE_URL}/api/seats-manage?store_id=***REMOVED-ROTATE-CREDENTIAL***`
    );
    const { seats } = await getResponse.json();
    
    if (seats && seats.length > 0) {
      const seatId = seats[0].id;
      
      // ロック
      const lockResponse = await fetch(`${BASE_URL}/api/seats-manage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: seatId,
          is_locked: true
        })
      });
      
      assert(lockResponse.ok, 'Should successfully lock seat');
      
      // アンロック
      const unlockResponse = await fetch(`${BASE_URL}/api/seats-manage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: seatId,
          is_locked: false
        })
      });
      
      assert(unlockResponse.ok, 'Should successfully unlock seat');
    }
  });
}

/**
 * テストスイート: セキュリティ
 */
async function testSecurity() {
  console.log(`\n${colors.blue}🔐 セキュリティテスト${colors.reset}`);
  
  await test('SQLインジェクション防止', async () => {
    const maliciousData = {
      store_id: "'; DROP TABLE reservations; --",
      date: '2024-12-31',
      time: '19:00:00',
      people: 2,
      customer_name: "テスト'; DELETE FROM reservations WHERE '1'='1",
      phone: '090-1234-5678',
      user_id: 'test-sql-injection'
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousData)
    });
    
    // リクエストが拒否されるか、サニタイズされることを確認
    if (response.ok) {
      const result = await response.json();
      // 悪意のある文字が無害化されていることを確認
      assert(
        !result.reservation?.customer_name?.includes('DELETE'),
        'SQL injection should be prevented'
      );
    }
  });
  
  await test('XSS攻撃防止', async () => {
    const xssData = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: '2024-12-31',
      time: '19:00:00',
      people: 2,
      customer_name: '<script>alert("XSS")</script>',
      phone: '090-1234-5678',
      message: '<img src=x onerror=alert("XSS")>',
      user_id: 'test-xss'
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(xssData)
    });
    
    if (response.ok) {
      const result = await response.json();
      // スクリプトタグがエスケープされていることを確認
      assert(
        !result.reservation?.customer_name?.includes('<script>'),
        'XSS should be prevented'
      );
      assert(
        !result.reservation?.message?.includes('<img'),
        'XSS in message should be prevented'
      );
    }
  });
}

/**
 * テストスイート: パフォーマンス
 */
async function testPerformance() {
  console.log(`\n${colors.blue}⚡ パフォーマンステスト${colors.reset}`);
  
  await test('API応答速度 (< 1秒)', async () => {
    const startTime = Date.now();
    
    const response = await fetch(
      `${BASE_URL}/api/admin?action=supabase&store_id=***REMOVED-ROTATE-CREDENTIAL***`
    );
    
    const duration = Date.now() - startTime;
    assert(response.ok, 'Response should be successful');
    assert(duration < 1000, `Response time ${duration}ms should be under 1000ms`);
  });
  
  await test('同時リクエスト処理', async () => {
    const promises = [];
    
    // 10個の同時リクエスト
    for (let i = 0; i < 10; i++) {
      promises.push(
        fetch(`${BASE_URL}/api/calendar-slots?store_id=***REMOVED-ROTATE-CREDENTIAL***`)
      );
    }
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.ok).length;
    
    assert(successCount >= 8, `At least 8/10 requests should succeed (got ${successCount})`);
  });
}

/**
 * テストスイート: エンドツーエンド
 */
async function testEndToEnd() {
  console.log(`\n${colors.blue}🔄 エンドツーエンドテスト${colors.reset}`);
  
  await test('完全な予約フロー', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const testDate = tomorrow.toISOString().split('T')[0];
    const testTime = '18:00:00';
    
    // 1. 空き時間確認
    const slotsResponse = await fetch(
      `${BASE_URL}/api/calendar-slots?store_id=***REMOVED-ROTATE-CREDENTIAL***&date=${testDate}`
    );
    assert(slotsResponse.ok, 'Should get available slots');
    
    // 2. 予約作成
    const reservationData = {
      store_id: '***REMOVED-ROTATE-CREDENTIAL***',
      date: testDate,
      time: testTime,
      people: 4,
      customer_name: 'E2Eテスト',
      phone: '080-9999-9999',
      message: 'エンドツーエンドテスト',
      user_id: 'e2e-test-' + Date.now()
    };
    
    const createResponse = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservationData)
    });
    
    assert(createResponse.ok, 'Should create reservation');
    const { reservation } = await createResponse.json();
    assertNotNull(reservation.id, 'Should return reservation ID');
    
    // 3. 予約確認
    const confirmResponse = await fetch(
      `${BASE_URL}/api/admin?action=supabase&store_id=***REMOVED-ROTATE-CREDENTIAL***`
    );
    assert(confirmResponse.ok, 'Should retrieve reservations');
    
    const { data } = await confirmResponse.json();
    const found = data.find(r => r.id === reservation.id);
    assertNotNull(found, 'Created reservation should be found');
    
    // 4. クリーンアップ
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase
      .from('reservations')
      .delete()
      .eq('id', reservation.id);
  });
}

/**
 * テスト実行
 */
async function runTests() {
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}🧪 LINE予約システム 自動テスト開始${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`対象環境: ${BASE_URL}`);
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}\n`);
  
  const startTime = Date.now();
  
  try {
    await testReservationCreation();
    await testReservationRetrieval();
    await testSeatManagement();
    await testSecurity();
    await testPerformance();
    await testEndToEnd();
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // 結果サマリー
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}📊 テスト結果サマリー${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
  
  console.log(`${colors.green}✓ 成功: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}✗ 失敗: ${testResults.failed}${colors.reset}`);
  if (testResults.skipped > 0) {
    console.log(`${colors.yellow}○ スキップ: ${testResults.skipped}${colors.reset}`);
  }
  
  const total = testResults.passed + testResults.failed + testResults.skipped;
  const successRate = total > 0 ? Math.round((testResults.passed / total) * 100) : 0;
  
  console.log(`\n合計: ${total}件`);
  console.log(`成功率: ${successRate}%`);
  console.log(`実行時間: ${(totalDuration / 1000).toFixed(2)}秒`);
  
  if (testResults.failed > 0) {
    console.log(`\n${colors.red}失敗したテスト:${colors.reset}`);
    testResults.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`  - ${t.name}: ${t.error}`);
      });
  }
  
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
  
  // Exit code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 実行
runTests();