# LINE予約システム マルチテナント構成

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│                  Nginx Reverse Proxy                 │
│              (app.yourdomain.com)                    │
└────────────┬────────────────────────────┬───────────┘
             │                            │
    ┌────────▼─────────┐        ┌────────▼─────────┐
    │   Tenant A       │        │   Tenant B       │
    │  /tenant-a/*     │        │  /tenant-b/*     │
    │   Port: 3001     │        │   Port: 3002     │
    └──────────────────┘        └──────────────────┘
             │                            │
    ┌────────▼─────────┐        ┌────────▼─────────┐
    │  LINE Account A  │        │  LINE Account B  │
    │  Webhook URL:    │        │  Webhook URL:    │
    │  /tenant-a/webhook│        │  /tenant-b/webhook│
    └──────────────────┘        └──────────────────┘
```

## 主な特徴

1. **単一ドメイン・複数パス**: 一つのドメインで複数のLINEアカウントを管理
2. **独立した環境**: 各テナントは独立したプロセスとデータストレージを持つ
3. **自動デプロイ**: GitHub ActionsでコードプッシュからデプロイまでCI/CD
4. **環境変数管理**: .envファイルで各テナントの設定を管理

## Webhook URL構成

- テナントA: `https://app.yourdomain.com/tenant-a/webhook`
- テナントB: `https://app.yourdomain.com/tenant-b/webhook`
- テナントC: `https://app.yourdomain.com/tenant-c/webhook`

各LINEアカウントは異なるパスを使用するため、相互に影響しません。