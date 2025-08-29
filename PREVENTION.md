# 予約失敗防止ガイド - LINE予約システム

## 🛡️ 再発防止コード実装

### 0. データベーススキーマ互換性（最重要）

```javascript
// 🔴 CRITICAL: データベースフィールド名の自動検出と互換性処理
// Supabaseのreservationsテーブルのname/customer_nameフィールド問題対応
app.post('/api/calendar-reservation', async (req, res) => {
  const { date, time, name, phone, email, message, user_id } = req.body;
  
  // 必須フィールド検証
  if (!date || !time || !name || !phone) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: date, time, name, phone',
      received: { date: !!date, time: !!time, name: !!name, phone: !!phone }
    });
  }
  
  // データベーススキーマ互換性処理（再発防止の核心）
  const baseRecord = {
    store_id: process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***',
    date,
    time,
    phone,
    email,
    message,
    user_id,
    status: 'confirmed'
  };
  
  // 名前フィールドの複数パターン対応
  let insertSuccess = false;
  let lastError = null;
  
  // パターン1: customer_name フィールドを試行
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert([{ ...baseRecord, customer_name: name }])
      .select();
    
    if (!error) {
      console.log('✅ Inserted with customer_name field');
      return res.json({ success: true, reservation: data[0] });
    }
    lastError = error;
  } catch (e) {
    lastError = e;
  }
  
  // パターン2: name フィールドを試行（フォールバック）
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert([{ ...baseRecord, name: name }])
      .select();
    
    if (!error) {
      console.log('✅ Inserted with name field');
      return res.json({ success: true, reservation: data[0] });
    }
    lastError = error;
  } catch (e) {
    lastError = e;
  }
  
  // 両パターン失敗時のエラー処理
  console.error('❌ Both field patterns failed:', lastError?.message);
  res.status(500).json({
    success: false,
    error: lastError?.message || 'Database schema error',
    troubleshooting: 'Check Supabase table schema for name/customer_name field',
    attempted_fields: ['customer_name', 'name']
  });
});
```

### スキーマ検証ユーティリティ

```javascript
// 🔍 データベーススキーマ自動検証
class SchemaValidator {
  static async validateReservationsTable() {
    try {
      // テーブル構造を取得（Supabaseの場合）
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .limit(0); // メタデータのみ取得
      
      if (error) {
        console.error('Schema validation failed:', error);
        return { valid: false, error: error.message };
      }
      
      // 必須フィールドの確認
      const requiredFields = ['store_id', 'date', 'time', 'phone'];
      const nameFields = ['name', 'customer_name']; // どちらか1つ必要
      
      // 実際にテストINSERTを実行してフィールドを確認
      const testRecord = {
        store_id: 'test-validation',
        date: '2099-12-31',
        time: '23:59:00',
        phone: 'test',
        user_id: 'schema-test'
      };
      
      let hasNameField = false;
      for (const field of nameFields) {
        try {
          const { error } = await supabase
            .from('reservations')
            .insert([{ ...testRecord, [field]: 'test' }])
            .select();
          
          if (!error || !error.message.includes('column')) {
            hasNameField = field;
            // テストレコードを削除
            await supabase
              .from('reservations')
              .delete()
              .eq('user_id', 'schema-test');
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      return {
        valid: !!hasNameField,
        nameField: hasNameField,
        message: hasNameField 
          ? `Schema valid: using '${hasNameField}' field`
          : 'Schema invalid: no name/customer_name field found'
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  // 起動時スキーマチェック
  static async performStartupCheck() {
    console.log('🔍 Performing database schema validation...');
    const validation = await this.validateReservationsTable();
    
    if (!validation.valid) {
      console.error(JSON.stringify({
        severity: 'CRITICAL',
        msg: 'Database schema validation failed',
        error: validation.error || validation.message,
        action: 'Check Supabase table structure immediately'
      }));
      
      // アラート送信（実装に応じて）
      // await sendAdminAlert('Critical: Database schema mismatch detected');
    } else {
      console.log(JSON.stringify({
        severity: 'INFO',
        msg: 'Database schema validation successful',
        nameField: validation.nameField
      }));
      
      // 検証結果をキャッシュ（実行時に使用）
      process.env.RESERVATION_NAME_FIELD = validation.nameField;
    }
    
    return validation;
  }
}

// サーバー起動時に実行
SchemaValidator.performStartupCheck();
```

