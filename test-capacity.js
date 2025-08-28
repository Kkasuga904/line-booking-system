/**
 * キャパシティ管理システムのローカルテストスクリプト
 * 環境変数を設定してから各機能をテスト
 */

// 環境変数のモック設定
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock-key-for-testing';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

console.log('=== キャパシティ管理システム ローカルデバッグ ===\n');

// テスト1: コマンドパーサーのテスト
async function testCommandParser() {
  console.log('1. コマンドパーサーのテスト');
  console.log('================================');
  
  // パーサーの簡易実装（実際のインポートの代わり）
  const testCommands = [
    '/limit today 20',
    '/limit sat,sun lunch 5/h',
    '/limit 平日 17:00-20:00 10/h',
    '/stop today 18:00-',
    '/stop 12/25 終日',
    '/limits'
  ];
  
  for (const cmd of testCommands) {
    console.log(`\nコマンド: "${cmd}"`);
    const result = parseCapacityCommand(cmd);
    console.log('解析結果:', JSON.stringify(result, null, 2));
  }
}

// コマンド解析の簡易実装
function parseCapacityCommand(text) {
  if (text === '/limits') {
    return {
      action: 'list',
      message: '制限ルール一覧を取得'
    };
  }
  
  if (text.startsWith('/limit ')) {
    const params = text.substring(7);
    const parts = params.split(' ');
    
    // 簡易パース
    let result = {
      action: 'limit',
      raw: params
    };
    
    // 日付/曜日パターン
    if (parts[0] === 'today') {
      result.date_start = new Date().toISOString().split('T')[0];
      result.date_end = result.date_start;
    } else if (parts[0].includes(',')) {
      // 曜日リスト
      const weekdayMap = {
        'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5,
        'sat': 6, 'sun': 0,
        '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, 
        '土': 6, '日': 0
      };
      result.weekdays = parts[0].split(',').map(d => weekdayMap[d.toLowerCase()] ?? d);
    } else if (parts[0] === '平日') {
      result.weekdays = [1, 2, 3, 4, 5];
    } else if (parts[0] === '週末') {
      result.weekdays = [0, 6];
    }
    
    // 時間帯パターン
    const timePattern = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/;
    const timeMatch = params.match(timePattern);
    if (timeMatch) {
      result.time_start = `${timeMatch[1]}:${timeMatch[2]}`;
      result.time_end = `${timeMatch[3]}:${timeMatch[4]}`;
    }
    
    // 制限値パターン
    if (params.includes('/h')) {
      const limitMatch = params.match(/(\d+)\/h/);
      if (limitMatch) {
        result.limit_type = 'per_hour';
        result.limit_value = parseInt(limitMatch[1]);
      }
    } else if (params.includes('/day')) {
      const limitMatch = params.match(/(\d+)\/day/);
      if (limitMatch) {
        result.limit_type = 'per_day';
        result.limit_value = parseInt(limitMatch[1]);
      }
    } else {
      // 単純な数値の場合は1日制限と解釈
      const numberMatch = params.match(/(\d+)$/);
      if (numberMatch) {
        result.limit_type = 'per_day';
        result.limit_value = parseInt(numberMatch[1]);
      }
    }
    
    return result;
  }
  
  if (text.startsWith('/stop ')) {
    const params = text.substring(6);
    return {
      action: 'stop',
      raw: params,
      limit_type: 'stop'
    };
  }
  
  return {
    action: 'unknown',
    error: '未対応のコマンド'
  };
}

// テスト2: キャパシティ検証のテスト
async function testCapacityValidation() {
  console.log('\n\n2. キャパシティ検証のテスト');
  console.log('================================');
  
  // テスト予約データ
  const testReservations = [
    {
      store_id: 'restaurant-002',
      date: '2025-01-11', // 土曜日
      time: '12:00',
      seat_type: 'table',
      description: '土曜日ランチタイム'
    },
    {
      store_id: 'restaurant-002',
      date: '2025-01-13', // 月曜日
      time: '18:00',
      seat_type: 'counter',
      description: '平日夕方'
    },
    {
      store_id: 'restaurant-002',
      date: '2025-01-11',
      time: '20:00',
      seat_type: 'private',
      description: '土曜日夜'
    }
  ];
  
  for (const reservation of testReservations) {
    console.log(`\n予約: ${reservation.description}`);
    console.log(`  日時: ${reservation.date} ${reservation.time}`);
    console.log(`  席種: ${reservation.seat_type}`);
    
    const result = validateCapacity(reservation);
    if (result.allowed) {
      console.log('  ✅ 予約可能');
    } else {
      console.log(`  ❌ 予約不可: ${result.reason}`);
    }
  }
}

// キャパシティ検証の簡易実装
function validateCapacity(reservation) {
  const hour = parseInt(reservation.time.split(':')[0]);
  const reservationDate = new Date(reservation.date);
  const dayOfWeek = reservationDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // テストルール1: 週末ランチタイム
  if (isWeekend && hour >= 11 && hour <= 15) {
    // 仮の既存予約数
    const existingCount = Math.floor(Math.random() * 5);
    const limit = 3;
    console.log(`  適用ルール: 週末ランチタイム (${existingCount}/${limit}件)`);
    
    if (existingCount >= limit) {
      return {
        allowed: false,
        reason: `週末ランチタイム: 1時間あたり${limit}件まで（現在${existingCount}件）`
      };
    }
  }
  
  // テストルール2: 平日夕方
  if (!isWeekend && hour >= 17 && hour <= 20) {
    const existingCount = Math.floor(Math.random() * 7);
    const limit = 5;
    console.log(`  適用ルール: 平日夕方 (${existingCount}/${limit}件)`);
    
    if (existingCount >= limit) {
      return {
        allowed: false,
        reason: `平日夕方: 1時間あたり${limit}件まで（現在${existingCount}件）`
      };
    }
  }
  
  return { allowed: true };
}

