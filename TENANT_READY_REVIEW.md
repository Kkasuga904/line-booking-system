# マルチテナント対応準備レビュー

## 実施内容
unify/tenant-readyブランチで以下の共通化準備を実施しました。

## 1. 店舗設定管理ユーティリティの作成
**ファイル**: `utils/store-config.js`

### 主な機能
- `getStoreId()`: 店舗IDを統一的に取得
- `getStoreConfig()`: 店舗固有の設定を取得
- `getCapacityRulesKey()`: LocalStorageキーを店舗ごとに生成

### 優先順位
1. 関数引数で明示的に指定された値
2. URLパラメータ (store_id)
3. 環境変数 (STORE_ID)
4. デフォルト値 ('default-store')

## 2. ハードコード置き換え実施ファイル

### サーバーサイド (API)
- **api/admin.js**
  - ✅ `getStoreId()`関数を使用するように変更
  - ✅ リクエストパラメータからも店舗IDを取得可能に
  
- **api/calendar-reservation.js**
  - ✅ `getStoreId()`関数を使用するように変更

### クライアントサイド (HTML/JS)
- **public/admin-full-featured.html**
  - ✅ `StoreConfig.getStoreId()`を使用
  - ✅ `StoreConfig.getCapacityRulesKey()`でLocalStorageキーを生成
  - ✅ すべての`default-store`ハードコードを削除

## 3. レビュー観点チェック

### ✅ store依存値がコードに埋まっていないか
- `utils/store-config.js`で一元管理
- ハードコードされた`default-store`を設定参照に置き換え

### ✅ getStoreId()を必ず通しているか
- すべての店舗ID取得箇所で統一関数を使用
- レビューコメント`@レビュー:`を追加して明示

### ✅ 既存挙動に影響を与えていないか
- デフォルト値として`default-store`を維持
- 既存のLocalStorageキー形式も維持
- 環境変数STORE_IDも引き続きサポート

## 4. 残作業

### 優先度高
- [ ] 他のHTMLファイルへの適用
  - capacity-control-enhanced.html
  - capacity-control-new.html
  - liff-booking-enhanced.html
  
- [ ] 他のAPIファイルへの適用
  - check-capacity.js
  - seats-manage.js
  - customer-management.js

### 優先度中
- [ ] テスト環境での動作確認
- [ ] A店環境でのテスト実施

### 優先度低
- [ ] ドキュメント更新
- [ ] デプロイスクリプトの更新

## 5. デプロイ手順

### A店環境でのテスト
```bash
# 1. ブランチをチェックアウト
git checkout unify/tenant-ready

# 2. 環境変数を設定
export STORE_ID=store-a

# 3. ローカルテスト
npm run dev

# 4. デプロイ (A店環境)
gcloud run deploy --set-env-vars="STORE_ID=store-a"
```

### 問題がなければB店に展開
```bash
# B店環境へのデプロイ
gcloud run deploy --set-env-vars="STORE_ID=store-b"
```

## 6. 互換性維持のポイント

1. **URLパラメータサポート**
   - `?store_id=xxx`で店舗を切り替え可能
   - 開発・テスト時に便利

2. **環境変数サポート**
   - 既存の`STORE_ID`環境変数も引き続き使用可能
   - デプロイ時の設定変更不要

3. **LocalStorage互換性**
   - キー形式`capacity_control_rules_${storeId}`を維持
   - 既存データの移行不要

## 7. 注意事項

- mainブランチは触らず、Hotfixのみ反映
- 差分を最小限に抑えるため、必要最小限の変更のみ実施
- コメントで変更箇所を明示（`@レビュー:`タグ使用）