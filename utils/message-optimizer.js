// LINE メッセージ最適化
// Flex Messageの圧縮、画像最適化、バッチ送信

class MessageOptimizer {
  constructor() {
    // Flex Messageテンプレートキャッシュ
    this.templateCache = new Map();
    
    // 画像CDN設定
    this.imageCDN = {
      baseUrl: 'https://line-booking-cdn.example.com',
      sizes: {
        thumbnail: { width: 240, height: 240 },
        small: { width: 460, height: 460 },
        full: { width: 1024, height: 1024 }
      }
    };

    // バッチ送信設定
    this.batchConfig = {
      maxSize: 500,        // 最大500メッセージ/バッチ
      interval: 1000,      // 1秒間隔
      retryLimit: 3,       // リトライ回数
      queue: [],           // メッセージキュー
      processing: false    // 処理中フラグ
    };

    // メッセージ圧縮統計
    this.stats = {
      originalSize: 0,
      compressedSize: 0,
      messageCount: 0
    };
  }

  // Flex Message最適化
  optimizeFlexMessage(message) {
    // 不要な空白・改行を削除
    let optimized = JSON.stringify(message);
    
    // 冗長なプロパティを削除
    optimized = this.removeRedundantProperties(optimized);
    
    // 色コードを短縮形に変換
    optimized = this.shortenColorCodes(optimized);
    
    // URLを短縮
    optimized = this.shortenUrls(optimized);

    const original = JSON.stringify(message).length;
    const compressed = optimized.length;
    
    this.stats.originalSize += original;
    this.stats.compressedSize += compressed;
    this.stats.messageCount++;

    const reduction = ((original - compressed) / original * 100).toFixed(1);
    console.log(`Message optimized: ${original} → ${compressed} bytes (${reduction}% reduction)`);

    return JSON.parse(optimized);
  }

