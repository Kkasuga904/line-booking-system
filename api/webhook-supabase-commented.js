import { createClient } from '@supabase/supabase-js';

// =====================================
// Supabase初期化
// データベース接続設定（正しい認証情報を使用）
// =====================================
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co'; // SupabaseプロジェクトのURL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8'; // 公開APIキー（anonキー）

// Supabaseクライアントインスタンスの作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================
// LINE返信メッセージ送信関数
// LINE Messaging APIを使用してユーザーに返信
// =====================================
async function replyMessage(replyToken, messages) {
  // 環境変数からLINEチャネルアクセストークンを取得
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  
  // トークンが設定されていない場合はエラー
  if (!accessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return;
  }
  
  try {
    // LINE Messaging APIのreplyエンドポイントにPOSTリクエスト
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` // Bearer認証
      },
      body: JSON.stringify({
        replyToken: replyToken, // 返信用の一時トークン
        messages: messages      // 送信するメッセージ配列（最大5つ）
      })
    });
    
    // レスポンスのステータスチェック
    if (!response.ok) {
      const error = await response.text();
      console.error('LINE reply error:', error);
    }
  } catch (error) {
    // ネットワークエラーなどの例外処理
    console.error('Failed to send reply:', error);
  }
}

// =====================================
// クイックリプライ付きメニューメッセージ作成関数
// 予約用のボタンメニューを生成
// =====================================
function createMenuMessage() {
  return {
    type: 'text',
    text: '📋 ご予約を承ります\n\n【予約フォーマット】\n「予約 お名前 日付 時間 人数」\n\n例：「予約 山田 明日 18時 4名」\n\n以下のボタンから選択後、お名前を追加してください👇',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📝 お名前入力例', // 名前入力のヒント
            text: '予約 [お名前をここに] 今日 19時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '今日 18時 2名',
            text: '予約 今日 18時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '今日 19時 2名',
            text: '予約 今日 19時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 18時 2名',
            text: '予約 明日 18時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 19時 2名',
            text: '予約 明日 19時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 20時 2名',
            text: '予約 明日 20時 2名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 18時 4名',
            text: '予約 明日 18時 4名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '明日 19時 4名',
            text: '予約 明日 19時 4名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '予約確認',
            text: '予約確認'
          }
        }
      ]
    }
  };
}

// =====================================
// Next.js API設定
// リクエストボディのパース設定
// =====================================
export const config = {
  api: {
    bodyParser: true, // JSONボディを自動的にパース
  },
};

// =====================================
// メインハンドラー関数
// HTTP リクエストを処理するエントリーポイント
// =====================================
export default async function handler(req, res) {
  // CORS設定 - クロスオリジンリクエストを許可
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // =====================================
  // OPTIONS リクエスト処理
  // プリフライトリクエスト対応
  // =====================================
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // =====================================
  // GET リクエスト処理
  // ヘルスチェック・統計情報取得
  // =====================================
  if (req.method === 'GET') {
    try {
      // 予約テーブルの総件数を取得
      const { count, error: countError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });
      
      // テーブルが存在しない場合の処理
      if (countError) {
        console.log('Count error (table might not exist):', countError);
        
        // テーブル作成を試みる（存在しない場合）
        await supabase.rpc('create_reservations_table_if_not_exists').catch(() => {});
      }
      
      // 最新5件の予約を取得
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // レスポンス返却
      return res.status(200).json({
        status: 'OK',
        message: 'LINE予約システムWebhook (Supabase版)',
        database: 'Supabase',
        table_status: countError ? 'テーブル作成が必要かもしれません' : 'OK',
        total_reservations: count || 0,
        recent_reservations: data || [],
        environment: {
          LINE_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ? '設定済み' : '未設定',
          SUPABASE_URL: SUPABASE_URL ? '設定済み' : '未設定'
        }
      });
    } catch (error) {
      console.error('GET request error:', error);
      return res.status(200).json({
        status: 'error',
        error: error.message
      });
    }
  }
  
  // =====================================
  // POST リクエスト処理
  // LINE Webhookイベント処理
  // =====================================
  if (req.method === 'POST') {
    try {
      // リクエストボディチェック
      if (!req.body || !req.body.events || req.body.events.length === 0) {
        return res.status(200).json({ status: 'no events' });
      }
      
      // イベント配列を取得
      const events = req.body.events;
      
      // =====================================
      // 各イベントを順次処理
      // =====================================
      for (const event of events) {
        // テキストメッセージのみ処理
        if (event.type === 'message' && event.message && event.message.type === 'text') {
          // イベントデータの抽出
          const text = event.message.text;                    // ユーザーが送信したテキスト
          const userId = event.source?.userId || 'unknown';   // LINE ユーザーID
          const replyToken = event.replyToken;               // 返信用トークン
          
          // =====================================
          // メニュー表示トリガー
          // =====================================
          if (text === 'メニュー' || text === 'menu' || text === '予約したい') {
            await replyMessage(replyToken, [createMenuMessage()]);
            continue;
          }
          
          // =====================================
          // 予約確認処理
          // ユーザーの最新予約を取得して表示
          // =====================================
          if (text === '予約確認') {
            // Supabaseから該当ユーザーの最新予約を取得
            const { data: userReservations, error } = await supabase
              .from('reservations')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (error) {
              // データベースエラー
              await replyMessage(replyToken, [{
                type: 'text',
                text: 'エラーが発生しました。もう一度お試しください。'
              }]);
            } else if (userReservations && userReservations.length > 0) {
              // 予約が見つかった場合
              const latest = userReservations[0];
              const displayTime = latest.time ? latest.time.substring(0, 5) : '未定';
              await replyMessage(replyToken, [{
                type: 'text',
                text: `📋 最新のご予約\n\n予約番号: #${latest.id}\nお名前: ${latest.customer_name || 'ゲスト'}様\n日付: ${latest.date}\n時間: ${displayTime}\n人数: ${latest.people}名\nステータス: ${latest.status === 'pending' ? '予約確定' : latest.status}`
              }]);
            } else {
              // 予約が見つからない場合
              await replyMessage(replyToken, [{
                type: 'text',
                text: 'ご予約が見つかりませんでした。'
              }]);
            }
            continue;
          }
          
          // =====================================
          // 予約メッセージの処理
          // テキストから予約情報を抽出して保存
          // =====================================
          if (text && text.includes('予約')) {
            // フォーマット説明の場合はスキップ
            if (text.includes('予約フォーマット')) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: '予約フォーマットに従ってメッセージを送信してください。\n例：「予約 山田太郎 明日 18時 4名」'
              }]);
              continue;
            }
            
            // =====================================
            // 予約情報の抽出処理
            // =====================================
            
            // デフォルト値の設定
            let customerName = '';                                      // 顧客名
            let people = 2;                                            // 人数（デフォルト2名）
            let date = new Date().toISOString().split('T')[0];        // 日付（デフォルト今日）
            let time = '19:00:00';                                    // 時間（デフォルト19時）
            
            // 名前抽出（予約の後の最初の単語、時間・日付・人数以外）
            const nameMatch = text.match(/予約[\s　]+([^0-9０-９\s　明今時人名様][^\s　]*)/);
            if (nameMatch) {
              customerName = nameMatch[1];
            }
            
            // 人数抽出（数字＋人/名/様）
            const peopleMatch = text.match(/(\d+)[人名様]/);
            if (peopleMatch) {
              people = parseInt(peopleMatch[1]);
            }
            
            // 時間抽出（数字＋時）
            const timeMatch = text.match(/(\d{1,2})時/);
            if (timeMatch) {
              const hour = timeMatch[1].padStart(2, '0');
              time = `${hour}:00:00`; // 秒まで含めた形式
            }
            
            // 日付抽出（今日/明日/明後日）
            if (text.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              date = tomorrow.toISOString().split('T')[0];
            } else if (text.includes('今日')) {
              date = new Date().toISOString().split('T')[0];
            }
            
            // =====================================
            // データベースに予約情報を保存
            // =====================================
            const { data: reservation, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: (process.env.STORE_ID || 'account-001').trim(), // 店舗ID（改行文字削除）
                user_id: userId,                                          // LINE ユーザーID
                customer_name: customerName || 'ゲスト',                  // 顧客名
                message: text,                                            // 元のメッセージ
                people: people,                                           // 人数
                date: date,                                               // 予約日
                time: time,                                               // 予約時間
                status: 'pending'                                         // ステータス（保留中）
              }])
              .select()
              .single();
            
            if (error) {
              // データベースエラーの処理
              console.error('Database error:', error);
              
              // エラーメッセージを詳細に
              let errorMessage = '予約の処理中にエラーが発生しました。';
              
              if (error.message.includes('relation') && error.message.includes('does not exist')) {
                errorMessage = 'データベースの準備ができていません。管理者にご連絡ください。';
              } else if (error.message.includes('Invalid API key')) {
                errorMessage = 'システムエラーが発生しました。管理者にご連絡ください。';
              }
              
              await replyMessage(replyToken, [{
                type: 'text',
                text: `${errorMessage}\n\nエラー詳細: ${error.message}`
              }]);
            } else {
              // 予約成功時の処理
              
              // 時間表示用フォーマット（秒を除去）
              const displayTime = time.substring(0, 5);
              
              // 予約確認メッセージ
              const confirmMessage = {
                type: 'text',
                text: `✅ 予約を承りました！\n\n👤 お名前: ${customerName || 'ゲスト'}様\n📅 日付: ${date}\n⏰ 時間: ${displayTime}\n👥 人数: ${people}名\n\n予約ID: ${reservation.id}\n\n変更・キャンセルはお電話でご連絡ください。`
              };
              
              // 次の予約用のクイックリプライ
              const nextActionMessage = {
                type: 'text',
                text: '✨ 他にもご予約されますか？\n\n💡 ヒント: お名前を忘れずにお伝えください',
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '📝 別の予約（名前付き）',
                        text: '予約 [お名前] 明日 19時 2名'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '📋 予約メニュー表示',
                        text: 'メニュー'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '✅ 予約を確認',
                        text: '予約確認'
                      }
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '👋 終了',
                        text: 'ありがとうございました'
                      }
                    }
                  ]
                }
              };
              
              // 2つのメッセージを送信
              await replyMessage(replyToken, [confirmMessage, nextActionMessage]);
            }
          } else if (text === 'ありがとうございました' || text === '終了') {
            // =====================================
            // 終了メッセージ
            // =====================================
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'ご利用ありがとうございました！\nまたのご予約をお待ちしております。'
            }]);
          } else {
            // =====================================
            // その他のメッセージ
            // 予約メニューを提示
            // =====================================
            await replyMessage(replyToken, [
              {
                type: 'text',
                text: 'こんにちは！ご予約を承ります👋\n\n📝 お名前もお聞かせください'
              },
              createMenuMessage()
            ]);
          }
        }
      }
      
      // 正常終了レスポンス（200を返すことで再送を防ぐ）
      return res.status(200).json({ status: 'success' });
      
    } catch (error) {
      // エラーハンドリング
      console.error('Error processing webhook:', error);
      // エラーでも200を返す（LINE側の再送を防ぐため）
      return res.status(200).json({ 
        status: 'error', 
        message: error.message 
      });
    }
  }
  
  // =====================================
  // 未対応メソッド
  // =====================================
  return res.status(405).json({ error: 'Method not allowed' });
}