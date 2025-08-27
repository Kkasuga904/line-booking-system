#!/usr/bin/env node

// Webhook検証スクリプト
// 使用方法: node scripts/validate-webhook.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateWebhookFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];
  
  // Check 1: ES Module形式の確認
  if (content.includes('require(') || content.includes('module.exports')) {
    errors.push('CommonJS形式が使用されています。ES Module形式に変換してください。');
  }
  
  // Check 2: export defaultの確認
  if (!content.includes('export default')) {
    errors.push('export defaultが見つかりません。');
  }
  
  // Check 3: 即座にレスポンスを返しているか
  const hasEarlyResponse = content.includes('res.status(200)');
  if (!hasEarlyResponse) {
    warnings.push('200レスポンスが見つかりません。LINEは即座のレスポンスを期待します。');
  }
  
  // Check 4: エラーハンドリング
  if (!content.includes('try') || !content.includes('catch')) {
    warnings.push('try-catchブロックが見つかりません。エラーハンドリングを追加してください。');
  }
  
  // Check 5: 環境変数チェック
  if (content.includes('process.env.LINE_CHANNEL_ACCESS_TOKEN')) {
    if (!content.includes('if (!process.env.LINE_CHANNEL_ACCESS_TOKEN)')) {
      warnings.push('LINE_CHANNEL_ACCESS_TOKENの存在チェックがありません。');
    }
  }
  
  // Check 6: ログ出力
  if (!content.includes('console.log')) {
    warnings.push('デバッグ用のログ出力がありません。');
  }
  
  return { errors, warnings };
}

function validateAllWebhooks() {
  const apiDir = path.join(__dirname, '..', 'api');
  const webhookFiles = fs.readdirSync(apiDir)
    .filter(file => file.includes('webhook') && file.endsWith('.js'));
  
  log('\n=== Webhook検証開始 ===\n');
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const file of webhookFiles) {
    const filePath = path.join(apiDir, file);
    log(`検証中: ${file}`);
    
    const { errors, warnings } = validateWebhookFile(filePath);
    
    if (errors.length > 0) {
      log(`  ❌ エラー: ${errors.length}件`, 'red');
      errors.forEach(error => log(`    - ${error}`, 'red'));
      totalErrors += errors.length;
    }
    
    if (warnings.length > 0) {
      log(`  ⚠️  警告: ${warnings.length}件`, 'yellow');
      warnings.forEach(warning => log(`    - ${warning}`, 'yellow'));
      totalWarnings += warnings.length;
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      log('  ✅ 問題なし', 'green');
    }
    
    console.log('');
  }
  
  log('=== 検証結果 ===');
  
  if (totalErrors > 0) {
    log(`❌ 合計エラー: ${totalErrors}件`, 'red');
  } else {
    log('✅ エラーなし', 'green');
  }
  
  if (totalWarnings > 0) {
    log(`⚠️  合計警告: ${totalWarnings}件`, 'yellow');
  }
  
  // エラーがある場合は終了コード1で終了
  if (totalErrors > 0) {
    process.exit(1);
  }
}

// 環境変数チェック
function checkEnvironmentVariables() {
  log('\n=== 環境変数チェック ===\n');
  
  const required = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'LIFF_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  
  const missing = [];
  
  for (const envVar of required) {
    if (process.env[envVar]) {
      log(`✅ ${envVar}: 設定済み`, 'green');
    } else {
      log(`❌ ${envVar}: 未設定`, 'red');
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    log('\n以下の環境変数を設定してください:', 'yellow');
    missing.forEach(env => log(`  vercel env add ${env}`, 'yellow'));
  }
}

// メイン処理
validateAllWebhooks();
checkEnvironmentVariables();