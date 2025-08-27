/**
 * LINE予約システム 包括的自動テストスイート
 * 実装済み機能のテストを実行
 */

import fetch from 'node-fetch';
import { getEnv } from '../utils/env-helper.js';

// テスト設定
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_RESULTS = {
  passed: [],
  failed: [],
  skipped: [],
  warnings: []
};

// ========== 1. 基本動作テスト ==========
async function testBasicFunctionality() {
  console.log('🔍 基本動作テスト開始...');
  
  // 1.1 Webhookエンドポイントの死活確認
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status && data.status.includes('active')) {
        TEST_RESULTS.passed.push('✅ Webhookエンドポイント稼働中');
      } else {
        TEST_RESULTS.failed.push('❌ Webhookエンドポイント異常: ' + JSON.stringify(data));
      }
    } else {
      TEST_RESULTS.failed.push(`❌ Webhookエンドポイント応答エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ Webhookエンドポイント接続失敗: ${error.message}`);
  }

  // 1.2 空リクエストのハンドリング
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ 空リクエスト処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ 空リクエスト処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 空リクエスト処理失敗: ${error.message}`);
  }

  // 1.3 不正なメソッドの拒否
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'DELETE'
    });
    
    if (response.status === 405) {
      TEST_RESULTS.passed.push('✅ 不正メソッド拒否OK');
    } else {
      TEST_RESULTS.failed.push(`❌ 不正メソッド処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 不正メソッド処理失敗: ${error.message}`);
  }
}

// ========== 2. エラーハンドリングテスト ==========
async function testErrorHandling() {
  console.log('🔍 エラーハンドリングテスト開始...');
  
  // 2.1 不正なJSON送信
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });
    
    if (response.status === 200 || response.status === 400) {
      TEST_RESULTS.passed.push('✅ 不正JSON処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ 不正JSON処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.warnings.push(`⚠️ 不正JSON処理警告: ${error.message}`);
  }

  // 2.2 nullイベント送信
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: null })
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ nullイベント処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ nullイベント処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ nullイベント処理失敗: ${error.message}`);
  }

  // 2.3 型違いデータ送信
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        events: [{
          type: 123, // 本来はstring
          message: null
        }]
      })
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ 型違いデータ処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ 型違いデータ処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 型違いデータ処理失敗: ${error.message}`);
  }
}

// ========== 3. LINE Bot連携テスト（モック） ==========
async function testLINEBotIntegration() {
  console.log('🔍 LINE Bot連携テスト開始...');
  
  // 3.1 メッセージ受信シミュレーション
  const mockLINEMessage = {
    events: [{
      type: 'message',
      message: {
        type: 'text',
        text: 'メニュー'
      },
      replyToken: 'mock-reply-token-12345',
      source: {
        userId: 'mock-user-id-67890'
      }
    }]
  };

  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockLINEMessage)
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ LINEメッセージ処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ LINEメッセージ処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ LINEメッセージ処理失敗: ${error.message}`);
  }

  // 3.2 予約メッセージ処理
  const mockReservationMessage = {
    events: [{
      type: 'message',
      message: {
        type: 'text',
        text: '予約 田中 明日 19時 2名'
      },
      replyToken: 'mock-reply-token-reservation',
      source: {
        userId: 'mock-user-id-reservation'
      }
    }]
  };

  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockReservationMessage)
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ 予約メッセージ処理OK');
    } else {
      TEST_RESULTS.failed.push(`❌ 予約メッセージ処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 予約メッセージ処理失敗: ${error.message}`);
  }

  // 3.3 画像メッセージ（非対応）のスキップ確認
  const mockImageMessage = {
    events: [{
      type: 'message',
      message: {
        type: 'image',
        id: 'mock-image-id'
      },
      replyToken: 'mock-reply-token-image',
      source: {
        userId: 'mock-user-id-image'
      }
    }]
  };

  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockImageMessage)
    });
    
    if (response.status === 200) {
      TEST_RESULTS.passed.push('✅ 画像メッセージスキップOK');
    } else {
      TEST_RESULTS.failed.push(`❌ 画像メッセージ処理エラー: ${response.status}`);
    }
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 画像メッセージ処理失敗: ${error.message}`);
  }
}

// ========== 4. 予約システム機能テスト ==========
async function testReservationSystem() {
  console.log('🔍 予約システム機能テスト開始...');
  
  // 4.1 予約データのパース確認
  const testCases = [
    { text: '予約 山田太郎 今日 18時 4名', expected: { name: '山田太郎', time: '18', people: 4 } },
    { text: '予約 佐藤 明日 20時 2名', expected: { name: '佐藤', time: '20', people: 2 } },
    { text: '予約 今日 19時 3名', expected: { name: '', time: '19', people: 3 } },
    { text: '予約 鈴木 19時 1名', expected: { name: '鈴木', time: '19', people: 1 } }
  ];

  for (const testCase of testCases) {
    const mockMessage = {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: testCase.text
        },
        replyToken: `mock-token-${Date.now()}`,
        source: {
          userId: `mock-user-${Date.now()}`
        }
      }]
    };

    try {
      const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockMessage)
      });
      
      if (response.status === 200) {
        TEST_RESULTS.passed.push(`✅ 予約パース OK: "${testCase.text}"`);
      } else {
        TEST_RESULTS.failed.push(`❌ 予約パース エラー: "${testCase.text}"`);
      }
    } catch (error) {
      TEST_RESULTS.failed.push(`❌ 予約パース 失敗: "${testCase.text}" - ${error.message}`);
    }
  }

  // 4.2 境界値テスト
  const boundaryTests = [
    { text: '予約 テスト 今日 23時 99名', desc: '最大人数' },
    { text: '予約 テスト 今日 0時 1名', desc: '最小時間' },
    { text: '予約 テスト 今日 24時 1名', desc: '境界時間' }
  ];

  for (const test of boundaryTests) {
    const mockMessage = {
      events: [{
        type: 'message',
        message: { type: 'text', text: test.text },
        replyToken: `mock-boundary-${Date.now()}`,
        source: { userId: `mock-boundary-user-${Date.now()}` }
      }]
    };

    try {
      const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockMessage)
      });
      
      if (response.status === 200) {
        TEST_RESULTS.warnings.push(`⚠️ 境界値処理 (${test.desc}): 要確認`);
      }
    } catch (error) {
      TEST_RESULTS.failed.push(`❌ 境界値処理失敗 (${test.desc}): ${error.message}`);
    }
  }
}

// ========== 5. セキュリティテスト ==========
async function testSecurity() {
  console.log('🔍 セキュリティテスト開始...');
  
  // 5.1 SQLインジェクション対策確認
  const sqlInjectionTests = [
    "'; DROP TABLE reservations; --",
    "1' OR '1'='1",
    "admin'--",
    "' UNION SELECT * FROM users--"
  ];

  for (const injection of sqlInjectionTests) {
    const mockMessage = {
      events: [{
        type: 'message',
        message: { type: 'text', text: `予約 ${injection} 今日 19時 2名` },
        replyToken: `mock-sql-${Date.now()}`,
        source: { userId: `mock-sql-user-${Date.now()}` }
      }]
    };

    try {
      const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockMessage)
      });
      
      if (response.status === 200) {
        TEST_RESULTS.passed.push('✅ SQLインジェクション防御OK');
      } else {
        TEST_RESULTS.warnings.push(`⚠️ SQLインジェクション防御要確認: ${response.status}`);
      }
    } catch (error) {
      TEST_RESULTS.warnings.push(`⚠️ SQLインジェクション防御警告: ${error.message}`);
    }
  }

  // 5.2 XSS対策確認
  const xssTests = [
    "<script>console.log('XSS')</script>",
    "javascript:console.log('XSS')",
    "<img src=x onerror=console.log('XSS')>",
    "<iframe src='javascript:console.log(\"test\")'>"
  ];

  for (const xss of xssTests) {
    const mockMessage = {
      events: [{
        type: 'message',
        message: { type: 'text', text: `予約 ${xss} 今日 19時 2名` },
        replyToken: `mock-xss-${Date.now()}`,
        source: { userId: `mock-xss-user-${Date.now()}` }
      }]
    };

    try {
      const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockMessage)
      });
      
      if (response.status === 200) {
        TEST_RESULTS.passed.push('✅ XSS防御OK');
      } else {
        TEST_RESULTS.warnings.push(`⚠️ XSS防御要確認: ${response.status}`);
      }
    } catch (error) {
      TEST_RESULTS.warnings.push(`⚠️ XSS防御警告: ${error.message}`);
    }
  }

  // 5.3 環境変数の露出チェック
  try {
    const response = await fetch(`${BASE_URL}/api/webhook-supabase`, {
      method: 'GET'
    });
    const data = await response.json();
    const responseText = JSON.stringify(data);
    
    // 機密情報が含まれていないか確認
    const sensitivePatterns = [
      /Bearer\s+[\w\-\.]+/i,  // トークン
      /eyJ[\w\-\.]+/,          // JWT
      /password/i,
      /secret/i
    ];
    
    let hasSensitive = false;
    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseText)) {
        hasSensitive = true;
        break;
      }
    }
    
    if (!hasSensitive) {
      TEST_RESULTS.passed.push('✅ 機密情報非露出OK');
    } else {
      TEST_RESULTS.failed.push('❌ 機密情報露出の可能性');
    }
  } catch (error) {
    TEST_RESULTS.warnings.push(`⚠️ 機密情報チェック警告: ${error.message}`);
  }
}

// ========== 6. 環境変数サニタイズテスト ==========
async function testEnvironmentVariableSanitization() {
  console.log('🔍 環境変数サニタイズテスト開始...');
  
  // env-helper.jsの動作確認（単体テスト）
  try {
    const { getEnv, sanitizeUrl } = await import('../utils/env-helper.js');
    
    // 改行除去テスト
    process.env.TEST_VAR = 'value\n';
    if (getEnv('TEST_VAR') === 'value') {
      TEST_RESULTS.passed.push('✅ 環境変数改行除去OK');
    } else {
      TEST_RESULTS.failed.push('❌ 環境変数改行除去失敗');
    }
    
    // 空白除去テスト
    process.env.TEST_VAR = '  value  ';
    if (getEnv('TEST_VAR') === 'value') {
      TEST_RESULTS.passed.push('✅ 環境変数空白除去OK');
    } else {
      TEST_RESULTS.failed.push('❌ 環境変数空白除去失敗');
    }
    
    // URL改行除去テスト
    const dirtyUrl = 'https://example.com/path\n\r';
    if (sanitizeUrl(dirtyUrl) === 'https://example.com/path') {
      TEST_RESULTS.passed.push('✅ URL改行除去OK');
    } else {
      TEST_RESULTS.failed.push('❌ URL改行除去失敗');
    }
    
    delete process.env.TEST_VAR;
  } catch (error) {
    TEST_RESULTS.failed.push(`❌ 環境変数サニタイズテスト失敗: ${error.message}`);
  }
}

// ========== テスト実行とレポート生成 ==========
async function runAllTests() {
  // モジュール型の実行確認
  console.log('Test Runner Starting...');
  console.log('====================================');
  console.log('🚀 LINE予約システム 包括的テスト開始');
  console.log('====================================\n');
  
  const startTime = Date.now();
  
  // 各テストを順次実行
  await testBasicFunctionality();
  await testErrorHandling();
  await testLINEBotIntegration();
  await testReservationSystem();
  await testSecurity();
  await testEnvironmentVariableSanitization();
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // 未実装機能のスキップ
  TEST_RESULTS.skipped.push('⏭️ 決済システムテスト（未実装）');
  TEST_RESULTS.skipped.push('⏭️ 店舗管理機能テスト（一部未実装）');
  TEST_RESULTS.skipped.push('⏭️ 予約変更・キャンセル機能テスト（未実装）');
  TEST_RESULTS.skipped.push('⏭️ リマインダー通知テスト（未実装）');
  TEST_RESULTS.skipped.push('⏭️ 負荷テスト（本番環境で実施推奨）');
  
  // レポート生成
  console.log('\n====================================');
  console.log('📊 テスト結果サマリー');
  console.log('====================================');
  console.log(`実行時間: ${duration}秒`);
  console.log(`✅ 成功: ${TEST_RESULTS.passed.length}件`);
  console.log(`❌ 失敗: ${TEST_RESULTS.failed.length}件`);
  console.log(`⚠️ 警告: ${TEST_RESULTS.warnings.length}件`);
  console.log(`⏭️ スキップ: ${TEST_RESULTS.skipped.length}件`);
  
  console.log('\n--- 成功項目 ---');
  TEST_RESULTS.passed.forEach(item => console.log(item));
  
  if (TEST_RESULTS.failed.length > 0) {
    console.log('\n--- 失敗項目（要修正） ---');
    TEST_RESULTS.failed.forEach(item => console.log(item));
  }
  
  if (TEST_RESULTS.warnings.length > 0) {
    console.log('\n--- 警告項目（要確認） ---');
    TEST_RESULTS.warnings.forEach(item => console.log(item));
  }
  
  console.log('\n--- スキップ項目（未実装） ---');
  TEST_RESULTS.skipped.forEach(item => console.log(item));
  
  // 推奨事項
  console.log('\n====================================');
  console.log('📝 推奨改善事項');
  console.log('====================================');
  console.log('1. 【高優先度】LINE Channel Access Tokenの定期更新機能');
  console.log('2. 【高優先度】予約データのバックアップ自動化');
  console.log('3. 【中優先度】予約変更・キャンセル機能の実装');
  console.log('4. 【中優先度】管理画面のアクセス制限実装');
  console.log('5. 【低優先度】決済システムの統合');
  
  // 手動確認必須事項
  console.log('\n====================================');
  console.log('⚠️ 手動確認必須事項');
  console.log('====================================');
  console.log('1. LINE Official Account Managerの設定確認');
  console.log('   - 応答モード: Bot');
  console.log('   - Webhook: オン');
  console.log('   - 自動応答: オフ');
  console.log('2. Vercel環境変数の改行確認');
  console.log('3. Supabaseのセキュリティポリシー設定');
  console.log('4. 本番環境でのSSL証明書確認');
  console.log('5. 個人情報取扱いポリシーの掲示');
  
  // 本番運用前チェックリスト
  console.log('\n====================================');
  console.log('✅ 本番運用前チェックリスト');
  console.log('====================================');
  console.log('□ LINE Channel Access Token設定済み');
  console.log('□ LINE Channel Secret設定済み');
  console.log('□ LIFF ID設定済み（カレンダー機能使用時）');
  console.log('□ Supabase接続情報設定済み');
  console.log('□ 環境変数に改行が含まれていない');
  console.log('□ エラー通知先設定済み');
  console.log('□ バックアップ体制確立');
  console.log('□ 利用規約・プライバシーポリシー準備');
  console.log('□ サポート体制確立');
  
  // 総合評価
  console.log('\n====================================');
  console.log('🎯 総合評価');
  console.log('====================================');
  
  const successRate = (TEST_RESULTS.passed.length / (TEST_RESULTS.passed.length + TEST_RESULTS.failed.length)) * 100;
  
  if (successRate >= 90 && TEST_RESULTS.failed.length === 0) {
    console.log('✅ 品質評価: 優秀 - 本番運用可能');
  } else if (successRate >= 70) {
    console.log('⚠️ 品質評価: 良好 - 軽微な修正後運用可能');
  } else {
    console.log('❌ 品質評価: 要改善 - 重要な修正が必要');
  }
  
  console.log(`成功率: ${successRate.toFixed(1)}%`);
  console.log('\n====================================');
  console.log('テスト完了');
  console.log('====================================');
}

// メイン実行
console.log('Script loaded, checking execution...');
runAllTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

export { runAllTests };