### 1. マルチStore ID管理（データベース統合）

```javascript
// 🔴 CRITICAL: 複数のstore_idが混在する問題への対応
// 環境移行やテスト時に異なるstore_idで保存されたデータを統合管理

class StoreIdManager {
  constructor() {
    // アカウントごとのstore_id履歴を管理
    this.storeIdMappings = {
      'account1': ['***REMOVED-ROTATE-CREDENTIAL***', 'main-store', 'store-001'],
      'account2': ['account2-store', 'restaurant-002', 'store-002'],
      'account3': ['account3-store', 'restaurant-003', 'store-003']
    };
  }
  
  // 現在のアカウントの全store_idを取得
  getStoreIds(accountType = 'account1') {
    const primaryStoreId = process.env.STORE_ID;
    const mappedIds = this.storeIdMappings[accountType] || [];
    
    // プライマリIDを先頭に、重複を排除
    const allIds = primaryStoreId 
      ? [primaryStoreId, ...mappedIds.filter(id => id !== primaryStoreId)]
      : mappedIds;
    
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Store ID mapping resolved',
      account: accountType,
      primary: primaryStoreId,
      all: allIds
    }));
    
    return allIds;
  }
  
  // データベースクエリ用のstore_id条件を生成
  getQueryCondition(supabase, tableName = 'reservations') {
    const accountType = process.env.ACCOUNT_TYPE || 'account1';
    const storeIds = this.getStoreIds(accountType);
    
    // 複数store_idでIN句を使用
    return {
      query: (query) => query.in('store_id', storeIds),
      storeIds: storeIds
    };
  }
}

const storeIdManager = new StoreIdManager();

// 使用例: 予約一覧取得
app.get('/api/reservations', async (req, res) => {
  try {
    // 複数store_idに対応した取得
    const storeIds = storeIdManager.getStoreIds('account2');
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .in('store_id', storeIds)  // 複数store_id対応
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (error) throw error;
    
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Fetched reservations for multiple store IDs',
      count: data?.length || 0,
      storeIds: storeIds
    }));
    
    res.json(data || []);
  } catch (error) {
    console.error('Multi-store fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 管理API - 複数store_id対応
app.all('/api/admin', async (req, res) => {
  const { action } = req.query;
  
  if (action === 'supabase') {
    const storeIds = storeIdManager.getStoreIds(process.env.ACCOUNT_TYPE);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .in('store_id', storeIds)
      .order('date', { ascending: true });
    
    res.json({
      success: true,
      data: data || [],
      storeIds: storeIds,
      message: `Showing data for ${storeIds.length} store ID(s)`
    });
  }
});
```

### Store ID移行時の注意事項

```javascript
// 🔍 Store ID監査ツール
class StoreIdAuditor {
  static async auditDatabase() {
    // データベース内の全store_idを調査
    const { data: storeIds, error } = await supabase
      .from('reservations')
      .select('store_id')
      .limit(1000);
    
    if (error) {
      console.error('Audit failed:', error);
      return;
    }
    
    // ユニークなstore_idを集計
    const uniqueStoreIds = [...new Set(storeIds.map(row => row.store_id))];
    
    console.log(JSON.stringify({
      severity: 'INFO',
      msg: 'Store ID audit results',
      uniqueStoreIds: uniqueStoreIds,
      count: uniqueStoreIds.length,
      recommendation: uniqueStoreIds.length > 1 
        ? 'Multiple store IDs detected - implement multi-store support'
        : 'Single store ID - standard configuration'
    }));
    
    return uniqueStoreIds;
  }
  
  // 起動時に自動実行
  static async performStartupAudit() {
    console.log('🔍 Performing store ID audit...');
    const storeIds = await this.auditDatabase();
    
    if (storeIds && storeIds.length > 1) {
      console.warn(JSON.stringify({
        severity: 'WARNING',
        msg: 'Multiple store IDs detected in database',
        storeIds: storeIds,
        action: 'Ensure StoreIdManager includes all IDs'
      }));
    }
    
    return storeIds;
  }
}

// サーバー起動時に実行
StoreIdAuditor.performStartupAudit();
```

