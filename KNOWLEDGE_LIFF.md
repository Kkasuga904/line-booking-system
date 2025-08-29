# LIFF設定ナレッジベース

## 概要
このドキュメントは、LINE Front-end Framework (LIFF) の設定に関する問題と解決策をまとめたナレッジベースです。

## よくある問題と解決策

### 1. システムエラーが表示される問題

#### 症状
- LIFF URL（`https://liff.line.me/[LIFF_ID]`）にアクセスすると「システムエラー」が表示される
- 予約画面が開かない

#### 原因
1. **LINE DevelopersコンソールでエンドポイントURLが正しく設定されていない**
2. **`.html`拡張子が省略されている**
3. **LIFF IDが間違っている**

#### 解決方法
```javascript
// ❌ 間違い
エンドポイントURL: https://[YOUR_DOMAIN]/liff-calendar

// ✅ 正解
エンドポイントURL: https://[YOUR_DOMAIN]/liff-calendar.html
```

### 2. 404エラーが発生する問題

#### 症状
- LIFFページが「Not Found」エラーになる
- 直接URLアクセスでも404

#### 原因
- Express.jsの静的ファイル配信で拡張子なしのリクエストが処理されない

#### 解決方法
```javascript
// server.js - 静的ファイル配信設定
app.use(express.static(path.join(__dirname, 'public')));

// 必ず.html拡張子付きでアクセス
// https://[YOUR_DOMAIN]/liff-calendar.html
```

## 実装パターン

### 1. Flex Messageによる予約ボタン（推奨）

```javascript
// 「予約」メッセージへの返信
if (text === '予約') {
  const liffId = process.env.LIFF_ID || 'YOUR_LIFF_ID';
  
  const flexMessage = {
    type: 'flex',
    altText: '予約メニュー',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📅 予約メニュー',
            weight: 'bold',
            size: 'xl'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'LINEで予約（推奨）',
              uri: `https://liff.line.me/${liffId}`
            }
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ブラウザで予約',
              uri: `https://[YOUR_DOMAIN]/liff-calendar.html`
            }
          }
        ]
      }
    }
  };
  
  await replyMessage(event, flexMessage);
}
```

### 2. 環境変数設定（.env.yaml）

```yaml
# 必須設定
LIFF_ID: "2006487876-xd1A5qJB"
BASE_URL: "https://line-booking-api-116429620992.asia-northeast1.run.app"
LINE_CHANNEL_ACCESS_TOKEN: "YOUR_TOKEN"
LINE_CHANNEL_SECRET: "YOUR_SECRET"
```

### 3. LIFF初期化コード（liff-calendar.html）

```javascript
// LIFF初期化
function init() {
  const liffId = window.LIFF_ID || '2006487876-xd1A5qJB';
  
  if (typeof liff !== 'undefined') {
    liff.init({
      liffId: liffId
    }).then(() => {
      console.log('LIFF初期化成功');
      // アプリケーション開始
    }).catch((err) => {
      console.error('LIFF初期化エラー:', err);
      // エラーでも続行（ブラウザアクセス対応）
    });
  } else {
    // 通常のWebページとして動作
    console.log('通常Webモードで動作');
  }
}
```

## チェックリスト

### デプロイ前チェック

- [ ] LIFF_IDが環境変数に設定されている
- [ ] liff-calendar.htmlがpublic/フォルダに存在する
- [ ] Dockerfileでpublic/フォルダがコピーされている
- [ ] .dockerignoreにpublic/が含まれていない

### LINE Developersコンソール設定

- [ ] エンドポイントURLに`.html`拡張子が含まれている
- [ ] LIFFアプリのサイズが「Full」に設定されている
- [ ] 必要なスコープ（profile, openid）が有効
- [ ] LIFFアプリが「公開」状態

### デバッグ手順

1. **ブラウザで直接アクセステスト**
   ```
   https://[YOUR_DOMAIN]/liff-calendar.html
   ```

2. **LIFF URLテスト**
   ```
   https://liff.line.me/[YOUR_LIFF_ID]
   ```

3. **コンソールエラー確認**
   - ブラウザのデベロッパーツールでエラーを確認
   - LIFF初期化エラーがないか確認

## トラブルシューティング

### エラー: "LIFF init failed"

```javascript
// 原因1: LIFF IDが間違っている
// 解決: LINE Developersコンソールで正しいIDを確認

// 原因2: エンドポイントURLのドメインが一致しない
// 解決: LINE Developersで登録したURLと実際のURLが完全一致することを確認

// 原因3: HTTPSでない
// 解決: 必ずHTTPS経由でアクセス
```

### エラー: "Cannot read properties of undefined"

```javascript
// 原因: LIFF SDKが読み込まれていない
// 解決: 以下のスクリプトタグを追加
<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
```

## 監視とログ

### ヘルスチェックエンドポイント

```javascript
// /api/liff-health
app.get('/api/liff-health', (req, res) => {
  const validator = new LIFFValidator();
  const status = validator.getHealthStatus();
  
  res.json({
    ...status,
    endpoints: {
      liff: `https://liff.line.me/${process.env.LIFF_ID}`,
      direct: `${process.env.BASE_URL}/liff-calendar.html`
    }
  });
});
```

### エラーログ記録

```javascript
// LIFFエラーを記録
if (error.code === 'INIT_FAILED') {
  console.error(JSON.stringify({
    severity: 'ERROR',
    msg: 'LIFF initialization failed',
    liffId: liffId,
    error: error.message,
    timestamp: new Date().toISOString()
  }));
}
```

## ベストプラクティス

1. **フォールバック対応**
   - LIFFが使えない場合でも通常のWebページとして動作させる

2. **デュアルURL提供**
   - LIFF URLとブラウザ直接URLの両方を提供

3. **エラーハンドリング**
   - LIFF初期化エラーをキャッチして適切に処理

4. **環境変数管理**
   - LIFF IDやURLは環境変数で管理

5. **定期的な検証**
   - デプロイ時にLIFF設定を自動検証

## 関連ファイル

- `/server.js` - メインサーバー（LIFF URL送信処理）
- `/public/liff-calendar.html` - LIFFページ本体
- `/utils/liff-validator.js` - LIFF設定検証ユーティリティ
- `/.env.yaml` - 環境変数設定
- `/LIFF_CONFIGURATION.md` - LIFF設定ドキュメント

## 更新履歴

- 2025-08-28: 初版作成
- LIFF URLエラー修正（.html拡張子追加）
- Flex Message実装
- 検証ユーティリティ追加