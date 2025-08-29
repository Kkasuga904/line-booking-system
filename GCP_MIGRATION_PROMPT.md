# 🚀 LINE予約システム Vercel→GCP移行 実装指示書

## 目的
既存のLINE予約システム（Node.js＋Supabase）をVercelからGCP（Cloud Run中心）へ移行。
運用コスト最小化・課金事故防止の自動化・監視の標準化を行う。

## 前提
- **リポジトリ**: https://github.com/Kkasuga904/line-booking-system
- **現行DB**: Supabase（***REMOVED-ROTATE-CREDENTIAL***）継続使用
- **リージョン**: asia-northeast1（東京）
- **ランタイム**: Node.js 20
- **主要エンドポイント**:
  - POST /webhook（LINE受信：即200→非同期処理）
  - GET /admin（管理画面）
  - POST /api/router（内部ルーターで機能分岐）
- **環境**: dev と prod を完全分離（GCPプロジェクトも分ける）
- **通知先メール**: over9131120@gmail.com

---

## 1) コンテナ＆アプリ構成
- 単一Cloud Runサービスで `/webhook` `/admin` `/api/router` を受けるAPI集約方式
- `/webhook`は即200を返し、後続は非同期へ（Pub/Sub or 内部ジョブキュー）
- Node/Expressでルーター実装。Edge機能は不要

### 成果物
- `Dockerfile`（Node 20 slim, npm ci --omit=dev, PORT=8080）
- `server.js`（Express。各エンドポイント＆内部ルーター）
- 重要ログは `console.error(JSON.stringify({...}))` で構造化

---

## 2) インフラ（GCP）IaC
Terraformでdev/prodそれぞれに最小構成を作成：
- Cloud Runサービス（min-instances=0がデフォ、必要に応じて/webhook専用サービスにmin=1も可）
- Cloud Scheduler →（HTTP直叩き or Pub/Sub経由）
- Secret Manager（LINE_TOKEN, SUPABASE_URL, SUPABASE_KEYなど）
- Artifact Registry（イメージ保存・自動クリーンアップポリシー）
- Budget & アラート（¥1,000/3,000/10,000で通知、over9131120@gmail.com宛）
- Cloud Logging：保持30日、大量ログ対策のサンプル/除外フィルタを適用（INFO以下を抑制）

### 成果物
- `infra/terraform/dev` & `infra/terraform/prod` ディレクトリ
- `variables.tf`（プロジェクトID、リージョン、通知メール、最小インスタンス数など）
- `README.md`（terraform init/plan/applyの手順）

---

## 3) 秘密情報＆設定
Secret Managerに以下を登録し、起動時に環境変数へ注入：
- `LINE_CHANNEL_ACCESS_TOKEN`: ***REMOVED-ROTATE-CREDENTIAL***
- `LINE_CHANNEL_SECRET`: ***REMOVED-ROTATE-CREDENTIAL***
- `SUPABASE_URL`: ***REMOVED-ROTATE-CREDENTIAL***
- `SUPABASE_ANON_KEY`: ***REMOVED-ROTATE-CREDENTIAL***
- `STORE_ID`: ***REMOVED-ROTATE-CREDENTIAL***
- `LIFF_ID`: ***REMOVED-ROTATE-CREDENTIAL***
- 任意：`ADMIN_BASIC_USER`/`PASS`（/admin用）

### 成果物
- `scripts/seed-secrets.sh`（ローカル→GCP秘密登録ヘルパー）
- Cloud Runの`--update-secrets`設定例をREADMEに記載

---

## 4) デプロイ＆CI/CD
- GitHub ActionsでdevブランチPush → Cloud Build or gcloudでCloud Runデプロイ
- prodはタグ/リリースで承認付きデプロイ
- Preview（ステージングURL）に対し自動スモークテスト（/api/ping、/webhookモックイベントPOST）

### 成果物
- `.github/workflows/deploy-dev.yml` / `deploy-prod.yml`
- `fixtures/line_event.json`（Webhookテスト用）

---

## 5) 監視・アラート
Cloud Monitoringアラート：
- Cloud Runエラー率（5xx）
- レイテンシ（p95）
- リクエスト数の急増
- ログ書き込み量（GB/日）
- Egress Bytes（外向き通信）
- Budgetアラート（段階通知）to over9131120@gmail.com
- ログ保持は30日、冗長ログの除外フィルタ（ヘルスチェック等）を設定

### 成果物
- `infra/terraform/*`にアラート/ポリシー定義
- `logging-exclusions.tf`で除外と保持日数

