# GitHub セキュリティガイド - 顧客情報保護

## 🔐 重要: 顧客データは GitHub にアップロードされません

このプロジェクトは顧客情報を完全に保護するよう設計されています。

## ✅ 保護されている情報

### 1. 環境変数（API キー・認証情報）
- `.env` ファイルとその全変種
- LINE Channel Access Token
- LINE Channel Secret  
- Supabase API キー
- その他の認証トークン

### 2. 店舗名・企業情報
- 店舗名、企業名、会社名
- ビジネス名、サロン名
- レストラン、美容室などの実名
- 設定ファイル内の店舗情報
- `stores.json`（実際の設定ファイル）

### 3. 顧客データ
- データベースファイル（`.db`, `.sql`, `.sqlite`）
- CSVエクスポート（`.csv`）
- Excelファイル（`.xlsx`, `.xls`）
- JSONデータ（顧客情報を含む）
- バックアップファイル

### 3. ログファイル
- アクセスログ
- エラーログ
- Webhook ログ
- デバッグ出力

### 4. その他の機密情報
- SSL証明書（`.pem`, `.key`, `.crt`）
- セッション情報
- キャッシュデータ
- アップロードファイル
- 管理者用データ

## 🛡️ セキュリティ対策

### 1. `.gitignore` による保護
```
✅ 環境変数ファイル全て
✅ データベース関連ファイル
✅ ログファイル
✅ 顧客データファイル
✅ バックアップ
✅ SSL証明書
✅ 一時ファイル
```

### 2. データ保存場所
- **顧客データ**: Supabase クラウドデータベース（GitHub外）
- **環境変数**: Vercel 環境変数（GitHub外）
- **ログ**: Vercel ログシステム（GitHub外）

### 3. コード内での対策
- ハードコーディングされた認証情報なし
- すべての機密情報は環境変数経由
- デバッグログに顧客情報を出力しない

## 📋 チェックリスト

### GitHub にプッシュする前に確認

- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] `git status` で環境変数ファイルが表示されない
- [ ] ログファイルがステージングされていない
- [ ] データベースダンプがコミットされていない
- [ ] 顧客の個人情報がコードに含まれていない

### 確認コマンド
```bash
# ステージングされているファイルを確認
git status

# .env ファイルが追跡されていないことを確認
git ls-files | grep -E "\.env|\.key|\.pem"

# 機密情報を含むファイルを検索
git grep -E "(password|secret|token|key)" --cached
```

## 🚨 もし誤ってコミットしてしまった場合

### 1. 即座に履歴から削除
```bash
# 特定ファイルを履歴から完全削除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# または BFG Repo-Cleaner を使用
bfg --delete-files sensitive-file.env
```

### 2. 認証情報の再生成
- LINE Channel Access Token を再発行
- Supabase API キーを更新
- その他の認証トークンを全て更新

### 3. Vercel で環境変数を更新
```bash
vercel env rm OLD_TOKEN production
vercel env add NEW_TOKEN production
```

## 📊 データフロー

```
ユーザー → LINE → Vercel（Webhook）→ Supabase
                    ↓
                  処理
                    ↓
              LINE（返信）← Vercel
```

**重要**: 顧客データは Vercel と Supabase 間でのみ流れ、GitHub には保存されません。

## 🔍 定期的なセキュリティ監査

### 月次チェック
1. `.gitignore` の更新確認
2. 依存関係の脆弱性スキャン
3. アクセストークンのローテーション
4. 不要なファイルの削除

### コマンド
```bash
# 脆弱性スキャン
npm audit

# 依存関係の更新
npm update

# 不要なファイルの検索
find . -name "*.log" -o -name "*.bak" -o -name "*.tmp"
```

## 📞 緊急連絡先

セキュリティインシデント発生時:
1. 即座に該当のアクセストークンを無効化
2. Vercel のデプロイメントを一時停止
3. システム管理者に連絡

## ✅ まとめ

- **顧客情報は GitHub に上がりません**
- **`.gitignore` で完全に保護されています**
- **すべての機密データはクラウドサービスに保存**
- **定期的なセキュリティチェックを実施**

---

最終更新: 2025年1月
セキュリティポリシーバージョン: 1.0