  // 冗長なプロパティ削除
  removeRedundantProperties(jsonStr) {
    // デフォルト値と同じプロパティを削除
    const defaults = {
      'wrap': true,
      'spacing': 'md',
      'margin': 'md',
      'weight': 'regular',
      'size': 'md',
      'align': 'start',
      'gravity': 'top'
    };

    let optimized = jsonStr;
    Object.entries(defaults).forEach(([key, value]) => {
      const pattern = new RegExp(`"${key}":\\s*"${value}",?`, 'g');
      optimized = optimized.replace(pattern, '');
    });

    // 連続するカンマを修正
    optimized = optimized.replace(/,(\s*[}\]])/g, '$1');
    optimized = optimized.replace(/,{2,}/g, ',');

    return optimized;
  }

  // 色コード短縮
  shortenColorCodes(jsonStr) {
    // #FFFFFFを#FFFに短縮
    return jsonStr.replace(/#([0-9A-F])\1([0-9A-F])\2([0-9A-F])\3/gi, '#$1$2$3');
  }

  // URL短縮（実際の実装では短縮サービスAPI使用）
  shortenUrls(jsonStr) {
    // プレースホルダー実装
    return jsonStr.replace(/https:\/\/line-booking-system[^"]+/g, (match) => {
      if (match.length > 50) {
        // 実際には短縮URLサービスを使用
        return `https://lnb.link/${this.generateShortCode()}`;
      }
      return match;
    });
  }

  generateShortCode() {
    return Math.random().toString(36).substring(2, 8);
  }

  // 画像最適化
  optimizeImage(originalUrl, size = 'small') {
    // WebP形式に変換＆リサイズ
    const optimizedUrl = `${this.imageCDN.baseUrl}/optimize?` +
      `url=${encodeURIComponent(originalUrl)}` +
      `&w=${this.imageCDN.sizes[size].width}` +
      `&h=${this.imageCDN.sizes[size].height}` +
      `&format=webp` +
      `&quality=85`;

    return optimizedUrl;
  }

  // テンプレート化によるメッセージ生成
  generateFromTemplate(templateName, data) {
    // キャッシュチェック
    let template = this.templateCache.get(templateName);
    
    if (!template) {
      template = this.loadTemplate(templateName);
      this.templateCache.set(templateName, template);
    }

    // データ置換
    let message = JSON.stringify(template);
    Object.entries(data).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return JSON.parse(message);
  }

  // テンプレート読み込み
  loadTemplate(name) {
    const templates = {
      reservation_confirm: {
        type: 'flex',
        altText: '予約確認',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '{{title}}',
                weight: 'bold',
                size: 'xl'
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: '日時: {{datetime}}' },
                  { type: 'text', text: '人数: {{people}}名' },
                  { type: 'text', text: 'メニュー: {{menu}}' }
                ]
              }
            ]
          }
        }
      },
      slots_available: {
        type: 'flex',
        altText: '空き状況',
        contents: {
          type: 'carousel',
          contents: [] // 動的に生成
        }
      }
    };

    return templates[name] || {};
  }

  // バッチ送信最適化
  async sendBatch(messages) {
    // キューに追加
    this.batchConfig.queue.push(...messages);

    // 処理中でなければ開始
    if (!this.batchConfig.processing) {
      this.processBatchQueue();
    }
  }

  async processBatchQueue() {
    this.batchConfig.processing = true;

    while (this.batchConfig.queue.length > 0) {
      // バッチサイズ分取り出し
      const batch = this.batchConfig.queue.splice(0, this.batchConfig.maxSize);
      
      try {
        // マルチキャスト送信（複数ユーザーへ一括送信）
        await this.sendMulticast(batch);
        
        // レート制限対策
        await this.sleep(this.batchConfig.interval);
      } catch (error) {
        console.error('Batch send error:', error);
        
        // リトライロジック
        if (batch[0].retryCount < this.batchConfig.retryLimit) {
          batch.forEach(msg => msg.retryCount = (msg.retryCount || 0) + 1);
          this.batchConfig.queue.unshift(...batch); // 先頭に戻す
        }
      }
    }

    this.batchConfig.processing = false;
  }

  async sendMulticast(messages) {
    // ユーザーIDでグループ化
    const grouped = {};
    messages.forEach(msg => {
      if (!grouped[msg.to]) {
        grouped[msg.to] = [];
      }
      grouped[msg.to].push(msg.message);
    });

    // LINE Multicast API使用
    const promises = Object.entries(grouped).map(([userId, msgs]) => {
      return fetch('https://api.line.me/v2/bot/message/multicast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          to: [userId],
          messages: msgs.slice(0, 5) // 最大5メッセージ/リクエスト
        })
      });
    });

    await Promise.all(promises);
  }

  // メッセージ圧縮統計
  getCompressionStats() {
    const ratio = this.stats.compressedSize / this.stats.originalSize;
    const saved = this.stats.originalSize - this.stats.compressedSize;
    
    return {
      messageCount: this.stats.messageCount,
      originalSize: `${(this.stats.originalSize / 1024).toFixed(2)} KB`,
      compressedSize: `${(this.stats.compressedSize / 1024).toFixed(2)} KB`,
      compressionRatio: `${(ratio * 100).toFixed(1)}%`,
      savedBytes: `${(saved / 1024).toFixed(2)} KB`,
      averageSaving: `${((1 - ratio) * 100).toFixed(1)}%`
    };
  }

  // Quick Reply最適化
  optimizeQuickReply(items) {
    // 最も使用頻度の高いアクションを先頭に
    const prioritized = items.sort((a, b) => {
      const priorities = {
        'reservation': 1,
        'check': 2,
        'cancel': 3,
        'help': 4
      };
      return (priorities[a.action] || 99) - (priorities[b.action] || 99);
    });

    // 最大13個に制限
    return prioritized.slice(0, 13).map(item => ({
      type: 'action',
      action: {
        type: 'message',
        label: item.label.substring(0, 20), // 最大20文字
        text: item.text
      }
    }));
  }

  // リッチメニュー最適化
  generateOptimizedRichMenu() {
    return {
      size: { width: 2500, height: 843 }, // 小サイズで十分な場合
      selected: true,
      name: 'Quick Actions',
      chatBarText: 'メニュー',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          action: { type: 'message', text: '予約する' }
        },
        {
          bounds: { x: 833, y: 0, width: 834, height: 843 },
          action: { type: 'message', text: '予約確認' }
        },
        {
          bounds: { x: 1667, y: 0, width: 833, height: 843 },
          action: { type: 'message', text: 'ヘルプ' }
        }
      ]
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// シングルトンインスタンス
const messageOptimizer = new MessageOptimizer();

export default messageOptimizer;
export { MessageOptimizer };