### 2. Store ID不整合検出（サーバー側）

```javascript
// 予約API with 自動検証
app.post('/api/calendar-reservation', async (req, res) => {
  const serverStoreId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const { store_id, date, time, name, phone, email, message, user_id } = req.body;
  
  // 🛡️ 再発防止: Store ID不整合チェック
  if (store_id && store_id !== serverStoreId) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      msg: 'Store ID mismatch detected - prevention check',
      frontend_store_id: store_id,
      server_store_id: serverStoreId,
      troubleshooting: 'Check frontend HTML store_id configuration'
    }));
    return res.status(400).json({
      success: false,
      error: `Store ID mismatch: frontend=${store_id}, server=${serverStoreId}`,
      fix_required: 'Update HTML files to use correct store_id'
    });
  }
  
  try {
    // 予約処理続行...
    const { data, error } = await supabase
      .from('reservations')
      .insert([{
        store_id: serverStoreId, // サーバー側のIDを使用
        date, time, name, phone, email, message, user_id,
        status: 'confirmed',
        created_at: new Date().toISOString()
      }])
      .select();
      
    if (error) throw error;
    res.json({ success: true, reservation: data[0] });
    
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 2. 設定検証エンドポイント

```javascript
// 🔍 設定検証API
app.get('/api/config-check', (req, res) => {
  const serverStoreId = process.env.STORE_ID || '***REMOVED-ROTATE-CREDENTIAL***';
  const fs = require('fs');
  const path = require('path');
  
  let frontendStoreIds = [];
  let htmlFiles = ['enhanced-booking.html', 'admin-calendar-v2.html'];
  
  // HTML ファイルから store_id を検出
  htmlFiles.forEach(filename => {
    try {
      const htmlPath = path.join(__dirname, 'public', filename);
      const content = fs.readFileSync(htmlPath, 'utf8');
      
      const matches = content.match(/store_id['\s]*:['\s]*['"]([^'"]+)['"]/g);
      if (matches) {
        matches.forEach(match => {
          const extracted = match.match(/['"]([^'"]+)['"]/);
          if (extracted) {
            frontendStoreIds.push({
              file: filename,
              store_id: extracted[1]
            });
          }
        });
      }
    } catch (error) {
      console.warn(`Could not check ${filename}:`, error.message);
    }
  });
  
  const mismatches = frontendStoreIds.filter(item => item.store_id !== serverStoreId);
  
  res.json({
    server_store_id: serverStoreId,
    frontend_configs: frontendStoreIds,
    has_mismatches: mismatches.length > 0,
    mismatches: mismatches,
    status: mismatches.length > 0 ? 'ERROR' : 'OK',
    recommendations: mismatches.length > 0 ? [
      'Update HTML files to use correct store_id',
      'Verify environment STORE_ID variable',
      'Redeploy after fixing configuration'
    ] : ['Configuration is correct']
  });
});
```

### 3. 起動時自動検証

```javascript
// 🚀 サーバー起動時の設定検証
function validateStartupConfiguration() {
  const storeId = process.env.STORE_ID;
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN'
  ];
  
  console.log(JSON.stringify({
    severity: 'INFO',
    msg: 'Startup configuration validation',
    store_id: storeId || 'using-default',
    env_vars_present: requiredEnvVars.map(key => ({
      key: key,
      present: !!process.env[key]
    }))
  }));
  
  // 重要な設定の警告
  if (!storeId) {
    console.warn(JSON.stringify({
      severity: 'WARNING',
      msg: 'STORE_ID not configured, using default values',
      recommendation: 'Set STORE_ID environment variable for production'
    }));
  }
}

