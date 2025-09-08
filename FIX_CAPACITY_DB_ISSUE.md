# 容量制限がDBに保存されない問題の修正

## 問題の概要
管理画面で設定した容量制限ルールがローカルストレージには保存されるが、データベースに保存されていなかった。

## 原因
1. バックエンドAPIがmax_groups等のカラムを処理していなかった
2. DBテーブルにmax_groups, max_people, max_per_groupカラムが存在しなかった
3. 管理画面のAPI呼び出しでエラーハンドリングが不十分だった

## 修正内容

### 1. deploy.js の修正
- `saveCapacity`アクションでmax_groups等のカラムを保存するように修正
- `capacity-availability`エンドポイントでmax_groupsの値を読み取るように修正

### 2. 管理画面の修正 (capacity-control-enhanced.html)
- API保存時のエラーハンドリングを改善
- 保存成功/失敗をコンソールとトーストで表示

### 3. DBスキーマの更新
以下のSQLファイルを作成：
- `add_capacity_columns.sql`: カラム追加用
- `create_test_capacity_rule.sql`: テストデータ投入用

## 手動でのテスト手順

### 1. DBにカラムを追加してテストデータを投入

```bash
# Windowsの場合
run_test_capacity.bat

# または直接SQLを実行
psql -h db.faenvzzeguvlconvrqgp.supabase.co -p 5432 -U postgres -d postgres -f create_test_capacity_rule.sql
```

パスワード: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjE3NDI5OCwiZXhwIjoyMDcxNzUwMjk4fQ.xKN7DHEV0iQ0XPx6x6BwqE9k1fGjMhh-Sj8OZPJ7vLc`

### 2. デプロイ

```bash
deploy.bat
```

### 3. 動作確認

1. **管理画面で確認**
   - https://line-booking-api-116429620992.asia-northeast1.run.app/capacity-control-enhanced.html
   - 9月7日にルールが表示されることを確認
   - 新しいルールを追加してDBに保存されることを確認

2. **LIFFページで確認**
   - https://line-booking-api-116429620992.asia-northeast1.run.app/liff-booking-enhanced.html
   - 9月7日を選択
   - 18:00-21:00の時間帯がオレンジ色「残り1組」で表示されることを確認

3. **デバッグパネルで確認**
   - LIFFページで「D」キーを押してデバッグパネルを開く
   - 「DBデータ取得」をクリック
   - コンソールに「✅ DBから1件のルールを取得しました」と表示されることを確認

## トラブルシューティング

### psqlコマンドが見つからない場合
PostgreSQLクライアントをインストール：
```bash
# Windows (Chocolatey)
choco install postgresql

# または公式サイトからダウンロード
# https://www.postgresql.org/download/windows/
```

### デプロイが失敗する場合
1. Google Cloud SDKがインストールされているか確認
2. `gcloud auth login`でログイン
3. `gcloud config set project line-booking-prod-20241228`でプロジェクト設定

### ルールが表示されない場合
1. ブラウザのキャッシュをクリア
2. コンソールでエラーを確認
3. デバッグパネルで「DBデータ取得」を実行してエラーを確認

## 今後の改善点
1. 管理画面でDB保存失敗時にローカルストレージのみに保存する警告を表示
2. バッチ処理でローカルストレージのデータをDBに同期
3. 容量制限の詳細（max_people, max_per_group）もLIFFページで活用