/**
 * 🔍 LINE予約システム バリデーション・動作確認スクリプト
 * 
 * このスクリプトはシステム全体の動作を検証し、問題がないかをテストします。
 * 主なテスト項目:
 * - API応答性テスト（各エンドポイントの応答速度と正常性）
 * - データベース接続テスト（Supabase接続とテーブルアクセス）
 * - Store ID一貫性テスト（データの整合性確認）
 * - 予約作成テスト（実際の予約フローの動作確認）
 * - 席データテスト（席管理機能の確認）
 * - LINE設定テスト（環境変数とLIFF設定の検証）
 * - 公開ページアクセステスト（HTMLページの表示確認）
 * 
 * 使用方法: npm run validate:system
 * 推奨実行頻度: デプロイ後、問題発生時
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// 環境変数読み込み（.env.localファイルから）
dotenv.config({ path: '.env.local' });

// テスト対象のベースURL（本番環境または指定URL）
const BASE_URL = process.env.BASE_URL || 'https://line-booking-system-seven.vercel.app';

// テスト結果を格納するオブジェクト
const testResults = {
  passed: [],    // 成功したテスト
  failed: [],    // 失敗したテスト
  warnings: []   // 警告が出たテスト
};

/**
 * 個別テストを実行する汎用関数
 * 
 * @param {string} name - テスト名（表示用）
 * @param {Function} testFn - 実行するテスト関数
 * @returns {Promise<void>}
 */
async function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    const result = await testFn();
    if (result === true) {
      console.log('✅ PASSED');
      testResults.passed.push(name);
    } else if (result === 'warning') {
      console.log('⚠️ WARNING');
      testResults.warnings.push(name);
    } else {
      console.log('❌ FAILED');
      testResults.failed.push(name);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    testResults.failed.push(`${name}: ${error.message}`);
  }
}

/**
 * 1. API応答性テスト
 * 
 * 各APIエンドポイントに対してリクエストを送信し、応答時間と
 * ステータスコードを確認します。
 * 
 * テスト対象API:
 * - webhook-simple: LINE Webhook処理
 * - calendar-reservation: 予約作成API
 * - admin: 管理画面API（Supabase接続確認）
 * - seats-manage: 席管理API
 * - calendar-slots: 予約済み時間取得API
 * 
 * 判定基準:
 * - 3秒以上の応答: 警告
 * - 405 Method Not Allowed: 警告（POSTのみのAPIの場合正常）
 * - 500番台エラー: 失敗
 */