// サーバー起動時に実行
validateStartupConfiguration();
```

## 🔧 フロントエンド側防止策

### 1. Store ID設定の中央管理

```javascript
// config.js - 設定の一元管理
const APP_CONFIG = {
  // 環境に応じて自動設定
  getStoreId: () => {
    // URLから判定
    const hostname = window.location.hostname;
    if (hostname.includes('account2')) {
      return 'account2-store';
    }
    return '***REMOVED-ROTATE-CREDENTIAL***';
  },
  
  // API エンドポイント
  getApiBase: () => {
    return window.location.origin;
  }
};

// 使用例
const reservationData = {
  store_id: APP_CONFIG.getStoreId(), // 自動判定
  date: selectedDate,
  time: selectedTime + ':00'
};
```

### 2. 設定検証のフロントエンド実装

```javascript
// 🔍 フロントエンド設定検証
async function validateConfiguration() {
  try {
    const response = await fetch('/api/config-check');
    const config = await response.json();
    
    if (config.has_mismatches) {
      console.error('Configuration mismatch detected:', config);
      
      // ユーザーへの警告表示
      showConfigWarning(
        'システム設定にエラーがあります。管理者にお問い合わせください。',
        config.recommendations
      );
      return false;
    }
    
    console.log('Configuration validated successfully');
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    return false;
  }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', async () => {
  const isValid = await validateConfiguration();
  if (!isValid) {
    // 予約機能を無効化
    disableReservationFeatures();
  }
});
```

## 📊 監視とアラート

### 1. エラー検知パターン

```javascript
// 🚨 エラーパターンの監視
class ReservationMonitor {
  static trackError(error, context = {}) {
    const errorLog = {
      severity: 'ERROR',
      msg: 'Reservation system error',
      error: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
    };
    
    console.error(JSON.stringify(errorLog));
    
    // 特定パターンでアラート
    if (error.message.includes('Store ID mismatch')) {
      this.sendAlert('CRITICAL', 'Configuration Error Detected', errorLog);
    }
  }
  
  static sendAlert(level, title, details) {
    // Slack, Discord, メール等への通知実装
    console.error(`🚨 ${level}: ${title}`, details);
  }
}
```

### 2. ヘルスチェック強化

```javascript
// 💊 拡張ヘルスチェック
app.get('/api/health', async (req, res) => {
  const checks = {
    database: false,
    configuration: false,
    line_api: false,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Supabase接続確認
    const { error: dbError } = await supabase
      .from('reservations')
      .select('count')
      .limit(1);
    checks.database = !dbError;
    
    // 設定確認
    const configResponse = await fetch('/api/config-check');
    const configData = await configResponse.json();
    checks.configuration = !configData.has_mismatches;
    
    // LINE API確認（簡易）
    checks.line_api = !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && 
                        process.env.LINE_CHANNEL_SECRET);
    
  } catch (error) {
    console.error('Health check error:', error);
  }
  
  const isHealthy = Object.values(checks).every(check => check === true);
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks: checks,
    recommendations: isHealthy ? [] : [
      'Check database connection',
      'Verify configuration settings',
      'Confirm LINE API credentials'
    ]
  });
});
```

## 🚀 デプロイメント自動化

### 1. デプロイ前チェックスクリプト

```bash
#!/bin/bash
# deploy-check.sh - デプロイ前検証スクリプト

echo "🔍 Pre-deployment validation..."

# 環境変数チェック
required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "LINE_CHANNEL_SECRET" "LINE_CHANNEL_ACCESS_TOKEN")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

# HTMLファイルのstore_id チェック
if [ -f "public/enhanced-booking.html" ]; then
  store_ids=$(grep -o "store_id[[:space:]]*:[[:space:]]*['\"][^'\"]*['\"]" public/enhanced-booking.html || true)
  if [ -n "$store_ids" ]; then
    echo "📋 Found store_id configurations:"
    echo "$store_ids"
  fi
fi

echo "✅ Pre-deployment validation complete"
```

### 2. 自動修復機能

```javascript
// 🔧 自動修復ユーティリティ
class ConfigAutoFix {
  static async fixStoreIdMismatch(expectedStoreId) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const htmlFiles = [
      'public/enhanced-booking.html',
      'public/admin-calendar-v2.html'
    ];
    
