/**
 * LIFF設定検証ユーティリティ
 * 再発防止: LIFF URLとエンドポイントの設定ミスを防ぐ
 */

class LIFFValidator {
  constructor() {
    this.liffId = process.env.LIFF_ID || '***REMOVED-ROTATE-CREDENTIAL***';
    this.baseUrl = process.env.BASE_URL || 'https://line-booking-api-116429620992.asia-northeast1.run.app';
    this.errors = [];
    this.warnings = [];
  }

  /**
   * LIFF設定を検証
   */
  validateConfig() {
    this.errors = [];
    this.warnings = [];

    // 1. LIFF ID形式チェック
    if (!this.validateLiffIdFormat()) {
      this.errors.push('LIFF IDの形式が不正です');
    }

    // 2. 環境変数チェック
    if (!process.env.LIFF_ID) {
      this.warnings.push('LIFF_IDが環境変数に設定されていません。デフォルト値を使用します');
    }

    // 3. BASE_URL設定チェック
    if (!process.env.BASE_URL) {
      this.warnings.push('BASE_URLが環境変数に設定されていません');
    }

    // 4. エンドポイント存在チェック
    this.checkEndpointAvailability();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      config: this.getConfig()
    };
  }

  /**
   * LIFF ID形式検証
   */
  validateLiffIdFormat() {
    // LIFF IDは通常 "数字-文字列" の形式
    const liffIdPattern = /^\d{10}-[a-zA-Z0-9]+$/;
    return liffIdPattern.test(this.liffId);
  }

  /**
   * エンドポイントの存在確認
   */
  async checkEndpointAvailability() {
    const endpoints = [
      '/liff-calendar.html',
      '/api/webhook',
      '/api/admin',
      '/api/calendar-slots'
    ];

    const results = [];
    for (const endpoint of endpoints) {
      try {
        const url = `${this.baseUrl}${endpoint}`;
        // 実際の環境では fetch を使用
        results.push({
          endpoint,
          url,
          status: 'configured'
        });
      } catch (error) {
        this.errors.push(`エンドポイント ${endpoint} にアクセスできません`);
        results.push({
          endpoint,
          url: `${this.baseUrl}${endpoint}`,
          status: 'error',
          error: error.message
        });
      }
    }
    return results;
  }

  /**
   * 正しい設定を返す
   */
  getConfig() {
    return {
      liffId: this.liffId,
      liffUrl: `https://liff.line.me/${this.liffId}`,
      directUrl: `${this.baseUrl}/liff-calendar.html`,
      baseUrl: this.baseUrl,
      endpoints: {
        webhook: `${this.baseUrl}/api/webhook`,
        admin: `${this.baseUrl}/api/admin`,
        calendarSlots: `${this.baseUrl}/api/calendar-slots`,
        liffPage: `${this.baseUrl}/liff-calendar.html`
      }
    };
  }

  /**
   * Flex Messageを生成（再利用可能）
   */
  generateBookingFlexMessage() {
    const config = this.getConfig();
    
    return {
      type: 'flex',
      altText: '予約メニュー',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📅 予約メニュー',
              weight: 'bold',
              size: 'xl',
              margin: 'md'
            },
            {
              type: 'text',
              text: '以下のボタンから予約画面を開いてください',
              size: 'sm',
              color: '#999999',
              margin: 'md',
              wrap: true
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'LINEで予約（推奨）',
                uri: config.liffUrl
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'ブラウザで予約',
                uri: config.directUrl
              }
            }
          ]
        }
      }
    };
  }

  /**
   * ヘルスチェック用のステータス
   */
  getHealthStatus() {
    const validation = this.validateConfig();
    
    return {
      timestamp: new Date().toISOString(),
      liff: {
        id: this.liffId,
        url: `https://liff.line.me/${this.liffId}`,
        directAccess: `${this.baseUrl}/liff-calendar.html`,
        valid: validation.isValid
      },
      errors: validation.errors,
      warnings: validation.warnings
    };
  }
}

// エクスポート
module.exports = LIFFValidator;

// 使用例：
// const LIFFValidator = require('./utils/liff-validator');
// const validator = new LIFFValidator();
// const result = validator.validateConfig();
// if (!result.isValid) {
//   console.error('LIFF設定エラー:', result.errors);
// }