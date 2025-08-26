/**
 * 管理者用ブロードキャスト送信エンドポイント
 * 
 * 店側から全ユーザーまたは特定ユーザーにメッセージを送信
 * 
 * 使用方法:
 * POST /api/admin-broadcast
 * 
 * リクエストボディ:
 * {
 *   "password": "管理者パスワード",
 *   "message": "送信するメッセージ",
 *   "type": "all" または "push",
 *   "userId": "特定ユーザーのID（pushの場合）"
 * }
 */

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // POSTメソッドのみ受け付ける
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secure-password-here';
  
  if (!TOKEN) {
    return res.status(500).json({ error: 'Token not configured' });
  }

  const { password, message, type, userId } = req.body;

  // パスワード認証
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;

    if (type === 'all') {
      // === 全員に一斉送信（ブロードキャスト）===
      // 注意: 無料枠は月1000通まで。超えると従量課金
      const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Broadcast Error:', error);
        return res.status(response.status).json({ 
          error: 'Failed to send broadcast', 
          details: error 
        });
      }

      result = {
        success: true,
        type: 'broadcast',
        message: 'Message sent to all users'
      };

    } else if (type === 'push' && userId) {
      // === 特定ユーザーに送信（プッシュ）===
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          to: userId,
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Push Error:', error);
        return res.status(response.status).json({ 
          error: 'Failed to send push message', 
          details: error 
        });
      }

      result = {
        success: true,
        type: 'push',
        userId: userId,
        message: 'Message sent to specific user'
      };

    } else {
      return res.status(400).json({ 
        error: 'Invalid request. Specify type as "all" or "push" with userId' 
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}