async function testApiResponsiveness() {
  // テスト対象のAPIエンドポイント一覧
  const apis = [
    '/api/webhook-simple',
    '/api/calendar-reservation',
    '/api/admin?action=supabase',
    '/api/seats-manage',
    '/api/calendar-slots'
  ];
  
  console.log('\n📡 API応答性テスト\n');
  
  for (const api of apis) {
    await runTest(`GET ${api}`, async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}${api}`);
      const time = Date.now() - start;
      
      if (response.status === 405) {
        // Method not allowedは許容（POSTのみのAPIの場合）
        return 'warning';
      }
      
      if (time > 3000) {
        console.log(`(遅延: ${time}ms)`);
        return 'warning';
      }
      
      return response.status < 500;
    });
  }
}

/**
 * 2. データベース接続テスト
 * 
 * Supabaseデータベースへの接続と基本的なクエリ実行を確認します。
 * 
 * テスト項目:
 * - Supabaseクライアントの接続確認
 * - reservationsテーブルへのアクセス
 * - seatsテーブルへのアクセス
 * 
 * 目的: データベース接続エラーの早期発見
 */
async function testDatabaseConnection() {
  console.log('\n🗄️ データベース接続テスト\n');
  
  // Supabaseクライアント初期化
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  await runTest('Supabase接続', async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('count')
      .limit(1);
    return !error;
  });
  
  await runTest('予約テーブルアクセス', async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .limit(1);
    return !error;
  });
  
  await runTest('席テーブルアクセス', async () => {
    const { data, error } = await supabase
      .from('seats')
      .select('id')
      .limit(1);
    return !error;
  });
}

/**
 * 3. Store ID一貫性テスト
 * 
 * 予約データと席データのstore_idが統一されているかを確認します。
 * これは過去に発生した「予約が管理画面に表示されない」問題を
 * 防ぐための重要なテストです。
 * 
 * テスト項目:
 * - 環境変数STORE_IDが'default-store'に設定されているか
 * - 予約データのstore_idが統一されているか
 * - 席データのstore_idが統一されているか
 * 
 * 判定基準:
 * - 不一致データが1件でもあれば失敗
 */
async function testStoreIdConsistency() {
  console.log('\n🏪 Store ID一貫性テスト\n');
  
  // 環境変数から期待されるStore IDを取得
  const targetStoreId = (process.env.STORE_ID || 'default-store').trim();
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  await runTest('環境変数STORE_ID設定', async () => {
    return process.env.STORE_ID === 'default-store';
  });
  
  await runTest('予約のstore_id統一性', async () => {
    const { data } = await supabase
      .from('reservations')
      .select('store_id')
      .neq('store_id', targetStoreId)
      .limit(10);
    
    if (data && data.length > 0) {
      console.log(`(${data.length}件の不一致)`);
      return false;
    }
    return true;
  });
  
  await runTest('席のstore_id統一性', async () => {
    const { data } = await supabase
      .from('seats')
      .select('store_id')
      .neq('store_id', targetStoreId)
      .limit(10);
    
    if (data && data.length > 0) {
      console.log(`(${data.length}件の不一致)`);
      return false;
    }
    return true;
  });
}

/**
 * 4. 予約作成テスト
 * 
 * 実際に予約APIを呼び出して、予約作成が正常に動作するかテストします。
 * テスト用のデータは作成後すぐに削除されます。
 * 
 * テスト内容:
 * - 明日の日付で予約を作成
 * - APIレスポンスの確認
 * - 作成された予約の削除（クリーンアップ）
 * 
 * 判定基準:
 * - 200 OKレスポンスが返ること
 * - レスポンスにreservation.idが含まれること
 */
async function testReservationCreation() {
  console.log('\n📝 予約作成テスト\n');
  
  // 明日の日付を取得（テスト用）
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const testDate = tomorrow.toISOString().split('T')[0];
  
  await runTest('予約API POST', async () => {
    const testData = {
      store_id: 'default-store',
      customer_name: 'バリデーションテスト',
      date: testDate,
      time: '15:00:00',
      people: 2,
      message: 'システムバリデーションテスト',
      user_id: 'validation-test',
      phone: '090-0000-0000'
    };
    
    const response = await fetch(`${BASE_URL}/api/calendar-reservation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.reservation && result.reservation.id) {
        // テストデータを削除
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        await supabase
          .from('reservations')
          .delete()
          .eq('id', result.reservation.id);
        return true;
      }
    }
    return false;
  });
}

/**
 * 5. 席データテスト
 * 
 * 席管理機能が正常に動作するかテストします。
 * 過去に「席データが表示されない」問題があったため重要なテストです。
 * 
 * テスト項目:
 * - 席データの存在確認
 * - is_lockedカラムの存在確認
 * - アクティブな席の存在確認
 * 
 * 判定基準:
 * - 席データが0件: 失敗
 * - is_lockedカラムがない: 失敗
 * - 利用可能な席が0席: 警告
 */
async function testSeatsData() {
  console.log('\n🪑 席データテスト\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  await runTest('席データ存在確認', async () => {
    const { data } = await supabase
      .from('seats')
      .select('*')
      .eq('store_id', 'default-store');
    
    if (!data || data.length === 0) {
      console.log('(席データなし)');
      return false;
    }
    console.log(`(${data.length}席)`);
    return true;
  });
  
  await runTest('is_lockedカラム存在', async () => {
    const { data, error } = await supabase
      .from('seats')
      .select('id, is_locked')
      .limit(1);
    
    if (error && error.message.includes('column')) {
      return false;
    }
    return true;
  });
  
  await runTest('アクティブな席存在', async () => {
    const { data } = await supabase
      .from('seats')
      .select('*')
      .eq('store_id', 'default-store')
      .eq('is_active', true)
      .eq('is_locked', false);
    
    if (!data || data.length === 0) {
      console.log('(利用可能な席なし)');
      return 'warning';
    }
    console.log(`(${data.length}席利用可能)`);
    return true;
  });
}

/**
 * 6. LINE関連設定テスト
 * 
 * LINE Bot機能に必要な環境変数と設定値を確認します。
 * 
 * テスト項目:
 * - LINE_CHANNEL_ACCESS_TOKEN設定確認
 * - LINE_CHANNEL_SECRET設定確認
 * - LIFF_ID設定確認
 * - LIFF_IDの形式確認（数字-英数字の形式）
 * 
 * 判定基準:
 * - いずれかの環境変数が未設定: 失敗
 * - LIFF_IDの形式が正しくない: 警告
 */
