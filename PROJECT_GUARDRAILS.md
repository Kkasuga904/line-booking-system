# プロジェクト運用ガードレール（必読）

目的：同時開発でもバッティングせず安全に進めるためのルール。破ったPRはマージ不可。

## 1) ブランチ & マージ
- **main は常にデプロイ可能**。直コミット禁止。
- 機能単位で `feat/<要約>`、修正は `fix/<要約>`
- すべて **PR必須**、セルフマージ禁止
- 大きめ変更は早めにドラフトPRで可視化

## 2) 役割分担（編集領域の分離）
- **API/DB/セキュリティ**：@tatata が責任者
- **UI/文言/i18n/ドキュメント**：Claude等の開発パートナー
- 下記保護ファイルは同時編集禁止（事前に宣言して直列で）

## 3) 環境分離
- **Vercel**：PRごとに Preview を自動生成（そこで動作確認）
- **Supabase**：dev / prod（または schema 分離）
- `.env` は環境別（prod値はVercel上のみ管理、ローカルに置かない）

## 4) DBは常にマイグレーション
- 直SQL禁止。migration 経由のみ
- 例：`migrations/2025MMDD_add_reservations_columns.sql`
- seedを用意して初期状態を再現可能に

## 5) Webhook/署名/応答
- Webhookは即200返す（処理は非同期化OK）
- X-Line-Signature は生ボディでHMAC検証
- 同一イベントの二重処理防止（eventId をユニーク制約に）

## 6) フィーチャーフラグ
- 新機能は `FEATURE_<NAME>` でON/OFF
- mainに入れても 既定OFF なら安全

## 7) 自動チェック
- PRで lint / typecheck / build を必須。失敗したPRはマージ不可
- フォーマットは Prettier、コミット前に lint-staged + Husky

## 8) 保護ファイル（同時編集禁止）
- `vercel.json`（ルーティング）
- `schema.*` / `migrations/**`（DBスキーマ）  
- `api/**` のエントリ（Webhook入口・認証）
- `.github/workflows/**`（CI）

→ 触るときはPR説明に明記。他の人はその間触らない。

## 9) マルチテナント管理ルール
複数顧客向けファイルの並列管理：

### ファイル構成
- **共通コア**: `api/webhook-supabase.js` (全顧客共通)
- **顧客別UI**: 各顧客用にカスタマイズされたHTML
- **環境変数**: `stores/store-XXX.env`で顧客ごと設定

### 顧客別ファイル命名規則
```
汎用版:
- public/liff-calendar.html (デフォルト)
- public/admin.html (標準管理画面)

顧客カスタマイズ版:
- public/liff-calendar-v2.html (顧客B向け)
- public/admin-secure.html (セキュリティ強化版)

開発/テスト版:
- api/webhook-dev.js (開発中)
- api/webhook-commented.js (コメント付き参照用)
```

### マルチテナント開発時の注意
- **顧客Aのファイルを編集中に顧客Bのファイルは触らない**
- **共通コア変更時は全顧客への影響を考慮**
- **顧客固有の情報は絶対にコードに書かない**（環境変数使用）

### 現在の顧客管理状況
```
アカウント1 (store-001):
- public/liff-calendar.html
- test-account1.env

アカウント2 (store-002):
- public/liff-calendar-v2.html
- test-account2.env

共通システム:
- api/webhook-supabase.js
- api/admin-supabase.js
```

## 開発ショートガイド
1. ブランチを切る → 最小差分でPR → Vercel Previewで確認 → レビュー指摘対応
2. 迷ったらUI側は自由に、API/DB側は相談してから
3. スキーマ・ルーティング・Webhook入口は直列、他は並行でOK

## 現在の設定状況
- ✅ PR Template: `.github/pull_request_template.md`
- ✅ CODEOWNERS: `.github/CODEOWNERS`
- ✅ CI/CD: `.github/workflows/ci.yml`
- ⏳ Husky: 要設定（`npm install -D husky lint-staged`）
- ⏳ ESLint/Prettier: 要設定

## コマンド一覧
```bash
# 開発開始
git checkout -b feat/your-feature
npm install

# コミット前
npm run lint
npm run typecheck

# PR作成
git push origin feat/your-feature
# → GitHubでPR作成、テンプレート記入

# マージ後
git checkout main
git pull origin main
```