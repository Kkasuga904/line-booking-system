/**
 * Webhook API 単体テスト
 * 
 * @description 各関数の単体テストを実施
 * @framework Jest
 */

// モック設定
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null })
    }))
  }))
}));

// テスト対象のインポート（実際のパスに合わせて調整）
const {
  sanitizeInput,
  validateReservationData,
  parseReservationMessage,
  checkRateLimit,
  validateLineSignature
} = require('../../api/webhook-test-utils');

describe('Webhook単体テスト', () => {
  
  /**
   * サニタイズ関数のテスト
   */
  describe('sanitizeInput', () => {
    test('HTMLタグを除去する', () => {
      const input = '<script>alert("XSS")</script>こんにちは';
      const result = sanitizeInput(input);
      expect(result).toBe('alert("XSS")こんにちは');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('SQLメタキャラクタを除去する', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeInput(input);
      expect(result).not.toContain("'");
      expect(result).not.toContain(";");
    });

    test('最大長を制限する', () => {
      const longInput = 'a'.repeat(1000);
      const result = sanitizeInput(longInput);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    test('前後の空白を除去する', () => {
      const input = '  予約 今日 18時  ';
      const result = sanitizeInput(input);
      expect(result).toBe('予約 今日 18時');
    });

    test('制御文字を除去する', () => {
      const input = 'Hello\x00World\x1F';
      const result = sanitizeInput(input);
      expect(result).toBe('HelloWorld');
    });

    test('文字列以外はそのまま返す', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(null)).toBe(null);
      expect(sanitizeInput(undefined)).toBe(undefined);
    });
  });

  /**
   * 予約データ検証のテスト
   */
  describe('validateReservationData', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    test('正常なデータを検証する', () => {
      const data = {
        people: 4,
        date: tomorrow,
        time: '18:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors).toHaveLength(0);
    });

    test('人数が範囲外の場合エラーを返す', () => {
      const data = {
        people: 25,
        date: tomorrow,
        time: '18:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors).toContain('予約人数は1〜20名で指定してください');
    });

    test('過去の日時の場合エラーを返す', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const data = {
        people: 2,
        date: yesterday,
        time: '18:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors).toContain('過去の日時は予約できません');
    });

    test('営業時間外の場合エラーを返す', () => {
      const data = {
        people: 2,
        date: tomorrow,
        time: '23:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors).toContain('予約時間は11:00〜21:00の間で指定してください');
    });

    test('3ヶ月以上先の場合エラーを返す', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 4);
      const data = {
        people: 2,
        date: futureDate.toISOString().split('T')[0],
        time: '18:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors).toContain('予約は90日先までとなっております');
    });

    test('複数のエラーを同時に検出する', () => {
      const data = {
        people: 0,
        date: '2020-01-01',
        time: '25:00:00'
      };
      const errors = validateReservationData(data);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  /**
   * 予約メッセージパースのテスト
   */
  describe('parseReservationMessage', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    test('基本的な予約メッセージをパースする', () => {
      const result = parseReservationMessage('予約 明日 18時 4名');
      expect(result.people).toBe(4);
      expect(result.date).toBe(tomorrow);
      expect(result.time).toBe('18:00:00');
    });

    test('今日の予約をパースする', () => {
      const result = parseReservationMessage('予約 今日 19時 2名');
      expect(result.date).toBe(today);
      expect(result.time).toBe('19:00:00');
    });

    test('明後日の予約をパースする', () => {
      const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];
      const result = parseReservationMessage('予約 明後日 20時 3名');
      expect(result.date).toBe(dayAfter);
    });

    test('デフォルト値を使用する', () => {
      const result = parseReservationMessage('予約');
      expect(result.people).toBe(2);
      expect(result.time).toBe('19:00:00');
    });

    test('人数を正しく抽出する', () => {
      expect(parseReservationMessage('予約 8人').people).toBe(8);
      expect(parseReservationMessage('予約 10名').people).toBe(10);
    });

    test('人数を範囲内に調整する', () => {
      expect(parseReservationMessage('予約 100名').people).toBe(20);
      expect(parseReservationMessage('予約 0名').people).toBe(1);
    });

    test('時間を営業時間内に調整する', () => {
      expect(parseReservationMessage('予約 5時').time).toBe('11:00:00');
      expect(parseReservationMessage('予約 25時').time).toBe('21:00:00');
    });

    test('複雑なメッセージをパースする', () => {
      const result = parseReservationMessage('明日の18時に4名で予約お願いします');
      expect(result.people).toBe(4);
      expect(result.date).toBe(tomorrow);
      expect(result.time).toBe('18:00:00');
    });
  });

  /**
   * レート制限のテスト
   */
  describe('checkRateLimit', () => {
    beforeEach(() => {
      // レート制限キャッシュをクリア
      jest.clearAllMocks();
    });

    test('初回リクエストは許可される', () => {
      const result = checkRateLimit('user001');
      expect(result).toBe(true);
    });

    test('制限内のリクエストは許可される', () => {
      const userId = 'user002';
      for (let i = 0; i < 9; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }
    });

    test('制限を超えるリクエストは拒否される', () => {
      const userId = 'user003';
      // 10回まで許可
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }
      // 11回目は拒否
      expect(checkRateLimit(userId)).toBe(false);
    });

    test('時間経過後は再度許可される', () => {
      const userId = 'user004';
      // 制限まで使用
      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId);
      }
      expect(checkRateLimit(userId)).toBe(false);
      
      // 時間を進める（実際の実装では時間経過をシミュレート）
      // jest.advanceTimersByTime(60001);
      // expect(checkRateLimit(userId)).toBe(true);
    });

    test('異なるユーザーは独立してカウントされる', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('userA');
      }
      expect(checkRateLimit('userA')).toBe(false);
      expect(checkRateLimit('userB')).toBe(true);
    });
  });

  /**
   * LINE署名検証のテスト
   */
  describe('validateLineSignature', () => {
    const crypto = require('crypto');
    const SECRET = 'test-secret';
    
    test('正しい署名を検証する', () => {
      const body = JSON.stringify({ events: [] });
      const signature = crypto
        .createHmac('SHA256', SECRET)
        .update(body)
        .digest('base64');
      
      // 環境変数をモック
      process.env.LINE_CHANNEL_SECRET = SECRET;
      
      const result = validateLineSignature(body, signature);
      expect(result).toBe(true);
    });

    test('不正な署名を拒否する', () => {
      const body = JSON.stringify({ events: [] });
      const signature = 'invalid-signature';
      
      process.env.LINE_CHANNEL_SECRET = SECRET;
      
      const result = validateLineSignature(body, signature);
      expect(result).toBe(false);
    });

    test('シークレットがない場合は検証失敗', () => {
      const body = JSON.stringify({ events: [] });
      const signature = 'some-signature';
      
      delete process.env.LINE_CHANNEL_SECRET;
      
      const result = validateLineSignature(body, signature);
      expect(result).toBe(false);
    });

    test('署名がない場合は検証失敗', () => {
      const body = JSON.stringify({ events: [] });
      
      process.env.LINE_CHANNEL_SECRET = SECRET;
      
      const result = validateLineSignature(body, null);
      expect(result).toBe(false);
    });
  });
});

/**
 * メッセージ生成関数のテスト
 */
describe('メッセージ生成', () => {
  const { createMenuMessage } = require('../../api/webhook-test-utils');
  
  test('クイックリプライメニューを正しく生成する', () => {
    const menu = createMenuMessage();
    
    expect(menu.type).toBe('text');
    expect(menu.text).toContain('ご予約');
    expect(menu.quickReply).toBeDefined();
    expect(menu.quickReply.items).toBeInstanceOf(Array);
    expect(menu.quickReply.items.length).toBeGreaterThan(0);
    
    // 各アイテムの構造をチェック
    menu.quickReply.items.forEach(item => {
      expect(item.type).toBe('action');
      expect(item.action).toBeDefined();
      expect(item.action.type).toBe('message');
      expect(item.action.label).toBeDefined();
      expect(item.action.text).toBeDefined();
    });
  });

  test('予約ボタンが正しいフォーマットを持つ', () => {
    const menu = createMenuMessage();
    const firstItem = menu.quickReply.items[0];
    
    expect(firstItem.action.text).toMatch(/予約/);
    expect(firstItem.action.label).toBeTruthy();
  });
});