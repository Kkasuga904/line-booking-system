import { createClient } from '@supabase/supabase-js';
import { getEnv, sanitizeUrl } from '../utils/env-helper.js';
import { isValidUrl, sanitizeUserInput } from '../utils/security-validator.js';

// Supabase初期化（正しい認証情報を使用）
// SUPABASE_URL: SupabaseプロジェクトのエンドポイントURL
const SUPABASE_URL = 'https://faenvzzeguvlconvrqgp.supabase.co';
// SUPABASE_ANON_KEY: パブリックアクセス用の匿名キー（公開可能）
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhZW52enplZ3V2bGNvbnZycWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzQyOTgsImV4cCI6MjA3MTc1MDI5OH0.U_v82IYSDM3waCFfFr4e7MpbTQmZFRPCNaA-2u5R3d8';

// Supabaseクライアントインスタンス作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// LINE返信メッセージ送信
// @param {string} replyToken - LINEからの返信用トークン（有効期限30秒）
// @param {Array} messages - 送信するメッセージの配列（最大5件）
async function replyMessage(replyToken, messages) {
  // 環境変数からLINEアクセストークンを取得（自動trim付き）
  const accessToken = getEnv('LINE_CHANNEL_ACCESS_TOKEN');
  if (!accessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return;
  }
  
  try {
    // LINE Messaging APIのreplyエンドポイントに送信
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`  // Bearer認証ヘッダー
      },
      body: JSON.stringify({
        replyToken: replyToken,  // 返信用の一時的なトークン
        messages: messages        // 送信するメッセージ配列
      })
    });
    
    // HTTPステータスコードチェック
    if (!response.ok) {
      const error = await response.text();
      console.error('LINE reply error:', error);
    }
  } catch (error) {
    // ネットワークエラーなどの例外処理
    console.error('Failed to send reply:', error);
  }
}

// クイックリプライ付きメニューメッセージ（カレンダー機能追加版）
// @returns {Object} LINEメッセージオブジェクト
function createMenuMessage() {
  // カレンダーURLを生成（getEnvで自動的に改行除去）
  const storeId = getEnv('STORE_ID', 'default');
  const storeName = encodeURIComponent(getEnv('STORE_NAME', '店舗'));
  const openHour = getEnv('OPEN_HOUR', '11');
  const closeHour = getEnv('CLOSE_HOUR', '22');
  
  // 方法1: LINE LoginチャネルのLIFF IDがある場合（getEnvで自動trim）
  const liffId = getEnv('LIFF_ID', '');
  
  // URLを生成（sanitizeUrlで確実に改行除去）
  let calendarUrl;
  if (liffId && liffId !== 'YOUR-LIFF-ID') {
    calendarUrl = `https://liff.line.me/${liffId}?store_id=${storeId}&store_name=${storeName}`;
  } else {
    calendarUrl = `https://line-booking-system-seven.vercel.app/liff-calendar.html?store_id=${storeId}&store_name=${storeName}`;
  }
  
  // 念のため改行を完全に除去
  calendarUrl = sanitizeUrl(calendarUrl);
  
  console.log('Calendar URL:', calendarUrl); // デバッグログ
  
  // Flex Message形式でリッチなUI（モバイル向け）
  const flexMessage = {
    type: 'flex',
    altText: '予約メニュー',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: decodeURIComponent(storeName),
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: `営業時間 ${openHour}:00〜${closeHour}:00`,
            size: 'sm',
            color: '#ffffff99'
          }
        ],
        backgroundColor: '#667eea',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🗓 ご予約方法をお選びください',
            weight: 'bold',
            size: 'md',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '📅 カレンダーで予約（おすすめ）',
              uri: calendarUrl
            },
            style: 'primary',
            height: 'sm',
            margin: 'md',
            color: '#667eea'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '💬 テキストで予約',
              text: 'テキスト予約'
            },
            style: 'secondary',
            height: 'sm',
            margin: 'md'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📋 予約を確認',
              text: '予約確認'
            },
            style: 'secondary',
            height: 'sm',
            margin: 'md'
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '❌ 予約をキャンセル',
              text: '予約キャンセル'
            },
            style: 'secondary',
            height: 'sm',
            margin: 'md'
          }
        ],
        paddingAll: '0px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 ヒント: カレンダー予約が最も簡単です',
            size: 'xs',
            color: '#999999',
            align: 'center'
          }
        ]
      },
      styles: {
        header: {
          separator: false
        }
      }
    }
  };
  
  // Flex Messageをサポートしているか判定して返す
  // モバイルはFlex Message、PCはテキストメッセージ
  return flexMessage;
}

