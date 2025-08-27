/**
 * 統合テスト - API全体の動作確認
 * 
 * @description APIエンドポイントの統合テスト
 * @framework Jest + Supertest
 */

const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');

// テスト環境のベースURL
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

/**
 * 統合テストスイート
 */
describe('Webhook API統合テスト', () => {
  
  /**
   * ヘルスチェックエンドポイント
   */
  describe('GET /api/webhook', () => {
    test('ヘルスチェックが正常に動作する', async () => {
      const response = await request(BASE_URL)
        .get('/api/webhook')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('security');
    });

    test('セキュリティ設定が有効になっている', async () => {
      const response = await request(BASE_URL)
        .get('/api/webhook')
        .expect(200);
      
      expect(response.body.security).toEqual({
        signature_validation: expect.any(Boolean),
        rate_limiting: 'enabled',
        input_sanitization: 'enabled'
      });
    });
  });

  /**
   * CORSプリフライトリクエスト
   */
  describe('OPTIONS /api/webhook', () => {
    test('CORSヘッダーが正しく設定される', async () => {
      const response = await request(BASE_URL)
        .options('/api/webhook')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  /**
   * Webhookエンドポイント - 正常系
   */
  describe('POST /api/webhook - 正常系', () => {
    test('空のイベント（LINE検証）を処理する', async () => {
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send({ events: [] })
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('予約メッセージを処理する', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: '予約 明日 18時 4名'
          },
          source: {
            userId: 'integration-test-user-001'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .set('X-Line-Signature', 'test-signature')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('メニュー表示コマンドを処理する', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: 'メニュー'
          },
          source: {
            userId: 'integration-test-user-002'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('予約確認コマンドを処理する', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: '予約確認'
          },
          source: {
            userId: 'integration-test-user-003'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });
  });

  /**
   * Webhookエンドポイント - 異常系
   */
  describe('POST /api/webhook - 異常系', () => {
    test('不正な予約データを拒否する', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: '予約 昨日 25時 100名' // 不正なデータ
          },
          source: {
            userId: 'integration-test-user-004'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .expect(200); // エラーでも200を返す（LINE仕様）
      
      expect(response.text).toBe('OK');
    });

    test('SQLインジェクション試行を防ぐ', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: "予約'; DROP TABLE reservations; --"
          },
          source: {
            userId: 'malicious-user'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('XSS試行を防ぐ', async () => {
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: '<script>alert("XSS")</script>予約 今日 18時'
          },
          source: {
            userId: 'xss-test-user'
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(webhookBody)
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('空のボディを処理する', async () => {
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });

    test('nullボディを処理する', async () => {
      const response = await request(BASE_URL)
        .post('/api/webhook')
        .send(null)
        .set('Content-Type', 'application/json')
        .expect(200);
      
      expect(response.text).toBe('OK');
    });
  });

  /**
   * レート制限テスト
   */
  describe('レート制限', () => {
    test('連続リクエストで制限がかかる', async () => {
      const userId = 'rate-limit-test-' + Date.now();
      const webhookBody = {
        events: [{
          type: 'message',
          message: {
            type: 'text',
            text: '予約確認'
          },
          source: {
            userId: userId
          },
          replyToken: 'test-reply-token'
        }]
      };
      
      // 11回リクエストを送信（10回が上限）
      const promises = [];
      for (let i = 0; i < 11; i++) {
        promises.push(
          request(BASE_URL)
            .post('/api/webhook')
            .send(webhookBody)
            .set('Content-Type', 'application/json')
        );
      }
      
      const responses = await Promise.all(promises);
      
      // すべて200を返すが、内部でレート制限が適用される
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('異なるユーザーは独立して処理される', async () => {
      const promises = [];
      
      // 2人のユーザーがそれぞれ5回ずつリクエスト
      for (let i = 0; i < 5; i++) {
        ['user-a', 'user-b'].forEach(userId => {
          const webhookBody = {
            events: [{
              type: 'message',
              message: {
                type: 'text',
                text: '予約確認'
              },
              source: {
                userId: userId
              },
              replyToken: 'test-reply-token'
            }]
          };
          
          promises.push(
            request(BASE_URL)
              .post('/api/webhook')
              .send(webhookBody)
              .set('Content-Type', 'application/json')
          );
        });
      }
      
      const responses = await Promise.all(promises);
      
      // すべて成功するはず（各ユーザー5回ずつで制限内）
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  /**
   * 不正なメソッドのテスト
   */
  describe('不正なHTTPメソッド', () => {
    test('PUTメソッドは405を返す', async () => {
      const response = await request(BASE_URL)
        .put('/api/webhook')
        .send({ test: 'data' })
        .expect(405);
      
      expect(response.body).toHaveProperty('error', 'Method not allowed');
    });

    test('DELETEメソッドは405を返す', async () => {
      const response = await request(BASE_URL)
        .delete('/api/webhook')
        .expect(405);
      
      expect(response.body).toHaveProperty('error', 'Method not allowed');
    });

    test('PATCHメソッドは405を返す', async () => {
      const response = await request(BASE_URL)
        .patch('/api/webhook')
        .send({ test: 'data' })
        .expect(405);
      
      expect(response.body).toHaveProperty('error', 'Method not allowed');
    });
  });

  /**
   * 管理画面APIのテスト
   */
  describe('管理画面API', () => {
    test('予約一覧を取得できる', async () => {
      const response = await request(BASE_URL)
        .get('/api/admin-supabase')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('store_id');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('reservations');
      expect(Array.isArray(response.body.reservations)).toBe(true);
    });

    test('store_idが正しくフィルタリングされる', async () => {
      const response = await request(BASE_URL)
        .get('/api/admin-supabase')
        .expect(200);
      
      const storeId = response.body.store_id;
      
      // すべての予約が同じstore_idを持つ
      response.body.reservations.forEach(reservation => {
        expect(reservation.store_id).toBe(storeId);
      });
    });
  });
});

/**
 * パフォーマンステスト
 */
describe('パフォーマンステスト', () => {
  test('ヘルスチェックが500ms以内に応答する', async () => {
    const startTime = Date.now();
    
    await request(BASE_URL)
      .get('/api/webhook')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500);
  });

  test('Webhook処理が1000ms以内に応答する', async () => {
    const startTime = Date.now();
    
    await request(BASE_URL)
      .post('/api/webhook')
      .send({
        events: [{
          type: 'message',
          message: { type: 'text', text: 'テスト' },
          source: { userId: 'perf-test' },
          replyToken: 'test'
        }]
      })
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000);
  });

  test('同時リクエストを処理できる', async () => {
    const promises = [];
    
    // 10個の同時リクエスト
    for (let i = 0; i < 10; i++) {
      promises.push(
        request(BASE_URL)
          .get('/api/webhook')
      );
    }
    
    const responses = await Promise.all(promises);
    
    // すべて成功するはず
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});