async function testLineConfiguration() {
  console.log('\n💬 LINE設定テスト\n');
  
  await runTest('LINE_CHANNEL_ACCESS_TOKEN設定', async () => {
    return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  });
  
  await runTest('LINE_CHANNEL_SECRET設定', async () => {
    return !!process.env.LINE_CHANNEL_SECRET;
  });
  
  await runTest('LIFF_ID設定', async () => {
    return !!process.env.LIFF_ID;
  });
  
  await runTest('LIFF_ID形式', async () => {
    const liffId = process.env.LIFF_ID;
    if (!liffId) return false;
    // LIFF IDの形式: 数字-英数字
    return /^\d+-[a-zA-Z0-9]+$/.test(liffId);
  });
}

/**
 * 7. HTMLページアクセステスト
 * 
 * 公開されているHTMLページが正常にアクセスできるかテストします。
 * 
 * テスト対象ページ:
 * - / (トップページ・予約一覧)
 * - /admin-calendar-v2.html (管理画面)
 * - /liff-calendar-v2.html (LIFF予約画面)
 * - /seats-management.html (席管理画面)
 * 
 * 判定基準:
 * - 200 OKレスポンスが返ること
 * - 404や500エラーが返らないこと
 */
async function testPublicPages() {
  console.log('\n🌐 公開ページアクセステスト\n');
  
  // テスト対象の公開ページ一覧
  const pages = [
    '/',
    '/admin-calendar-v2.html',
    '/liff-calendar-v2.html',
    '/seats-management.html'
  ];
  
  for (const page of pages) {
    await runTest(`GET ${page}`, async () => {
      const response = await fetch(`${BASE_URL}${page}`);
      return response.ok;
    });
  }
}

/**
 * テスト結果レポート出力関数
 * 
 * 実行されたすべてのテストの結果をまとめて表示し、
 * 総合的な判定とスコアを出力します。
 * 
 * 出力内容:
 * - 成功したテスト一覧
 * - 警告が出たテスト一覧
 * - 失敗したテスト一覧
 * - 総合スコア（成功率）
 * - システム状態の判定
 * 
 * Exit Code:
 * - 0: すべて成功
 * - 1: 失敗あり
 */
function printReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 バリデーション結果サマリー');
  console.log('='.repeat(50));
  
  console.log(`\n✅ 成功: ${testResults.passed.length}件`);
  testResults.passed.forEach(test => {
    console.log(`   - ${test}`);
  });
  
  if (testResults.warnings.length > 0) {
    console.log(`\n⚠️ 警告: ${testResults.warnings.length}件`);
    testResults.warnings.forEach(test => {
      console.log(`   - ${test}`);
    });
  }
  
  if (testResults.failed.length > 0) {
    console.log(`\n❌ 失敗: ${testResults.failed.length}件`);
    testResults.failed.forEach(test => {
      console.log(`   - ${test}`);
    });
  }
  
  const total = testResults.passed.length + testResults.warnings.length + testResults.failed.length;
  const score = Math.round((testResults.passed.length / total) * 100);
  
  console.log('\n' + '='.repeat(50));
  console.log(`総合スコア: ${score}% (${testResults.passed.length}/${total})`);
  
  if (score === 100) {
    console.log('🎉 すべてのテストに合格しました！');
  } else if (score >= 80) {
    console.log('👍 システムは概ね正常です');
  } else if (score >= 60) {
    console.log('⚠️ いくつかの問題があります');
  } else {
    console.log('🚨 システムに重大な問題があります');
  }
  console.log('='.repeat(50) + '\n');
  
  // Exit code
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

/**
 * メイン実行関数
 * 
 * すべてのバリデーションテストを順番に実行します。
 * エラーが発生してもできる限り他のテストを継続実行し、
 * 最終的に結果をまとめて報告します。
 * 
 * 実行順序:
 * 1. API応答性テスト
 * 2. データベース接続テスト
 * 3. Store ID一貫性テスト
 * 4. 予約作成テスト
 * 5. 席データテスト
 * 6. LINE設定テスト
 * 7. 公開ページアクセステスト
 * 8. 結果レポート出力
 */
async function validateSystem() {
  console.log('\n🔍 LINE予約システム バリデーション開始');
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log(`対象環境: ${BASE_URL}\n`);
  
  try {
    await testApiResponsiveness();
    await testDatabaseConnection();
    await testStoreIdConsistency();
    await testReservationCreation();
    await testSeatsData();
    await testLineConfiguration();
    await testPublicPages();
  } catch (error) {
    console.error('\n致命的エラー:', error);
  }
  
  printReport();
}

// スクリプト実行開始
// このファイルが直接実行された場合にvalidateSystem()を呼び出す
validateSystem();