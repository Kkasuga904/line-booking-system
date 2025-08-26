#!/usr/bin/env node

/**
 * 新規店舗セットアップスクリプト
 * 
 * 使用方法:
 * node scripts/new-store.js
 * 
 * 対話形式で店舗情報を入力し、設定ファイルを自動生成します
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const questions = [
  {
    key: 'STORE_ID',
    question: '店舗ID (例: store-001): ',
    validate: (value) => {
      if (!/^[a-z0-9-]+$/.test(value)) {
        return '店舗IDは英小文字、数字、ハイフンのみ使用できます';
      }
      const configPath = path.join(__dirname, '..', 'config', `${value}.env`);
      if (fs.existsSync(configPath)) {
        return `この店舗ID (${value}) は既に使用されています`;
      }
      return true;
    }
  },
  {
    key: 'STORE_NAME',
    question: '店舗名 (例: 〇〇美容室 渋谷店): ',
    validate: (value) => value.length > 0 ? true : '店舗名を入力してください'
  },
  {
    key: 'LINE_CHANNEL_ACCESS_TOKEN',
    question: 'LINE Channel Access Token: ',
    validate: (value) => value.length > 0 ? true : 'Access Tokenを入力してください'
  },
  {
    key: 'LINE_CHANNEL_SECRET',
    question: 'LINE Channel Secret: ',
    validate: (value) => value.length > 0 ? true : 'Channel Secretを入力してください'
  },
  {
    key: 'ADMIN_PASSWORD',
    question: '管理者パスワード (8文字以上): ',
    validate: (value) => value.length >= 8 ? true : 'パスワードは8文字以上にしてください',
    hidden: true
  },
  {
    key: 'BUSINESS_HOURS',
    question: '営業時間 (例: 10:00-20:00): ',
    default: '10:00-20:00'
  },
  {
    key: 'CLOSED_DAYS',
    question: '定休日 (例: 毎週水曜日): ',
    default: 'なし'
  },
  {
    key: 'RESERVATION_MESSAGE',
    question: '予約完了メッセージ: ',
    default: 'ご予約ありがとうございます！ご来店をお待ちしております。'
  }
];

const config = {};

console.log('');
console.log('===========================================');
console.log('   🏪 新規店舗セットアップウィザード');
console.log('===========================================');
console.log('');
console.log('このウィザードでは、新しい店舗の設定を行います。');
console.log('LINE Developer Consoleで事前に以下を準備してください:');
console.log('  1. 新規チャンネル（Messaging API）の作成');
console.log('  2. Channel Access Tokenの発行');
console.log('  3. Channel Secretの確認');
console.log('');

let currentIndex = 0;

function askQuestion() {
  if (currentIndex >= questions.length) {
    saveConfig();
    return;
  }

  const q = questions[currentIndex];
  const prompt = q.default ? `${q.question}[${q.default}] ` : q.question;

  rl.question(prompt, (answer) => {
    const value = answer.trim() || q.default || '';
    
    if (q.validate) {
      const result = q.validate(value);
      if (result !== true) {
        console.log(`❌ ${result}`);
        askQuestion(); // 同じ質問を再度
        return;
      }
    }

    config[q.key] = value;
    currentIndex++;
    askQuestion();
  });
}

function saveConfig() {
  console.log('');
  console.log('📋 入力内容の確認:');
  console.log('-------------------------------------------');
  Object.entries(config).forEach(([key, value]) => {
    if (key === 'LINE_CHANNEL_ACCESS_TOKEN' || key === 'LINE_CHANNEL_SECRET') {
      console.log(`${key}: ${value.substring(0, 10)}...`);
    } else if (key === 'ADMIN_PASSWORD') {
      console.log(`${key}: ********`);
    } else {
      console.log(`${key}: ${value}`);
    }
  });
  console.log('-------------------------------------------');
  console.log('');

  rl.question('この内容で設定ファイルを作成しますか？ (y/n): ', (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('キャンセルしました');
      rl.close();
      return;
    }

    // テンプレートを読み込み
    const templatePath = path.join(__dirname, '..', 'config', 'template.env');
    let template = fs.readFileSync(templatePath, 'utf8');

    // 設定値を置換
    Object.entries(config).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*$`, 'gm');
      template = template.replace(regex, `${key}=${value}`);
    });

    // 設定ファイルを保存
    const configDir = path.join(__dirname, '..', 'config');
    const configPath = path.join(configDir, `${config.STORE_ID}.env`);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, template);

    console.log('');
    console.log('✅ 設定ファイルを作成しました!');
    console.log(`📁 ファイル: config/${config.STORE_ID}.env`);
    console.log('');
    console.log('🚀 次のステップ:');
    console.log('-------------------------------------------');
    console.log('1. デプロイを実行:');
    console.log(`   node scripts/deploy-store.js ${config.STORE_ID}`);
    console.log('');
    console.log('2. LINE Developer ConsoleでWebhook URLを設定');
    console.log('');
    console.log('3. LINE Official Account Managerで応答モードを「Bot」に設定');
    console.log('');
    console.log('4. QRコードで友だち追加してテスト');
    console.log('-------------------------------------------');

    // デプロイも実行するか確認
    rl.question('\n今すぐデプロイを実行しますか？ (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\nデプロイを開始します...\n');
        rl.close();
        require('./deploy-store.js');
      } else {
        console.log('\n後でデプロイする場合は以下のコマンドを実行してください:');
        console.log(`node scripts/deploy-store.js ${config.STORE_ID}`);
        rl.close();
      }
    });
  });
}

// 開始
askQuestion();