    for (const filename of htmlFiles) {
      try {
        const filePath = path.join(__dirname, filename);
        let content = await fs.readFile(filePath, 'utf8');
        
        // store_id パターンを修正
        const updatedContent = content.replace(
          /store_id['\s]*:['\s]*['"]([^'"]+)['"]/g,
          `store_id: '${expectedStoreId}'`
        );
        
        if (content !== updatedContent) {
          await fs.writeFile(filePath, updatedContent);
          console.log(`✅ Auto-fixed store_id in ${filename}`);
        }
        
      } catch (error) {
        console.error(`❌ Could not auto-fix ${filename}:`, error.message);
      }
    }
  }
}
```

## 🔴 管理画面ルート設定（必須）

### 必須ルート定義
```javascript
// 🚨 重要: Express.jsの静的ファイル配信前に必ずルート定義
// これがないと404エラーになる

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的ファイル配信（最初に設定）
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 管理画面ルート（bodyパーサーの後、エラーハンドラーの前）
// ==========================================

// カレンダー管理画面
app.get('/admin-calendar', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'admin-calendar-v2.html');
  
  // ファイル存在確認（再発防止）
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return res.status(404).json({ 
      error: 'Admin calendar page not found',
      troubleshooting: 'Check if admin-calendar-v2.html exists in public directory'
    });
  }
  
  res.sendFile(filePath);
});

// 管理画面トップ
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 席管理画面
app.get('/seats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'seats-management.html'));
});

// ==========================================
// ルート検証ユーティリティ
// ==========================================
class RouteValidator {
  static validateAdminRoutes(app) {
    const requiredRoutes = [
      { path: '/admin', file: 'admin.html' },
      { path: '/admin-calendar', file: 'admin-calendar-v2.html' },
      { path: '/seats', file: 'seats-management.html' }
    ];
    
    const missingRoutes = [];
    const missingFiles = [];
    
    requiredRoutes.forEach(route => {
      // ルート存在確認
      const routeExists = app._router.stack.some(layer => 
        layer.route && layer.route.path === route.path
      );
      
      if (!routeExists) {
        missingRoutes.push(route.path);
      }
      
      // ファイル存在確認
      const filePath = path.join(__dirname, 'public', route.file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(route.file);
      }
    });
    
    if (missingRoutes.length > 0 || missingFiles.length > 0) {
      console.error(JSON.stringify({
        severity: 'ERROR',
        msg: 'Admin route validation failed',
        missingRoutes,
        missingFiles,
        action: 'Add missing routes and ensure HTML files exist'
      }));
      return false;
    }
    
    console.log('✅ All admin routes validated successfully');
    return true;
  }
}

// サーバー起動前に検証
RouteValidator.validateAdminRoutes(app);
```

### ルート設定チェックリスト
```javascript
// 🔍 デプロイ前確認事項
const deploymentChecklist = {
  routes: [
    '✓ /admin ルート定義',
    '✓ /admin-calendar ルート定義', 
    '✓ /seats ルート定義',
    '✓ 静的ファイル配信設定',
    '✓ bodyパーサー順序確認'
  ],
  files: [
    '✓ public/admin.html 存在確認',
    '✓ public/admin-calendar-v2.html 存在確認',
    '✓ public/seats-management.html 存在確認',
    '✓ public/enhanced-booking.html 存在確認'
  ],
  order: [
    '1. 静的ファイル設定 (express.static)',
    '2. ヘルスチェックAPI',
    '3. Webhook (express.raw)',
    '4. bodyパーサー (express.json)',
    '5. 管理画面ルート',
    '6. APIルート',
    '7. エラーハンドラー',
    '8. 404ハンドラー（最後）'
  ]
};
```

---

**実装優先度:**
1. 🔴 CRITICAL: データベーススキーマ互換性
2. 🔴 HIGH: 管理画面ルート設定
3. 🔴 HIGH: Store ID検証（サーバー側）
4. 🟡 MEDIUM: 設定検証エンドポイント
5. 🟢 LOW: 自動修復機能

**適用対象:**
- Account1: line-booking-system
- Account2: line-booking-account2-gcp (実装済み)