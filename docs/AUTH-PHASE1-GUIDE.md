# 認証システム Phase 1 - 匿名認証ガイド

## 🎯 概要

LINE userIdベースの匿名認証システム。パスワード不要、メールアドレス不要で、ユーザーは何も入力せずに予約システムを利用できます。

## ✨ 特徴

- **ゼロフリクション**: ユーザーは何も入力不要
- **プライバシー重視**: 個人情報を最小限に
- **即座に利用開始**: 登録プロセスなし
- **LINE連携**: LINE userIdで自動識別

## 🏗️ アーキテクチャ

```
ユーザー → LINE → Webhook → 匿名認証 → Supabase
                     ↓
              自動ユーザー作成
                     ↓
              セッション生成
```

## 📊 データベース構造

### anonymous_users テーブル
```sql
- id: anon_xxxxxxxxxxxx (ハッシュ化ID)
- line_user_id: LINE userId
- display_name: 自動生成名
- preferences: 通知設定等
- created_at: 作成日時
- last_accessed_at: 最終アクセス
```

## 🔧 実装方法

### 1. テーブル作成
```bash
# Supabaseで実行
psql -f sql/anonymous-users-table.sql
```

### 2. 環境変数設定
```env
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key
HASH_SALT=random_salt_string
SESSION_SECRET=session_secret_key
```

### 3. Webhook統合
```javascript
// webhook内で使用
import { authenticateLineRequest } from './auth-anonymous';

const authResult = await authenticateLineRequest(req);
if (authResult.authenticated) {
  const { user, sessionToken, isNewUser } = authResult;
  // ユーザー認証済み
}
```

## 🔐 セキュリティ

### ハッシュ化
- LINE userIdは直接保存せず、ハッシュ化
- SHA256 + ソルトで不可逆変換

### セッション管理
- 24時間有効期限
- HMAC署名による改ざん防止
- トークンローテーション対応

### アクセス制御
- 自分の予約のみ閲覧可能
- RLS (Row Level Security) 適用
- 最小権限の原則

## 📈 使用フロー

### 新規ユーザー
1. LINEでメッセージ送信
2. 自動的に匿名ユーザー作成
3. `ユーザー123456` として識別
4. すぐに予約可能

### 既存ユーザー
1. LINEでメッセージ送信
2. LINE userIdで自動識別
3. 過去の予約履歴も表示
4. 設定も保持

## 🎮 API エンドポイント

### POST /api/auth-anonymous
```javascript
// リクエスト
{
  "lineUserId": "U1234567890abcdef"
}

// レスポンス
{
  "success": true,
  "user": {
    "id": "anon_a1b2c3d4e5f6",
    "displayName": "ユーザー123456",
    "isNewUser": false
  },
  "sessionToken": "eyJ1c2VySWQ...",
  "expiresIn": "24h"
}
```

## 📊 メトリクス

### 追跡項目
- 総ユーザー数
- 日次アクティブユーザー
- 新規ユーザー数
- アクセス頻度

### 統計ビュー
```sql
SELECT * FROM user_statistics;
-- total_users, new_users_today, active_users_today
```

## 🔄 将来の拡張計画

### Phase 2: LINEプロフィール連携
```javascript
// 表示名と画像を取得
const profile = await getLineProfile(userId);
user.displayName = profile.displayName;
user.avatarUrl = profile.pictureUrl;
```

### Phase 3: アカウントアップグレード
```javascript
// メール追加でフル機能開放
await upgradeToFullAccount(userId, email, password);
// Web管理画面アクセス可能に
```

### Phase 4: 複数認証統合
```javascript
// 各種ソーシャルログイン
await linkGoogleAccount(userId, googleId);
await linkFacebookAccount(userId, facebookId);
```

## ⚡ パフォーマンス最適化

### キャッシング
- ユーザー情報は5分キャッシュ
- セッション検証結果もキャッシュ

### インデックス
- line_user_id
- last_accessed_at
- session_token

## 🧹 メンテナンス

### 定期クリーンアップ
```sql
-- 1時間ごと: 期限切れセッション削除
SELECT cleanup_expired_sessions();

-- 毎日: 非アクティブユーザー無効化
SELECT cleanup_inactive_users();
```

## 🐛 トラブルシューティング

### ユーザーが作成されない
1. Supabase接続確認
2. テーブル存在確認
3. 環境変数確認

### セッションエラー
1. SESSION_SECRET設定確認
2. 有効期限確認
3. トークン形式確認

## 📝 ベストプラクティス

1. **個人情報は保存しない**
   - 名前、メールアドレス不要
   - LINE userIdのみで運用

2. **自動化を徹底**
   - ユーザー作成自動
   - セッション管理自動
   - クリーンアップ自動

3. **拡張性を確保**
   - 将来のアップグレードパス
   - データ移行の準備
   - 後方互換性維持

## 🎉 まとめ

Phase 1の匿名認証により：
- ✅ ユーザーは即座にサービス利用可能
- ✅ 個人情報リスク最小化
- ✅ 実装がシンプル
- ✅ 将来の拡張も容易

これで**営業開始に必要な最小限の認証**が完成です！