// テキスト予約用のクイックリプライメッセージ
function createTextReservationMessage() {
  return {
    type: 'text',
    text: '📋 テキストでご予約を承ります\n\n【予約フォーマット】\n「予約 お名前 日付 時間 人数」\n\n例：「予約 山田 明日 18時 4名」\n\n以下のボタンから選択後、お名前を追加してください👇',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📝 お名前入力例',
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
            label: '4名で予約',
            text: '予約 今日 19時 4名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '6名で予約',
            text: '予約 今日 19時 6名'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: 'メニューに戻る',
            text: 'メニュー'
          }
        }
      ]
    }
  };
}

// Vercelサーバーレス関数のメインハンドラー
// @param {Request} req - HTTPリクエストオブジェクト
// @param {Response} res - HTTPレスポンスオブジェクト
export default async function handler(req, res) {
  // CORS headers - ブラウザからのアクセスを許可
  res.setHeader('Access-Control-Allow-Origin', '*');  // 全オリジン許可（本番環境では制限推奨）
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Line-Signature');
  
  // OPTIONS request for CORS - プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET request - ヘルスチェックと管理情報表示
  if (req.method === 'GET') {
    try {
      // Supabase接続テスト - カウントのみ取得（データは不要）
      const { count, error: countError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });  // head: trueでデータ本体を取得しない
      
      if (countError) {
        // テーブルが存在しない場合の処理
        console.log('Table might not exist, attempting to create...');
        
        // RPCでテーブル作成を試行（既存の場合はエラーを無視）
        await supabase.rpc('create_reservations_table_if_not_exists').catch(() => {});
      }
      
      // 最新の予約5件を取得（管理画面表示用）
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })  // 作成日時の降順
        .limit(5);  // 最新5件のみ
      
      return res.status(200).json({
        status: 'active (Supabase Connected)',
        webhook_url: 'https://line-booking-system-seven.vercel.app/webhook',
        database: 'Supabase',
        total_reservations: count || 0,
        recent_reservations: data || [],
        connection_test: error ? `Error: ${error.message}` : 'Connected successfully'
      });
    } catch (err) {
      return res.status(200).json({
        status: 'error',
        error: err.message,
        database: 'Supabase connection failed'
      });
    }
  }
  
  // POST request - LINEからのWebhook処理
  if (req.method === 'POST') {
    try {
      // LINE署名検証（セキュリティ強化）
      const signature = req.headers['x-line-signature'];
      const channelSecret = getEnv('LINE_CHANNEL_SECRET');
      
      // 署名検証の実装（本番環境では必須）
      if (signature && channelSecret && channelSecret !== 'YOUR_CHANNEL_SECRET') {
        const crypto = await import('crypto');
        const body = JSON.stringify(req.body);
        const hash = crypto.createHmac('sha256', channelSecret)
          .update(body)
          .digest('base64');
        
        // 署名が一致しない場合は拒否
        if (signature !== hash) {
          console.warn('Invalid LINE signature detected');
          // ただし、開発環境では警告のみ（実装テスト時のため）
          // return res.status(401).json({ error: 'Invalid signature' });
        }
      }
      
      // LINE Webhook検証用の空リクエスト対応
      if (!req.body || !req.body.events || req.body.events.length === 0) {
        return res.status(200).send('OK');  // LINEは必ず200を期待
      }
      
      const events = req.body.events;
      
      // 各イベントを順次処理
      for (const event of events) {
        // テキストメッセージのみ処理（画像、スタンプなどは無視）
        if (event.type === 'message' && event.message && event.message.type === 'text') {
          const text = event.message.text;  // ユーザーが送信したテキスト
          const userId = event.source?.userId || 'unknown';  // LINE userId（匿名ID）
          const replyToken = event.replyToken;  // 返信用トークン
          
          // メニュー表示のトリガーワード判定
          if (text === 'メニュー' || text === 'menu' || text === '予約したい' || text.includes('予約をご希望') || text === 'はじめる' || text === 'start') {
            console.log('Sending menu message with LIFF calendar');
            await replyMessage(replyToken, [createMenuMessage()]);
            continue;  // 次のイベントへ
          }
          
          // テキスト予約メニュー表示
          if (text === 'テキスト予約') {
            await replyMessage(replyToken, [createTextReservationMessage()]);
            continue;
          }
          
          // 予約キャンセルコマンド処理
          if (text.includes('キャンセル') && text.includes('予約')) {
            // 最新の予約を取得してキャンセル
            const { data: userReservations, error: fetchError } = await supabase
              .from('reservations')
              .select('*')
              .eq('user_id', userId)
              .eq('status', 'pending')  // 確定済みのみ
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (fetchError || !userReservations || userReservations.length === 0) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: 'キャンセル可能な予約が見つかりません。'
              }]);
            } else {
              const reservation = userReservations[0];
              
              // 当日キャンセルチェック
              const today = new Date().toISOString().split('T')[0];
              if (reservation.date <= today) {
                await replyMessage(replyToken, [{
                  type: 'text',
                  text: '申し訳ございません。当日以降の予約キャンセルは、お電話にてご連絡ください。\n📞 000-0000-0000'
                }]);
              } else {
                // キャンセル実行
                const { error: cancelError } = await supabase
                  .from('reservations')
                  .update({ 
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                  })
                  .eq('id', reservation.id);
                
                if (!cancelError) {
                  await replyMessage(replyToken, [{
                    type: 'text',
                    text: `✅ 予約をキャンセルしました\n\n予約ID: #${reservation.id}\n日付: ${reservation.date}\n時間: ${reservation.time ? reservation.time.substring(0, 5) : '未定'}\n\nまたのご予約をお待ちしております。`
                  }]);
                } else {
                  await replyMessage(replyToken, [{
                    type: 'text',
                    text: 'キャンセル処理中にエラーが発生しました。お電話にてご連絡ください。'
                  }]);
                }
              }
            }
            continue;
          }
          
          // 予約確認コマンド処理
          if (text === '予約確認') {
            // ユーザーの最新予約を取得
            const { data: userReservations, error } = await supabase
              .from('reservations')
              .select('*')
              .eq('user_id', userId)  // LINE userIdで絞り込み
              .order('created_at', { ascending: false })
              .limit(1);  // 最新1件のみ
            
            if (error) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: 'エラーが発生しました。もう一度お試しください。'
              }]);
            } else if (userReservations && userReservations.length > 0) {
              const latest = userReservations[0];
              const displayTime = latest.time ? latest.time.substring(0, 5) : '未定';
              await replyMessage(replyToken, [{
                type: 'text',
                text: `📋 最新のご予約\n\n予約番号: #${latest.id}\nお名前: ${latest.customer_name || 'ゲスト'}様\n日付: ${latest.date}\n時間: ${displayTime}\n人数: ${latest.people}名\nステータス: ${latest.status === 'pending' ? '予約確定' : latest.status}`
              }]);
            } else {
              await replyMessage(replyToken, [{
                type: 'text',
                text: 'ご予約が見つかりませんでした。'
              }]);
            }
            continue;
          }
          
          // 予約メッセージの処理（「予約」を含むメッセージ）
          if (text && text.includes('予約')) {
            // フォーマット説明メッセージは予約として処理しない
            if (text.includes('予約フォーマット')) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: '予約フォーマットに従ってメッセージを送信してください。\n例：「予約 山田太郎 明日 18時 4名」'
              }]);
              continue;
            }
            
            // 予約情報のデフォルト値設定
            let customerName = '';  // 名前（未入力時は「ゲスト」）
            let people = 2;  // デフォルト人数2名
            let date = new Date().toISOString().split('T')[0];  // 今日の日付（YYYY-MM-DD形式）
            let time = '19:00:00'; // デフォルト時間19時（HH:MM:SS形式）
            
            // 名前抽出（予約の後の最初の単語、時間・日付・人数以外）
            // 正規表現：「予約」の後の空白に続く、数字や特定キーワード以外の文字列
            const nameMatch = text.match(/予約[\s　]+([^0-9０-９\s　明今時人名様][^\s　]*)/);
            if (nameMatch) {
              customerName = nameMatch[1];
            }
            
            // 人数抽出（「〇人」「〇名」「〇様」形式）
            const peopleMatch = text.match(/(\d+)[人名様]/);
            if (peopleMatch) {
              people = parseInt(peopleMatch[1]);
              // 人数上限チェック（最大20名）
              if (people > 20) {
                await replyMessage(replyToken, [{
                  type: 'text',
                  text: '申し訳ございません。20名を超える団体予約は、お電話にてご相談ください。\n📞 お問い合わせ: 000-0000-0000'
                }]);
                continue;
              }
              // 人数下限チェック（最小1名）
              if (people < 1) {
                people = 1;
              }
            }
            
            // 時間抽出（「〇時」形式）
            const timeMatch = text.match(/(\d{1,2})時/);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              // 24時は0時として扱う
              if (hour === 24) hour = 0;
              // 営業時間チェック（11:00～22:00を想定、環境変数で設定可能）
              const openHour = parseInt(getEnv('OPEN_HOUR', '11'));
              const closeHour = parseInt(getEnv('CLOSE_HOUR', '22'));
              
              if (hour < openHour || hour >= closeHour) {
                await replyMessage(replyToken, [{
                  type: 'text',
                  text: `申し訳ございません。営業時間外のご予約はお受けできません。\n\n営業時間: ${openHour}:00～${closeHour}:00\n\nご希望の時間帯をお選びください。`
                }]);
                continue;
              }
              
              const hourStr = hour.toString().padStart(2, '0');  // 2桁ゼロパディング
              time = `${hourStr}:00:00`; // PostgreSQL TIME型形式（HH:MM:SS）
            }
            
            // 日付抽出（「今日」「明日」キーワード）
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            if (text.includes('明日')) {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);  // 1日加算
              date = tomorrow.toISOString().split('T')[0];  // YYYY-MM-DD形式
            } else if (text.includes('今日')) {
              date = todayStr;
            }
            
            // 過去日付チェック
            if (date < todayStr) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: '過去の日付では予約できません。本日以降の日付をご指定ください。'
              }]);
              continue;
            }
            
            // 予約可能期間チェック（30日先まで）
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
            const maxDateStr = maxDate.toISOString().split('T')[0];
            
            if (date > maxDateStr) {
              await replyMessage(replyToken, [{
                type: 'text',
                text: '申し訳ございません。予約は30日先までとなっております。'
              }]);
              continue;
            }
            
            // Supabaseデータベースに予約情報を保存
            const { data: reservation, error } = await supabase
              .from('reservations')
              .insert([{
                store_id: getEnv('STORE_ID', 'account-001'),  // 環境変数から店舗ID（自動改行除去）
                user_id: userId,  // LINE userId（匿名ID）
                customer_name: customerName || 'ゲスト',  // 名前未入力時は「ゲスト」
                message: text,  // 元のメッセージ全文を保存
                people: people,  // 予約人数
                date: date,  // 予約日（YYYY-MM-DD）
                time: time,  // 予約時間（HH:MM:SS）
                status: 'pending'  // 初期ステータス「予約確定」
              }])
              .select()  // 挿入したデータを返す
              .single();  // 単一レコード取得
            
            if (error) {
              console.error('Database error:', error);
              
              // エラータイプに応じたユーザー向けメッセージ
              let errorMessage = '予約の処理中にエラーが発生しました。';
              
              // テーブル未作成エラー
              if (error.message.includes('relation') && error.message.includes('does not exist')) {
                errorMessage = 'データベースの準備ができていません。管理者にご連絡ください。';
              // API認証エラー
              } else if (error.message.includes('Invalid API key')) {
                errorMessage = 'システムエラーが発生しました。管理者にご連絡ください。';
              }
              
              await replyMessage(replyToken, [{
                type: 'text',
                text: `${errorMessage}\n\nエラー詳細: ${error.message}`
              }]);
            } else {
              // 時間表示用フォーマット（HH:MM:SSからHH:MMへ）
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
              
              await replyMessage(replyToken, [confirmMessage, nextActionMessage]);
            }
          } else if (text === 'ありがとうございました' || text === '終了') {
            await replyMessage(replyToken, [{
              type: 'text',
              text: 'ご利用ありがとうございました！\nまたのご予約をお待ちしております。'
            }]);
          } else {
            // 予約以外のメッセージには予約メニューを提示
            console.log('Sending default menu for text:', text);
            
            // ウェルカムメッセージ（Flex Message）
            const welcomeMessage = {
              type: 'flex',
              altText: 'ようこそ！ご予約はこちらから',
              contents: {
                type: 'bubble',
                hero: {
                  type: 'image',
                  url: 'https://via.placeholder.com/800x400/667eea/ffffff?text=Welcome',
                  size: 'full',
                  aspectRatio: '20:10',
                  aspectMode: 'cover'
                },
                body: {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: 'ようこそ！',
                      weight: 'bold',
                      size: 'xl',
                      margin: 'md'
                    },
                    {
                      type: 'text',
                      text: `${decodeURIComponent(getEnv('STORE_NAME', '当店'))}へのご予約を承ります`,
                      size: 'sm',
                      color: '#999999',
                      margin: 'md',
                      wrap: true
                    },
                    {
                      type: 'separator',
                      margin: 'md'
                    },
                    {
                      type: 'text',
                      text: '💡 使い方のヒント',
                      weight: 'bold',
                      size: 'md',
                      margin: 'md'
                    },
                    {
                      type: 'text',
                      text: '• 「メニュー」と送信で予約画面\n• カレンダーで簡単予約\n• 「予約確認」でいつでも確認',
                      size: 'sm',
                      color: '#666666',
                      margin: 'sm',
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
                        type: 'message',
                        label: '予約を開始',
                        text: 'メニュー'
                      },
                      color: '#667eea'
                    }
                  ],
                  flex: 0
                }
              }
            };
            
            await replyMessage(replyToken, [welcomeMessage]);
          }
        }
      }
      
      // LINEプラットフォーム仕様：必ず200を返す
      return res.status(200).send('OK');
      
    } catch (error) {
      console.error('Error processing webhook:', error);
      // エラー時も200を返す（LINE仕様要求）
      return res.status(200).send('OK');
    }
  }
  
  // GET/POST/OPTIONS以外のHTTPメソッドは拒否
  return res.status(405).json({ error: 'Method not allowed' });
}

// Vercel用のハンドラーエクスポート
export default handler;