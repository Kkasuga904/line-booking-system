#!/usr/bin/env node

/**
 * 新規顧客初期化スクリプト
 * 新しい店舗を追加してすぐに使える状態にする
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Supabase接続
const supabase = createClient(
  process.env.SUPABASE_URL || '***REMOVED-ROTATE-CREDENTIAL***',
  process.env.SUPABASE_ANON_KEY || '***REMOVED-ROTATE-CREDENTIAL***'
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function initNewCustomer() {
  console.log('🚀 新規顧客セットアップウィザード');
  console.log('=====================================\n');

  try {
    // 基本情報入力
    const storeId = await question('店舗ID (例: restaurant-tokyo-001): ');
    const storeName = await question('店舗名 (例: 東京レストラン): ');
    
    // LINE設定
    console.log('\n📱 LINE設定');
    const channelSecret = await question('LINE Channel Secret: ');
    const channelToken = await question('LINE Channel Access Token: ');
    const liffId = await question('LIFF ID: ');
    
    // 営業設定
    console.log('\n⏰ 営業設定');
    const openTime = await question('開店時間 (例: 11:00): ') || '11:00';
    const closeTime = await question('閉店時間 (例: 22:00): ') || '22:00';
    const maxCapacity = await question('最大収容人数 (デフォルト: 40): ') || '40';
    const maxPeoplePerGroup = await question('1組最大人数 (デフォルト: 8): ') || '8';
    
    // 定休日設定
    const holidays = await question('定休日 (0=日,1=月...6=土, カンマ区切り. 例: 1,2): ') || '';
    const holidayArray = holidays ? holidays.split(',').map(d => parseInt(d)) : [];
    
    console.log('\n📝 設定内容確認:');
    console.log('=====================================');
    console.log(`店舗ID: ${storeId}`);
    console.log(`店舗名: ${storeName}`);
    console.log(`営業時間: ${openTime} - ${closeTime}`);
    console.log(`最大収容: ${maxCapacity}人`);
    console.log(`定休日: ${holidayArray.length ? holidayArray.join(',') : 'なし'}`);
    console.log('=====================================\n');
    
    const confirm = await question('この内容で初期化しますか？ (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ キャンセルしました');
      process.exit(0);
    }
    
    // 1. store_settings テーブルに追加
    console.log('\n🔧 店舗設定を作成中...');
    const { data: storeData, error: storeError } = await supabase
      .from('store_settings')
      .upsert({
        store_id: storeId,
        store_name: storeName,
        business_hours: {
          open: openTime,
          close: closeTime
        },
        holidays: holidayArray,
        max_capacity: parseInt(maxCapacity),
        max_people_per_group: parseInt(maxPeoplePerGroup),
        line_channel_secret: channelSecret,
        line_channel_access_token: channelToken,
        liff_id: liffId,
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (storeError) {
      console.error('❌ 店舗設定作成エラー:', storeError);
      process.exit(1);
    }
    
    console.log('✅ 店舗設定を作成しました');
    
    // 2. デフォルト座席配置を作成
    console.log('\n🪑 デフォルト座席配置を作成中...');
    const defaultSeats = [
      { seat_name: 'テーブル1', seat_type: 'table', capacity: 4, position_x: 100, position_y: 100 },
      { seat_name: 'テーブル2', seat_type: 'table', capacity: 4, position_x: 300, position_y: 100 },
      { seat_name: 'テーブル3', seat_type: 'table', capacity: 6, position_x: 100, position_y: 300 },
      { seat_name: 'カウンター1', seat_type: 'counter', capacity: 1, position_x: 500, position_y: 100 },
      { seat_name: 'カウンター2', seat_type: 'counter', capacity: 1, position_x: 550, position_y: 100 },
      { seat_name: '個室1', seat_type: 'private', capacity: 8, position_x: 300, position_y: 300 }
    ];
    
    const seatsToInsert = defaultSeats.map(seat => ({
      ...seat,
      store_id: storeId,
      is_available: true
    }));
    
    const { data: seatsData, error: seatsError } = await supabase
      .from('seats')
      .insert(seatsToInsert)
      .select();
    
    if (seatsError) {
      console.error('⚠️  座席作成エラー（既存の可能性）:', seatsError.message);
    } else {
      console.log('✅ デフォルト座席配置を作成しました');
    }
    
    // 3. 環境変数ファイル生成
    console.log('\n📄 環境変数ファイルを生成中...');
    const envContent = `SUPABASE_URL: "***REMOVED-ROTATE-CREDENTIAL***"
SUPABASE_ANON_KEY: "***REMOVED-ROTATE-CREDENTIAL***"
STORE_ID: "${storeId}"
LINE_CHANNEL_ACCESS_TOKEN: "${channelToken}"
LINE_CHANNEL_SECRET: "${channelSecret}"
LIFF_ID: "${liffId}"`;
    
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', `.env.${storeId}.yaml`);
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ 環境変数ファイルを作成しました: .env.${storeId}.yaml`);
    
    // 4. アクセス情報表示
    console.log('\n🎉 セットアップ完了！');
    console.log('=====================================');
    console.log('📌 アクセス情報:');
    console.log(`管理画面: https://line-booking-api-116429620992.asia-northeast1.run.app/admin-dashboard.html?store_id=${storeId}`);
    console.log(`予約一覧: https://line-booking-api-116429620992.asia-northeast1.run.app/admin-list.html?store_id=${storeId}`);
    console.log(`座席管理: https://line-booking-api-116429620992.asia-northeast1.run.app/seats-management.html?store_id=${storeId}`);
    console.log('\n📱 LINE Webhook URL:');
    console.log(`https://line-booking-api-116429620992.asia-northeast1.run.app/webhook?store_id=${storeId}`);
    console.log('\n🚀 デプロイコマンド（専用インスタンスの場合）:');
    console.log(`gcloud run deploy line-booking-${storeId} --source . --env-vars-file .env.${storeId}.yaml --region asia-northeast1`);
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// テーブル作成（初回のみ）
async function createTablesIfNotExist() {
  console.log('📊 必要なテーブルを確認中...');
  
  // store_settings テーブル
  const { error: settingsError } = await supabase.rpc('create_store_settings_table', {
    sql: `
      CREATE TABLE IF NOT EXISTS store_settings (
        id SERIAL PRIMARY KEY,
        store_id VARCHAR(255) UNIQUE NOT NULL,
        store_name VARCHAR(255),
        business_hours JSONB,
        holidays JSONB,
        max_capacity INTEGER DEFAULT 40,
        max_people_per_group INTEGER DEFAULT 8,
        line_channel_secret VARCHAR(255),
        line_channel_access_token TEXT,
        liff_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  }).single();
  
  // seats テーブル
  const { error: seatsError } = await supabase.rpc('create_seats_table', {
    sql: `
      CREATE TABLE IF NOT EXISTS seats (
        id SERIAL PRIMARY KEY,
        store_id VARCHAR(255) NOT NULL,
        seat_name VARCHAR(50),
        seat_type VARCHAR(50),
        capacity INTEGER,
        is_available BOOLEAN DEFAULT true,
        position_x INTEGER,
        position_y INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_store_seats (store_id)
      );
    `
  }).single();
  
  console.log('✅ テーブル確認完了');
}

// メイン実行
(async () => {
  try {
    // テーブル作成は手動で行う必要があるかもしれません
    // await createTablesIfNotExist();
    await initNewCustomer();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();