// テスト3: Webhookコマンド処理のテスト
async function testWebhookCommands() {
  console.log('\n\n3. Webhookコマンド処理のテスト');
  console.log('================================');
  
  const testMessages = [
    { text: '/limits', userId: 'owner123' },
    { text: '/limit today 30', userId: 'owner123' },
    { text: '/stop 18:00-', userId: 'owner123' },
    { text: '予約したい', userId: 'customer456' },
    { text: '/limit 週末 10/h', userId: 'owner123' }
  ];
  
  for (const msg of testMessages) {
    console.log(`\nメッセージ: "${msg.text}"`);
    console.log(`ユーザーID: ${msg.userId}`);
    
    const response = processWebhookMessage(msg.text, msg.userId);
    console.log('返信:', response.message);
  }
}

// Webhookメッセージ処理の簡易実装
function processWebhookMessage(text, userId) {
  // 制限コマンドの処理
  if (text.startsWith('/limit') || text.startsWith('/stop') || text === '/limits') {
    // TODO: 実際の実装では権限チェックが必要
    if (userId === 'owner123') {
      const parsed = parseCapacityCommand(text);
      return {
        isCommand: true,
        success: true,
        message: `✅ ${text}\n処理しました: ${JSON.stringify(parsed)}`
      };
    } else {
      return {
        isCommand: true,
        success: false,
        message: '❌ このコマンドは管理者のみ使用可能です'
      };
    }
  }
  
  // 通常のメッセージ
  if (text.includes('予約')) {
    return {
      isCommand: false,
      message: '予約はこちらから:\nhttps://line-booking-account2-new.vercel.app/liff-calendar'
    };
  }
  
  return {
    isCommand: false,
    message: 'ご用件をお伺いします。「予約」とお送りください。'
  };
}

// テスト4: API エンドポイントのテスト
async function testAPIEndpoints() {
  console.log('\n\n4. API エンドポイントのテスト');
  console.log('================================');
  
  // APIリクエストのシミュレーション
  const testRequests = [
    {
      method: 'GET',
      path: '/api/capacity?action=rules',
      description: '制限ルール一覧取得'
    },
    {
      method: 'GET',
      path: '/api/capacity?action=stats&date=2025-01-11',
      description: 'キャパシティ統計取得'
    },
    {
      method: 'POST',
      path: '/api/capacity',
      body: { command: '/limit today 20' },
      description: '新規ルール作成'
    },
    {
      method: 'GET',
      path: '/api/capacity?action=validate&date=2025-01-11&time=12:00',
      description: '予約検証テスト'
    }
  ];
  
  for (const req of testRequests) {
    console.log(`\n${req.method} ${req.path}`);
    console.log(`目的: ${req.description}`);
    
    if (req.body) {
      console.log('Body:', JSON.stringify(req.body));
    }
    
    const response = simulateAPIRequest(req);
    console.log('Response:', JSON.stringify(response, null, 2));
  }
}

// APIリクエストのシミュレーション
function simulateAPIRequest(req) {
  const url = new URL('http://localhost:3000' + req.path);
  const action = url.searchParams.get('action');
  
  switch (req.method) {
    case 'GET':
      if (action === 'rules') {
        return {
          success: true,
          rules: [
            {
              id: 'rule-001',
              description: '週末ランチタイム: 1時間3件まで',
              limit_type: 'per_hour',
              limit_value: 3,
              active: true
            },
            {
              id: 'rule-002',
              description: '平日夕方: 1時間5件まで',
              limit_type: 'per_hour',
              limit_value: 5,
              active: true
            }
          ],
          total: 2
        };
      } else if (action === 'stats') {
        return {
          success: true,
          date: url.searchParams.get('date'),
          stats: [
            {
              rule_id: 'rule-001',
              current_count: 2,
              limit_value: 3,
              utilization: 0.67
            }
          ]
        };
      } else if (action === 'validate') {
        const result = validateCapacity({
          date: url.searchParams.get('date'),
          time: url.searchParams.get('time')
        });
        return {
          success: true,
          validation: result
        };
      }
      break;
      
    case 'POST':
      if (req.body.command) {
        const parsed = parseCapacityCommand(req.body.command);
        return {
          success: true,
          message: 'ルールを作成しました',
          rule: {
            id: 'rule-' + Date.now(),
            ...parsed
          }
        };
      }
      break;
  }
  
  return { success: false, error: 'Not implemented' };
}

// 全テストを実行
async function runAllTests() {
  try {
    await testCommandParser();
    await testCapacityValidation();
    await testWebhookCommands();
    await testAPIEndpoints();
    
    console.log('\n\n=== テスト完了 ===');
    console.log('✅ 全てのテストが完了しました');
    
    console.log('\n次のステップ:');
    console.log('1. Supabaseデータベースと実際に接続');
    console.log('2. LINE Webhookで実際のコマンドをテスト');
    console.log('3. 予約作成時のキャパシティチェック動作確認');
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
  }
}

// メイン実行
runAllTests();