#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// チェック結果
const checks = {
  passed: [],
  failed: [],
  warnings: []
};

// カラー出力
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, type = 'info') {
  const prefix = {
    error: `${colors.red}✗`,
    success: `${colors.green}✓`,
    warning: `${colors.yellow}⚠`,
    info: `${colors.blue}ℹ`
  };
  console.log(`${prefix[type]} ${message}${colors.reset}`);
}

// 1. package.json検証
async function checkPackageJson() {
  log('package.json検証中...', 'info');
  
  try {
    const packagePath = path.join(rootDir, 'package.json');
    const content = await fs.readFile(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    
    // ES Module設定確認
    if (pkg.type === 'module') {
      log('ES Module設定: OK', 'success');
      checks.passed.push('package.json ES Module');
    } else {
      log('ES Module設定がありません', 'warning');
      checks.warnings.push('package.json type:module未設定');
    }
    
    // 依存関係確認
    const requiredDeps = ['@supabase/supabase-js', 'axios'];
    for (const dep of requiredDeps) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        log(`依存関係 ${dep}: OK`, 'success');
        checks.passed.push(`依存: ${dep}`);
      } else {
        log(`依存関係 ${dep} が見つかりません`, 'error');
        checks.failed.push(`依存: ${dep}`);
      }
    }
  } catch (error) {
    log(`package.json読み込みエラー: ${error.message}`, 'error');
    checks.failed.push('package.json');
  }
}

// 2. 環境変数チェック
async function checkEnvironmentVariables() {
  log('環境変数チェック中...', 'info');
  
  try {
    // Vercel CLIで環境変数を確認
    const output = execSync('vercel env ls production', { 
      encoding: 'utf8',
      cwd: rootDir 
    });
    
    const requiredVars = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'LIFF_ID',
      'STORE_ID',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ];
    
    for (const varName of requiredVars) {
      if (output.includes(varName)) {
        log(`環境変数 ${varName}: 設定済み`, 'success');
        checks.passed.push(`env: ${varName}`);
      } else {
        log(`環境変数 ${varName}: 未設定`, 'error');
        checks.failed.push(`env: ${varName}`);
      }
    }
  } catch (error) {
    log('Vercel CLIが利用できません（vercel loginが必要）', 'warning');
    checks.warnings.push('環境変数確認スキップ');
  }
}