---

## 6) コスト最適化（必須要件）
- Cloud Runはmin-instances=0で開始（コールドスタート許容）
- 必要時のみ/webhook用にmin=1を別サービスで付与（数百円/月の固定）
- すべて同リージョン（asia-northeast1）— Supabaseが海外の場合は注意点をREADME明記
- Artifact Registry：自動削除（保持数・保持日数ルール）
- Logging/Monitoring：前述の抑制設定を適用
- Cronは必要最小限の頻度に制御

---

## 7) ルーティング & 非同期化
- `/webhook`：即200、後続処理はキューへ（Pub/Sub推奨、なければ内部setImmediate/queue）
- `/api/router`：actパラメータで`create_reservation|list|capacity_set|...`を分岐 → エンドポイント乱立を防止
- 席ロック/キャパ制御はSupabaseでTTL/状態管理（held/confirmed、TTL切れ自動解放）
- 将来Redisを使う場合は接続先を環境変数で抽象化

---

## 8) 管理UI
- まずは最小：/adminでルール一覧/作成（カレンダー簡易描画、残り枠バッジ）
- 認証はBasic or 店長用トークン（短期）。将来的にGoogle OAuthも見越すがここでは不要

---

## 9) Vercelからの移行手順（READMEに明記）
1. Cloud Run URLをLINE Webhookに設定し直し（本番切替タイミングを手順化）
2. DNS独自ドメインがある場合はCloud Run Domain Mappingを適用
3. 重要：旧環境を停止する前に1週間は併走（監視数値が安定するまで）
4. 成功後、Vercelのプロジェクトはアーカイブ or 削除（課金停止）

---

## 10) 受け入れ基準（Acceptance Criteria）
- `make dev-deploy`（または`npm run deploy:dev`）一発でdevへデプロイ完了
- POST /webhookに`fixtures/line_event.json`を投げて200即応答＆バックグラウンド処理が実行
- Budget/Monitoringアラートが実際に発火することを擬似テストで確認
- ログ保持30日、ヘルスチェック類が課金対象にならないフィルタが効いている
- Artifact Registryの古いイメージが自動削除される
- READMEにdev/prod切替・シークレット投入・ロールバック手順が手順通りに再現可能
- （任意）/adminで簡易ダッシュボード表示、ルールON/OFFができる

---

## 参考スニペット

### Dockerfile
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 NODE_ENV=production
CMD ["node","server.js"]
```

### server.js（超要約）
```javascript
import express from "express";
import bodyParser from "body-parser";
const app = express();
app.use(bodyParser.json());

app.get("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.post("/webhook", (req, res) => {
  res.status(200).end();              // 即応答
  queueHandleLineEvent(req.body);     // 非同期実行（Pub/Sub or setImmediate）
});

app.all("/api/router", async (req, res) => {
  const act = req.query.act || req.body.act;
  switch (act) {
    case "create_reservation": return createReservation(req, res);
    case "capacity_set": return capacitySet(req, res);
    default: return res.status(400).json({ error: "unknown act" });
  }
});

app.listen(process.env.PORT || 8080);
```

### gcloud一発デプロイ（dev例）
```bash
gcloud run deploy line-booking-api-dev \
  --source . \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --min-instances=0 \
  --cpu=1 --memory=512Mi \
  --update-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-token:latest,SUPABASE_URL=supabase-url:latest,SUPABASE_ANON_KEY=supabase-key:latest
```

---

## 現在の構成（移行元）

### 既存APIファイル（統合対象）
- webhook-simple.js → /webhook
- admin.js → /admin
- calendar-reservation.js → /api/router?act=create_reservation
- calendar-slots.js → /api/router?act=get_slots
- check-seat-availability.js → /api/router?act=check_availability
- reservation-manage.js → /api/router?act=manage_reservation
- seats-manage.js → /api/router?act=manage_seats
- version.js → /api/ping

### 既存フロントエンド（静的ファイル）
- public/*.html → Cloud Storage or Cloud Run静的配信

---

以上の要件で、コスト安全装備まで含めてVercel→GCP(Cloud Run)へ移行してください。
不明点や選択肢がある箇所は、PRで提案→私の承認フローにしてください。

## 補足情報
- 現在Vercelで44件の予約データが稼働中
- SmartWeb Works Bot（@933maojf）として稼働
- 月5000円×100店舗を目指すSaaSモデル
- AWS SAP有資格者（インフラ知識あり）のため、技術的判断は任せてOK