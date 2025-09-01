# 管理画面アクセスガイド

## 正しいURL
✅ **https://line-booking-api-116429620992.asia-northeast1.run.app/admin-full-featured.html**

## 間違ったURL（動作しません）
❌ ~~https://line-booking-api-116429620992.asia-northeast1.run.app/public/admin-full-featured.html~~

## なぜこの違いが発生するのか？

Express.jsの静的ファイル配信設定：
```javascript
app.use(express.static(path.join(__dirname, 'public')));
```

この設定により、`public`ディレクトリの中身が**ルートディレクトリ**として配信されます。

### ファイルシステム上の場所
```
/line-booking-system/
  └── public/
      └── admin-full-featured.html  ← 実際のファイルの場所
```

### ブラウザからアクセスする際のURL
```
https://[ドメイン]/admin-full-featured.html  ← publicは含まない
```

## その他の管理画面

- 予約管理: `/admin-full-featured.html`
- 座席管理: `/seat-assignment.html`（存在する場合）

## トラブルシューティング

1. **ハンバーガーメニューが表示されない場合**
   - ブラウザのキャッシュをクリア（Ctrl+Shift+R）
   - シークレットウィンドウで開く
   - URLに`?v=`を付けてアクセス（例：`/admin-full-featured.html?v=123`）

2. **古いバージョンが表示される場合**
   - コンソールで`fetch('/__version')`を実行
   - `rev`フィールドを確認

## 開発者向け情報

- サーバー側のファイル: `C:\Users\user\line-booking-system\public\admin-full-featured.html`
- デプロイ先: Cloud Run (asia-northeast1)
- キャッシュ設定: HTMLファイルは`no-store`（キャッシュ無効）