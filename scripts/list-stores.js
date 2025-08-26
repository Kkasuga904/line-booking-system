#!/usr/bin/env node

/**
 * 店舗一覧表示スクリプト
 * 
 * 使用方法:
 * node scripts/list-stores.js
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('===========================================');
console.log('   📋 登録済み店舗一覧');
console.log('===========================================');
console.log('');

const configDir = path.join(__dirname, '..', 'config');
const deploymentsDir = path.join(__dirname, '..', 'deployments');

if (!fs.existsSync(configDir)) {
  console.log('❌ configディレクトリが見つかりません');
  process.exit(1);
}

// 設定ファイルを検索
const configFiles = fs.readdirSync(configDir)
  .filter(file => file.endsWith('.env') && file !== 'template.env');

if (configFiles.length === 0) {
  console.log('店舗が登録されていません。');
  console.log('');
  console.log('新規店舗を追加するには:');
  console.log('  node scripts/new-store.js');
  process.exit(0);
}

const stores = [];

configFiles.forEach(file => {
  const storeId = file.replace('.env', '');
  const configPath = path.join(configDir, file);
  const envContent = fs.readFileSync(configPath, 'utf8');
  
  const config = {};
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    }
  });

  // デプロイ情報を取得
  let deployInfo = null;
  const deployPath = path.join(deploymentsDir, `${storeId}.json`);
  if (fs.existsSync(deployPath)) {
    deployInfo = JSON.parse(fs.readFileSync(deployPath, 'utf8'));
  }

  stores.push({
    storeId,
    storeName: config.STORE_NAME || '未設定',
    hasToken: !!config.LINE_CHANNEL_ACCESS_TOKEN,
    hasSecret: !!config.LINE_CHANNEL_SECRET,
    businessHours: config.BUSINESS_HOURS || '未設定',
    closedDays: config.CLOSED_DAYS || '未設定',
    deployed: !!deployInfo,
    deployUrl: deployInfo?.url || '未デプロイ',
    deployedAt: deployInfo?.deployedAt || null
  });
});

// テーブル形式で表示
console.log('┌─────────────┬──────────────────────┬────────────┬─────────────────────┐');
console.log('│ 店舗ID      │ 店舗名               │ 状態       │ URL                 │');
console.log('├─────────────┼──────────────────────┼────────────┼─────────────────────┤');

stores.forEach(store => {
  const storeIdCol = store.storeId.padEnd(11);
  const storeNameCol = store.storeName.substring(0, 20).padEnd(20);
  const statusCol = store.deployed ? '✅ デプロイ済' : '⏸️  未デプロイ';
  const urlCol = store.deployed ? '📋 詳細表示' : '-';
  
  console.log(`│ ${storeIdCol} │ ${storeNameCol} │ ${statusCol} │ ${urlCol.padEnd(19)} │`);
});

console.log('└─────────────┴──────────────────────┴────────────┴─────────────────────┘');
console.log('');
console.log(`合計: ${stores.length} 店舗`);
console.log('');

// 詳細情報を表示
stores.forEach(store => {
  console.log(`\n【${store.storeId}】${store.storeName}`);
  console.log('─'.repeat(50));
  console.log(`  営業時間: ${store.businessHours}`);
  console.log(`  定休日: ${store.closedDays}`);
  console.log(`  LINE設定: ${store.hasToken && store.hasSecret ? '✅' : '❌'}`);
  
  if (store.deployed) {
    console.log(`  デプロイ状態: ✅`);
    console.log(`  URL: ${store.deployUrl}`);
    console.log(`  Webhook URL: ${store.deployUrl}/api/booking`);
    if (store.deployedAt) {
      const date = new Date(store.deployedAt);
      console.log(`  最終デプロイ: ${date.toLocaleString('ja-JP')}`);
    }
  } else {
    console.log(`  デプロイ状態: ❌ 未デプロイ`);
    console.log(`  デプロイコマンド: node scripts/deploy-store.js ${store.storeId}`);
  }
});

console.log('');
console.log('===========================================');
console.log('');
console.log('📝 利用可能なコマンド:');
console.log('  新規店舗追加: node scripts/new-store.js');
console.log('  店舗デプロイ: node scripts/deploy-store.js <store-id>');
console.log('  店舗一覧表示: node scripts/list-stores.js');
console.log('');