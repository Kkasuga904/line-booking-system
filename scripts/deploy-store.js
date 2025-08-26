#!/usr/bin/env node

/**
 * 店舗別デプロイ自動化スクリプト
 * 
 * 使用方法:
 * node scripts/deploy-store.js <store-id>
 * 
 * 例:
 * node scripts/deploy-store.js store-001
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// コマンドライン引数から店舗IDを取得
const storeId = process.argv[2];

if (!storeId) {
  console.error('❌ エラー: 店舗IDを指定してください');
  console.log('使用方法: node scripts/deploy-store.js <store-id>');
  console.log('例: node scripts/deploy-store.js store-001');
  process.exit(1);
}

// 設定ファイルのパス
const configPath = path.join(__dirname, '..', 'config', `${storeId}.env`);

if (!fs.existsSync(configPath)) {
  console.error(`❌ エラー: 設定ファイルが見つかりません: ${configPath}`);
  console.log('💡 ヒント: config/template.envをコピーして、config/' + storeId + '.envを作成してください');
  process.exit(1);
}

console.log(`🚀 ${storeId}のデプロイを開始します...`);
console.log(`📁 設定ファイル: ${configPath}`);

// 環境変数を読み込む
const envContent = fs.readFileSync(configPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  }
});

// 必須項目のチェック
const required = ['STORE_NAME', 'STORE_ID', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET'];
const missing = required.filter(key => !envVars[key]);

if (missing.length > 0) {
  console.error('❌ エラー: 以下の必須項目が設定されていません:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

// プロジェクト名を生成（店舗IDを含む）
const projectName = `line-bot-${storeId}`;

console.log(`\n📋 デプロイ情報:`);
console.log(`  店舗名: ${envVars.STORE_NAME}`);
console.log(`  店舗ID: ${envVars.STORE_ID}`);
console.log(`  プロジェクト名: ${projectName}`);
console.log('');

// デプロイ実行関数
async function deploy() {
  try {
    console.log('1️⃣ Vercelプロジェクトを初期化...');
    
    // vercel.jsonを店舗用に更新
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    vercelConfig.name = projectName;
    fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
    
    // Vercelにリンク（初回のみ）
    try {
      execSync(`vercel link --yes --project ${projectName}`, { stdio: 'inherit' });
    } catch (e) {
      console.log('プロジェクトをリンク中...');
    }
    
    console.log('2️⃣ 環境変数を設定...');
    
    // 各環境変数を設定
    for (const [key, value] of Object.entries(envVars)) {
      if (value && value !== '') {
        console.log(`   設定中: ${key}`);
        try {
          // 既存の変数を削除
          execSync(`echo y | vercel env rm ${key} production`, { 
            stdio: 'pipe',
            encoding: 'utf8'
          });
        } catch (e) {
          // 変数が存在しない場合は無視
        }
        
        // 新しい値を設定
        execSync(`echo "${value}" | vercel env add ${key} production`, {
          stdio: 'pipe',
          encoding: 'utf8'
        });
      }
    }
    
    console.log('3️⃣ プロダクションにデプロイ...');
    const output = execSync('vercel --prod', { encoding: 'utf8' });
    
    // URLを抽出
    const urlMatch = output.match(/https:\/\/[^\s]+/);
    const deployUrl = urlMatch ? urlMatch[0] : 'URLを取得できませんでした';
    
    console.log('\n✅ デプロイ完了！');
    console.log('=====================================');
    console.log(`店舗名: ${envVars.STORE_NAME}`);
    console.log(`店舗ID: ${storeId}`);
    console.log(`URL: ${deployUrl}`);
    console.log('=====================================');
    
    // デプロイ情報をファイルに保存
    const deployInfo = {
      storeId: storeId,
      storeName: envVars.STORE_NAME,
      projectName: projectName,
      url: deployUrl,
      deployedAt: new Date().toISOString()
    };
    
    const deployLogPath = path.join(__dirname, '..', 'deployments', `${storeId}.json`);
    fs.mkdirSync(path.dirname(deployLogPath), { recursive: true });
    fs.writeFileSync(deployLogPath, JSON.stringify(deployInfo, null, 2));
    
    console.log(`\n📝 デプロイ情報を保存: deployments/${storeId}.json`);
    
    console.log('\n🎯 次のステップ:');
    console.log('1. LINE Developer ConsoleでWebhook URLを設定:');
    console.log(`   ${deployUrl}/api/booking`);
    console.log('2. LINE Official Account Managerで応答モードを「Bot」に設定');
    console.log('3. QRコードで友だち追加してテスト');
    
  } catch (error) {
    console.error('❌ デプロイ中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

// 確認プロンプト
rl.question(`\n⚠️  ${envVars.STORE_NAME}（${storeId}）をデプロイしますか？ (y/n): `, (answer) => {
  if (answer.toLowerCase() === 'y') {
    rl.close();
    deploy();
  } else {
    console.log('キャンセルしました');
    rl.close();
    process.exit(0);
  }
});