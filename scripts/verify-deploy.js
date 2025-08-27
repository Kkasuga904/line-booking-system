#!/usr/bin/env node

/**
 * デプロイ前検証スクリプト
 * 404エラーを防ぐための自動チェック
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 デプロイ前検証を開始...\n');

let hasError = false;
const warnings = [];
const errors = [];

// =====================================
// 1. ディレクトリ構造チェック
// =====================================
console.log('📁 ディレクトリ構造をチェック中...');

const requiredDirs = ['public', 'api'];
const requiredFiles = ['vercel.json', 'package.json'];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    errors.push(`❌ 必須ディレクトリが見つかりません: ${dir}`);
    hasError = true;
  } else {
    console.log(`  ✅ ${dir}/ ディレクトリ存在`);
  }
});

requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    errors.push(`❌ 必須ファイルが見つかりません: ${file}`);
    hasError = true;
  } else {
    console.log(`  ✅ ${file} 存在`);
  }
});

// =====================================
// 2. 静的ファイル配置チェック
// =====================================
console.log('\n📄 静的ファイル配置をチェック中...');

// publicフォルダ内のHTMLファイル
const publicHtmlFiles = fs.readdirSync('public')
  .filter(f => f.endsWith('.html'));

if (publicHtmlFiles.length === 0) {
  warnings.push('⚠️ publicフォルダにHTMLファイルがありません');
} else {
  publicHtmlFiles.forEach(file => {
    console.log(`  ✅ /public/${file} → /${file}`);
  });
}

// 重要: admin.htmlの存在確認
if (!fs.existsSync('public/admin.html')) {
  errors.push('❌ 管理画面 (public/admin.html) が見つかりません');
  hasError = true;
} else {
  console.log('  ✅ 管理画面: /admin.html でアクセス可能');
}

// ルートディレクトリのHTMLファイル（間違い）
const rootHtmlFiles = fs.readdirSync('.')
  .filter(f => f.endsWith('.html') && !f.startsWith('.'));

if (rootHtmlFiles.length > 0) {
  warnings.push(`⚠️ ルートディレクトリにHTMLファイルがあります（配信されません）: ${rootHtmlFiles.join(', ')}`);
  console.log(`  ⚠️ ルートのHTMLファイルは配信されません: ${rootHtmlFiles.join(', ')}`);
}

// =====================================
// 3. APIファイルチェック
// =====================================
console.log('\n🔌 APIファイルをチェック中...');

const apiFiles = fs.readdirSync('api')
  .filter(f => f.endsWith('.js'));

if (apiFiles.length === 0) {
  warnings.push('⚠️ APIファイルが見つかりません');
} else if (apiFiles.length > 12) {
  errors.push(`❌ APIファイルが多すぎます (${apiFiles.length}/12) - 無料プランの制限`);
  hasError = true;
} else {
  console.log(`  ✅ APIファイル数: ${apiFiles.length}/12`);
  apiFiles.forEach(file => {
    console.log(`     • /api/${file.replace('.js', '')}`);
  });
}

// 必須APIの確認
const requiredApis = ['webhook-supabase.js', 'admin-supabase.js'];
requiredApis.forEach(api => {
  if (!fs.existsSync(`api/${api}`)) {
    errors.push(`❌ 必須APIが見つかりません: api/${api}`);
    hasError = true;
  }
});

// =====================================
// 4. vercel.json検証
// =====================================
console.log('\n⚙️ vercel.json設定をチェック中...');

try {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  // rewriteルールのチェック
  if (vercelConfig.rewrites) {
    console.log('  📝 Rewriteルール:');
    vercelConfig.rewrites.forEach(rule => {
      console.log(`     ${rule.source} → ${rule.destination}`);
      
      // よくある間違いをチェック
      if (rule.destination && rule.destination.includes('/public/')) {
        errors.push(`❌ rewriteルールが間違っています: ${rule.destination} (/publicを削除してください)`);
        hasError = true;
      }
    });
  }
  
  // 関数設定のチェック
  if (vercelConfig.functions) {
    console.log('  ⚡ 関数設定: OK');
  }
  
} catch (err) {
  errors.push(`❌ vercel.json の解析に失敗: ${err.message}`);
  hasError = true;
}

// =====================================
// 5. 環境変数チェック
// =====================================
console.log('\n🔐 環境変数をチェック中...');

if (fs.existsSync('.env')) {
  warnings.push('⚠️ .envファイルが存在します（.gitignoreに含まれているか確認）');
}

if (fs.existsSync('.env.example')) {
  console.log('  ✅ .env.example 存在');
} else {
  warnings.push('⚠️ .env.example が見つかりません');
}

// =====================================
// 6. パッケージ依存関係チェック
// =====================================
console.log('\n📦 依存関係をチェック中...');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredPackages = ['@supabase/supabase-js'];

requiredPackages.forEach(pkg => {
  if (!packageJson.dependencies || !packageJson.dependencies[pkg]) {
    errors.push(`❌ 必須パッケージが見つかりません: ${pkg}`);
    hasError = true;
  } else {
    console.log(`  ✅ ${pkg} インストール済み`);
  }
});

// =====================================
// 結果表示
// =====================================
console.log('\n' + '='.repeat(50));
console.log('📊 検証結果\n');

if (warnings.length > 0) {
  console.log('⚠️ 警告:');
  warnings.forEach(w => console.log(`  ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ エラー:');
  errors.forEach(e => console.log(`  ${e}`));
  console.log('');
}

if (hasError) {
  console.log('🚫 デプロイを中止してください！上記のエラーを修正後、再実行してください。');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('✅ デプロイ可能ですが、警告事項を確認してください。');
} else {
  console.log('✅ 完璧です！デプロイの準備ができています。');
}

// =====================================
// アクセスURL表示
// =====================================
console.log('\n📌 デプロイ後のアクセスURL:');
console.log('  管理画面: https://your-domain.vercel.app/admin.html');
console.log('  Webhook: https://your-domain.vercel.app/webhook');
console.log('  API確認: https://your-domain.vercel.app/api/debug-reservations');

console.log('\n💡 ヒント: vercel --prod でデプロイを実行');