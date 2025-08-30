// 並行予約テスト - レースコンディションの検証
// 同時に複数の予約リクエストを送信し、容量制限が正しく動作することを確認

import fetch from 'node-fetch';
import pMap from 'p-map';

// テスト設定
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:8080',
  STORE_ID: 'default-store',
  TEST_DATE: new Date().toISOString().split('T')[0], // 今日の日付
  TEST_TIME: '18:00',
  MAX_GROUPS: 2,  // 設定された最大組数
  CONCURRENT_REQUESTS: 10,  // 同時リクエスト数
  PARTY_SIZE: 2
};

// ユニークなユーザーIDを生成
function generateUserId(index) {
  return `test-user-${Date.now()}-${index}`;
}

// 予約リクエストを送信
async function makeReservation(index) {
  const userId = generateUserId(index);
  const requestData = {
    store_id: CONFIG.STORE_ID,
    user_id: userId,
    user_name: `テストユーザー${index}`,
    date: CONFIG.TEST_DATE,
    time: CONFIG.TEST_TIME,
    party_size: CONFIG.PARTY_SIZE,
    source: 'test'
  };

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/reservation/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    return {
      index,
      success: response.ok && data.success,
      status: response.status,
      data,
      duration,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      index,
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

// 既存の予約をクリア
async function clearExistingReservations() {
  console.log('既存の予約をクリア中...');
  
  try {
    // Supabase直接アクセス（管理者権限必要）
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('store_id', CONFIG.STORE_ID)
      .eq('date', CONFIG.TEST_DATE)
      .eq('time', CONFIG.TEST_TIME)
      .in('status', ['confirmed', 'pending']);

    if (error) {
      console.warn('予約のクリアに失敗:', error.message);
    } else {
      console.log('既存の予約をクリアしました');
    }
  } catch (error) {
    console.warn('予約クリア中のエラー:', error.message);
  }
}

// メインテスト実行
async function runConcurrentTest() {
  console.log('='.repeat(60));
  console.log('並行予約テスト開始');
  console.log('='.repeat(60));
  console.log(`設定:`);
  console.log(`- API URL: ${CONFIG.API_URL}`);
  console.log(`- 店舗ID: ${CONFIG.STORE_ID}`);
  console.log(`- 日付: ${CONFIG.TEST_DATE}`);
  console.log(`- 時間: ${CONFIG.TEST_TIME}`);
  console.log(`- 最大組数: ${CONFIG.MAX_GROUPS}`);
  console.log(`- 同時リクエスト数: ${CONFIG.CONCURRENT_REQUESTS}`);
  console.log('='.repeat(60));

  // 既存予約をクリア
  await clearExistingReservations();

  // リクエストのインデックス配列を作成
  const requests = Array.from({ length: CONFIG.CONCURRENT_REQUESTS }, (_, i) => i + 1);

  console.log(`\n${CONFIG.CONCURRENT_REQUESTS}件の予約リクエストを同時送信中...`);
  const startTime = Date.now();

  // 同時実行（concurrency: Infinityで全て同時）
  const results = await pMap(requests, makeReservation, { concurrency: Infinity });

  const totalDuration = Date.now() - startTime;

  // 結果を集計
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const capacityFullCount = results.filter(r => 
    !r.success && (r.data?.code === 'CAPACITY_FULL' || r.data?.error === '満席')
  ).length;

  // 結果を表示
  console.log('\n' + '='.repeat(60));
  console.log('テスト結果:');
  console.log('='.repeat(60));
  console.log(`総リクエスト数: ${CONFIG.CONCURRENT_REQUESTS}`);
  console.log(`成功: ${successCount}件`);
  console.log(`失敗: ${failCount}件`);
  console.log(`  うち満席エラー: ${capacityFullCount}件`);
  console.log(`総実行時間: ${totalDuration}ms`);
  console.log('='.repeat(60));

  // 詳細結果
  console.log('\n詳細結果:');
  results.forEach(r => {
    const status = r.success ? '✅ 成功' : '❌ 失敗';
    const reason = r.success ? '' : 
      r.data?.code === 'CAPACITY_FULL' ? '(満席)' :
      r.error ? `(${r.error})` : `(${r.data?.error || 'エラー'})`;
    console.log(`  ${String(r.index).padStart(2)}: ${status} ${reason} - ${r.duration}ms`);
  });

  // 検証
  console.log('\n' + '='.repeat(60));
  console.log('検証結果:');
  console.log('='.repeat(60));
  
  const isValid = successCount <= CONFIG.MAX_GROUPS;
  const resultEmoji = isValid ? '✅' : '❌';
  
  console.log(`${resultEmoji} 成功数 (${successCount}) ≤ 最大組数 (${CONFIG.MAX_GROUPS}): ${isValid ? 'OK' : 'NG'}`);
  
  if (!isValid) {
    console.error('\n⚠️ エラー: 容量制限を超えて予約が成功しています！');
    console.error('レースコンディションが発生している可能性があります。');
  } else {
    console.log('\n✨ テスト成功: 容量制限が正しく動作しています。');
  }

  return {
    valid: isValid,
    successCount,
    failCount,
    capacityFullCount
  };
}

// 連続テスト（2回実行して累積をチェック）
async function runDoubleTest() {
  console.log('\n');
  console.log('*'.repeat(60));
  console.log('連続テスト開始（2回実行）');
  console.log('*'.repeat(60));

  // 1回目
  console.log('\n【1回目のテスト】');
  const result1 = await runConcurrentTest();

  // 少し待機
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2回目（既存予約を残したまま）
  console.log('\n【2回目のテスト】');
  console.log('※ 1回目の予約を残したまま実行');
  
  // クリアをスキップして実行
  const requests = Array.from({ length: CONFIG.CONCURRENT_REQUESTS }, (_, i) => i + 1);
  const results2 = await pMap(requests, makeReservation, { concurrency: Infinity });
  
  const successCount2 = results2.filter(r => r.success).length;
  
  console.log('\n' + '*'.repeat(60));
  console.log('累積検証:');
  console.log('*'.repeat(60));
  console.log(`1回目の成功数: ${result1.successCount}`);
  console.log(`2回目の成功数: ${successCount2}`);
  console.log(`累積成功数: ${result1.successCount + successCount2}`);
  
  const isCumulativeValid = (result1.successCount + successCount2) <= CONFIG.MAX_GROUPS;
  console.log(`\n${isCumulativeValid ? '✅' : '❌'} 累積成功数が最大組数以下: ${isCumulativeValid ? 'OK' : 'NG'}`);
  
  if (!isCumulativeValid) {
    console.error('\n⚠️ エラー: 累積で容量制限を超えています！');
  } else {
    console.log('\n✨ 累積テスト成功: 連続実行でも容量制限が維持されています。');
  }
}

// エントリーポイント
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--double')) {
    // 連続テスト
    await runDoubleTest();
  } else {
    // 単発テスト
    await runConcurrentTest();
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runConcurrentTest, clearExistingReservations };