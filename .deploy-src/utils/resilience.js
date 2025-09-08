// エンタープライズ級レジリエンス機能
import crypto from 'crypto';

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1分
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10秒
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async call(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`Circuit breaker ${this.name}: Transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn(...args);
      
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          console.log(`Circuit breaker ${this.name}: Recovered, transitioning to CLOSED`);
        }
      } else if (this.state === 'CLOSED') {
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(`Circuit breaker ${this.name}: Too many failures, transitioning to OPEN`);
      }
      
      throw error;
    }
  }
}

class RetryManager {
  static async withExponentialBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          console.error(JSON.stringify({
            severity: 'ERROR',
            msg: 'Max retries exceeded',
            attempts: attempt + 1,
            error: error.message
          }));
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(JSON.stringify({
          severity: 'WARNING',
          msg: 'Retrying after failure',
          attempt: attempt + 1,
          maxRetries: maxRetries,
          delayMs: Math.round(delay),
          error: error.message
        }));
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const userRequests = this.requests.get(key);
    
    // 古いリクエストを削除
    while (userRequests.length > 0 && userRequests[0] < windowStart) {
      userRequests.shift();
    }
    
    if (userRequests.length >= this.maxRequests) {
      return false;
    }
    
    userRequests.push(now);
    return true;
  }
}

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.processingDelay = 100; // 100ms between messages
  }

  async enqueue(message) {
    const messageId = crypto.randomUUID();
    const queueItem = {
      id: messageId,
      message: message,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.queue.push(queueItem);
    console.log(`Message queued: ${messageId}`);
    
    if (!this.processing) {
      this.startProcessing();
    }
    
    return messageId;
  }

  async startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    console.log('Message queue processing started');
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      
      try {
        await this.processMessage(item);
        console.log(`Message processed successfully: ${item.id}`);
      } catch (error) {
        console.error(`Message processing failed: ${item.id}`, error.message);
        
        if (item.retries < this.maxRetries) {
          item.retries++;
          item.timestamp = Date.now();
          this.queue.push(item); // 再キューイング
          console.log(`Message requeued for retry: ${item.id} (attempt ${item.retries})`);
        } else {
          console.error(`Message abandoned after max retries: ${item.id}`);
          // デッドレターキューや管理者通知をここに実装
        }
      }
      
      // レート制限
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    }
    
    this.processing = false;
    console.log('Message queue processing completed');
  }

  async processMessage(item) {
    const { message } = item;
    
    // メッセージタイプに応じた処理
    switch (message.type) {
      case 'line_reply':
        await this.sendLineMessage(message.replyToken, message.text);
        break;
      case 'line_push':
        await this.sendLinePush(message.userId, message.text);
        break;
      case 'notification':
        await this.sendNotification(message.recipient, message.content);
        break;
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  async sendLineMessage(replyToken, text) {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }]
      })
    });

    if (!response.ok) {
      throw new Error(`LINE API error: ${response.status}`);
    }
  }

  async sendLinePush(userId, text) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text }]
      })
    });

    if (!response.ok) {
      throw new Error(`LINE Push API error: ${response.status}`);
    }
  }

  async sendNotification(recipient, content) {
    // Slack, Discord, メールなどの通知実装
    console.log(`Notification sent to ${recipient}: ${content}`);
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      timestamp: new Date().toISOString()
    };
  }
}

// インスタンス作成
const lineApiBreaker = new CircuitBreaker('LINE_API', {
  failureThreshold: 5,
  recoveryTimeout: 30000
});

const supabaseBreaker = new CircuitBreaker('SUPABASE', {
  failureThreshold: 3,
  recoveryTimeout: 60000
});

const rateLimiter = new RateLimiter(100, 60000); // 1分間に100リクエスト
const messageQueue = new MessageQueue();

export {
  CircuitBreaker,
  RetryManager,
  RateLimiter,
  MessageQueue,
  lineApiBreaker,
  supabaseBreaker,
  rateLimiter,
  messageQueue
};