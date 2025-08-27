# 決済システム統合ガイド

## 📌 決済機能実装計画

LINE予約システムに決済機能を統合する際の実装ガイドです。
現在は未実装ですが、将来的な実装に向けた設計指針を記載します。

## 💳 対応予定の決済方法

### 1. LINE Pay
**優先度: 高**
- LINEとの親和性が高い
- ユーザーの追加登録不要
- 手数料: 2.45%〜

```javascript
// 実装例（疑似コード）
async function createLinePayment(reservation) {
  const linePay = new LinePay({
    channelId: process.env.LINE_PAY_CHANNEL_ID,
    channelSecret: process.env.LINE_PAY_CHANNEL_SECRET
  });
  
  const payment = await linePay.request({
    amount: reservation.amount,
    currency: 'JPY',
    orderId: `RES-${reservation.id}`,
    packages: [{
      id: 'package-1',
      amount: reservation.amount,
      products: [{
        name: `予約 ${reservation.date} ${reservation.time}`,
        quantity: reservation.people,
        price: reservation.pricePerPerson
      }]
    }],
    redirectUrls: {
      confirmUrl: `${BASE_URL}/api/payment/confirm`,
      cancelUrl: `${BASE_URL}/api/payment/cancel`
    }
  });
  
  return payment.info.paymentUrl.web;
}
```

### 2. Stripe
**優先度: 中**
- 国際的に利用可能
- 豊富な決済オプション
- 手数料: 3.6%

```javascript
// 実装例（疑似コード）
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createStripeSession(reservation) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'jpy',
        product_data: {
          name: `予約: ${reservation.customer_name}様`,
          description: `${reservation.date} ${reservation.time} ${reservation.people}名`
        },
        unit_amount: reservation.amount
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/payment/cancel`,
    metadata: {
      reservation_id: reservation.id
    }
  });
  
  return session.url;
}
```

### 3. PayPay
**優先度: 低**
- 日本で人気のQRコード決済
- 手数料: 1.6%〜

## 🔄 決済フロー設計

### 予約時前払いフロー
1. ユーザーが予約内容を入力
2. 料金を計算・表示
3. 決済方法選択（LINE Pay推奨）
4. 決済ページへリダイレクト
5. 決済完了後、予約確定
6. 確認メッセージ送信

### 来店時後払いフロー
1. 予約のみ受付（決済なし）
2. 来店時にQRコード提示
3. 店舗側で金額入力
4. 顧客が決済承認
5. 決済完了

## 💾 データベース設計

### paymentsテーブル（追加予定）
```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES reservations(id),
  payment_method VARCHAR(50), -- 'line_pay', 'stripe', 'paypay'
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'JPY',
  status VARCHAR(50), -- 'pending', 'completed', 'failed', 'refunded'
  transaction_id VARCHAR(255), -- 外部決済サービスのID
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  refund_amount INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 セキュリティ考慮事項

### 必須実装項目
1. **PCI DSS準拠**
   - カード情報は保存しない
   - トークン化を使用

2. **Webhook署名検証**
   ```javascript
   function verifyWebhookSignature(body, signature, secret) {
     const hmac = crypto.createHmac('sha256', secret);
     hmac.update(body);
     const computedSignature = hmac.digest('base64');
     return computedSignature === signature;
   }
   ```

3. **決済情報の暗号化**
   - 機密情報は暗号化して保存
   - HTTPSでの通信必須

4. **不正検知**
   - 異常な金額の検知
   - 重複決済の防止
   - IPアドレスベースの制限

## 📊 手数料比較

| 決済方法 | 手数料 | 入金サイクル | 最小決済額 |
|---------|--------|--------------|-----------|
| LINE Pay | 2.45% | 月末締め翌月末 | 1円 |
| Stripe | 3.6% | 週2回 | 50円 |
| PayPay | 1.6%〜1.98% | 月1回 | 1円 |
| Square | 3.25%〜3.75% | 最短翌日 | なし |

## 🚀 実装優先順位

### Phase 1（MVP）
- [ ] LINE Pay基本実装
- [ ] 決済成功/失敗の処理
- [ ] 予約との紐付け
- [ ] 決済確認メール

### Phase 2（機能拡張）
- [ ] Stripe統合
- [ ] 返金機能
- [ ] 決済履歴表示
- [ ] 領収書発行

### Phase 3（高度化）
- [ ] サブスクリプション対応
- [ ] 分割決済
- [ ] ポイント/クーポン
- [ ] 売上分析機能

## 🎯 KPI目標

- 決済完了率: 95%以上
- 決済処理時間: 3秒以内
- エラー率: 0.1%以下
- 返金処理時間: 24時間以内

## 📝 実装時の注意事項

1. **テスト環境での十分な検証**
   - サンドボックス環境を使用
   - エラーケースを網羅的にテスト

2. **エラーハンドリング**
   - タイムアウト処理
   - リトライロジック
   - ユーザーへの適切なフィードバック

3. **監査ログ**
   - 全決済トランザクションを記録
   - 異常検知アラート設定

4. **法的要件**
   - 特定商取引法の表記
   - 返金ポリシーの明示
   - 利用規約への同意取得

## 🔗 参考リンク

- [LINE Pay Developers](https://pay.line.me/jp/developers/documentation/download/tech)
- [Stripe Documentation](https://stripe.com/docs)
- [PayPay for Developers](https://developer.paypay.ne.jp/)
- [決済代行サービス比較](https://www.cardservice.co.jp/support/beginner/begin_70.html)

---

*このドキュメントは将来の実装に向けたガイドラインです。*
*実装時は最新のAPIドキュメントを参照してください。*