// 3. APIファイル数チェック（Vercel制限）
async function checkApiFileCount() {
  log('APIファイル数チェック中...', 'info');
  
  try {
    const apiDir = path.join(rootDir, 'api');
    const files = await fs.readdir(apiDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    if (jsFiles.length <= 12) {
      log(`APIファイル数: ${jsFiles.length}/12 OK`, 'success');
      checks.passed.push('APIファイル数制限');
    } else {
      log(`APIファイル数: ${jsFiles.length}/12 制限超過！`, 'error');
      checks.failed.push('APIファイル数制限超過');
    }
    
    // 各ファイルサイズも確認
    for (const file of jsFiles) {
      const stats = await fs.stat(path.join(apiDir, file));
      const sizeKB = Math.round(stats.size / 1024);
      if (sizeKB > 50) {
        log(`${file}: ${sizeKB}KB (大きい)', 'warning`);
        checks.warnings.push(`${file}サイズ`);
      }
    }
  } catch (error) {
    log(`APIディレクトリチェックエラー: ${error.message}`, 'error');
    checks.failed.push('APIディレクトリ');
  }
}

// 4. vercel.json検証
async function checkVercelConfig() {
  log('vercel.json検証中...', 'info');
  
  try {
    const configPath = path.join(rootDir, 'vercel.json');
    const content = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(content);
    
    // Functions設定確認
    if (config.functions) {
      const apiPattern = config.functions['api/*.js'];
      if (apiPattern && apiPattern.maxDuration) {
        log(`Function maxDuration: ${apiPattern.maxDuration}秒`, 'success');
        checks.passed.push('Function設定');
      }
    }
    
    // Rewrites確認
    if (config.rewrites && Array.isArray(config.rewrites)) {
      log(`Rewrites設定: ${config.rewrites.length}件`, 'success');
      checks.passed.push('Rewrites設定');
    }
    
  } catch (error) {
    log('vercel.json読み込みエラー', 'warning');
    checks.warnings.push('vercel.json');
  }
}

// 5. Store IDハードコーディングチェック
async function checkStoreIdHardcoding() {
  log('Store IDハードコーディングチェック中...', 'info');
  
  try {
    const apiDir = path.join(rootDir, 'api');
    const files = await fs.readdir(apiDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    let hardcodingFound = false;
    
    for (const file of jsFiles) {
      const filePath = path.join(apiDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // ハードコードパターン検索
      if (content.includes("'account-001'") || content.includes('"account-001"')) {
        log(`${file}: account-001 ハードコーディング発見`, 'error');
        checks.failed.push(`${file} store_id`);
        hardcodingFound = true;
      }
      
      if (content.includes("'account-002'") || content.includes('"account-002"')) {
        log(`${file}: account-002 ハードコーディング発見`, 'error');
        checks.failed.push(`${file} store_id`);
        hardcodingFound = true;
      }
    }
    
    if (!hardcodingFound) {
      log('Store IDハードコーディングなし', 'success');
      checks.passed.push('Store IDチェック');
    }
  } catch (error) {
    log(`ハードコーディングチェックエラー: ${error.message}`, 'error');
  }
}

// 6. ES Module形式チェック
async function checkModuleFormat() {
  log('ES Module形式チェック中...', 'info');
  
  try {
    const apiDir = path.join(rootDir, 'api');
    const files = await fs.readdir(apiDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    let issuesFound = false;
    
    for (const file of jsFiles) {
      const filePath = path.join(apiDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // CommonJS形式のチェック
      if (content.includes('module.exports') || content.includes('require(')) {
        log(`${file}: CommonJS形式の記述発見`, 'error');
        checks.failed.push(`${file} モジュール形式`);
        issuesFound = true;
      }
      
      // export default確認
      if (!content.includes('export default')) {
        log(`${file}: export defaultがありません`, 'warning');
        checks.warnings.push(`${file} export`);
      }
    }
    
    if (!issuesFound) {
      log('ES Module形式: OK', 'success');
      checks.passed.push('ES Module形式');
    }
  } catch (error) {
    log(`モジュール形式チェックエラー: ${error.message}`, 'error');
  }
}

// 7. publicファイル確認
async function checkPublicFiles() {
  log('publicファイル確認中...', 'info');
  
  const requiredFiles = [
    'index.html',
    'admin-calendar-v2.html',
    'liff-calendar-v2.html',
    'seats-management.html'
  ];
  
  try {
    const publicDir = path.join(rootDir, 'public');
    const files = await fs.readdir(publicDir);
    
    for (const file of requiredFiles) {
      if (files.includes(file)) {
        log(`${file}: 存在`, 'success');
        checks.passed.push(`public/${file}`);
      } else {
        log(`${file}: 見つかりません`, 'error');
        checks.failed.push(`public/${file}`);
      }
    }
  } catch (error) {
    log(`publicディレクトリチェックエラー: ${error.message}`, 'error');
  }
}

// レポート生成
function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📋 デプロイ前チェック結果');
  console.log('='.repeat(50));
  
  console.log(`\n✅ 成功: ${checks.passed.length}項目`);
  if (checks.passed.length > 0) {
    checks.passed.forEach(item => console.log(`   ${colors.green}✓${colors.reset} ${item}`));
  }
  
  if (checks.warnings.length > 0) {
    console.log(`\n⚠️ 警告: ${checks.warnings.length}項目`);
    checks.warnings.forEach(item => console.log(`   ${colors.yellow}⚠${colors.reset} ${item}`));
  }
  
  if (checks.failed.length > 0) {
    console.log(`\n❌ 失敗: ${checks.failed.length}項目`);
    checks.failed.forEach(item => console.log(`   ${colors.red}✗${colors.reset} ${item}`));
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (checks.failed.length === 0) {
    console.log(`${colors.green}✅ デプロイ可能です！${colors.reset}`);
    console.log('\n次のコマンドでデプロイしてください:');
    console.log('  git add -A');
    console.log('  git commit -m "デプロイ準備完了"');
    console.log('  git push');
    console.log('  または: vercel --prod');
  } else {
    console.log(`${colors.red}❌ デプロイ前に問題を修正してください${colors.reset}`);
    console.log('\n推奨アクション:');
    console.log('1. 失敗項目を確認して修正');
    console.log('2. npm run prevent-issues で自動修正を試す');
    console.log('3. 再度このスクリプトを実行');
  }
  
  console.log('='.repeat(50) + '\n');
  
  // Exit code
  process.exit(checks.failed.length > 0 ? 1 : 0);
}

// メイン実行
async function preDeployCheck() {
  console.log(colors.blue);
  console.log('🚀 LINE予約システム デプロイ前チェック');
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log(colors.reset);
  
  await checkPackageJson();
  await checkEnvironmentVariables();
  await checkApiFileCount();
  await checkVercelConfig();
  await checkStoreIdHardcoding();
  await checkModuleFormat();
  await checkPublicFiles();
  
  generateReport();
}

// 実行
preDeployCheck().catch(error => {
  console.error('致命的エラー:', error);
  process.exit(1);
});