// 予約リマインダーサービス
// 前日通知で来店率向上＆ドタキャン削減

import { createClient } from '@supabase/supabase-js';

class ReminderService {
  constructor(supabase) {
    this.supabase = supabase;
    this.isRunning = false;
    this.stats = {
      sent: 0,
      failed: 0,
      scheduled: 0
    };
  }

  // リマインダー送信
  async sendReminder(userId, reservation, language = 'ja') {
    try {
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (!token) {
        console.error('No LINE token for reminder');
        return false;
      }

      // 多言語対応メッセージ
      const messages = {
        ja: `📅 明日のご予約のお知らせ

日時: ${reservation.date} ${reservation.time}
人数: ${reservation.people || 1}名
予約番号: #${String(reservation.id).padStart(6, '0')}

ご来店をお待ちしております！

※キャンセルの場合は本日中にご連絡ください。`,
        
        en: `📅 Reservation Reminder

Date: ${reservation.date} ${reservation.time}
People: ${reservation.people || 1}
Booking ID: #${String(reservation.id).padStart(6, '0')}

We look forward to seeing you tomorrow!

※Please contact us today if you need to cancel.`,
        
        ko: `📅 내일 예약 알림

일시: ${reservation.date} ${reservation.time}
인원: ${reservation.people || 1}명
예약번호: #${String(reservation.id).padStart(6, '0')}

내일 뵙기를 기대합니다!

※취소는 오늘 중으로 연락 주세요.`,
        
        zh: `📅 明天预约提醒

时间: ${reservation.date} ${reservation.time}
人数: ${reservation.people || 1}位
预约号: #${String(reservation.id).padStart(6, '0')}

期待明天见到您！

※如需取消请今天内联系我们。`
      };

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: userId,
          messages: [{
            type: 'text',
            text: messages[language] || messages.ja
          }]
        })
      });

      if (response.ok) {
        this.stats.sent++;
        console.log(`✅ Reminder sent to ${userId}`);
        
        // 送信記録を保存
        await this.supabase
          .from('reminder_logs')
          .insert({
            reservation_id: reservation.id,
            user_id: userId,
            sent_at: new Date().toISOString(),
            status: 'sent'
          });
        
        return true;
      } else {
        this.stats.failed++;
        console.error(`❌ Failed to send reminder: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.stats.failed++;
      console.error('Reminder error:', error);
      return false;
    }
  }

  // 明日の予約を取得
  async getTomorrowReservations() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('status', 'confirmed')
      .is('reminder_sent', null); // 未送信のみ

    if (error) {
      console.error('Failed to fetch tomorrow reservations:', error);
      return [];
    }

    return data || [];
  }

  // バッチ処理実行
  async processBatch() {
    if (this.isRunning) {
      console.log('Reminder batch already running');
      return;
    }

    this.isRunning = true;
    console.log('🔔 Starting reminder batch process...');

    try {
      const reservations = await this.getTomorrowReservations();
      this.stats.scheduled = reservations.length;
      
      console.log(`Found ${reservations.length} reservations for tomorrow`);

      for (const reservation of reservations) {
        // LINE IDがある予約のみ
        if (reservation.user_id?.startsWith('U')) {
          // 言語検出（名前から推測）
          const language = this.detectLanguageFromName(reservation.customer_name || reservation.name);
          
          const success = await this.sendReminder(
            reservation.user_id,
            reservation,
            language
          );

          if (success) {
            // 送信済みフラグを更新
            await this.supabase
              .from('reservations')
              .update({ reminder_sent: true })
              .eq('id', reservation.id);
          }

          // レート制限対策（1秒待機）
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Reminder batch completed: ${this.stats.sent}/${this.stats.scheduled} sent`);
    } catch (error) {
      console.error('Reminder batch error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // 名前から言語を推測
  detectLanguageFromName(name) {
    if (!name) return 'ja';
    
    // 簡易的な判定
    if (/[A-Za-z]{2,}/.test(name) && !/[ぁ-ん]/.test(name)) {
      return 'en'; // アルファベットのみ
    }
    if (/[가-힣]/.test(name)) {
      return 'ko'; // ハングル
    }
    if (/[\u4e00-\u9fff]/.test(name) && !/[ぁ-ん]/.test(name)) {
      return 'zh'; // 漢字のみ（ひらがな無し）
    }
    
    return 'ja';
  }

  // 統計取得
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.sent > 0 ? 
        ((this.stats.sent / (this.stats.sent + this.stats.failed)) * 100).toFixed(2) + '%' : 
        '0%'
    };
  }

  // 手動実行用
  async sendTestReminder(userId) {
    const testReservation = {
      id: 999999,
      date: '2024-12-25',
      time: '18:00',
      people: 2
    };
    
    return await this.sendReminder(userId, testReservation, 'ja');
  }
}

export default ReminderService;