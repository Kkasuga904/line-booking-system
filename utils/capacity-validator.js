/**
 * 予約キャパシティ検証システム
 * 
 * データベースの capacity_rules テーブルの制限ルールに基づいて
 * 新規予約や変更予約が可能かどうかを検証する
 * 
 * 使用例:
 * const validator = new CapacityValidator();
 * const result = await validator.validateReservation(reservation);
 * if (!result.allowed) {
 *   console.log(result.reason); // 制限理由
 * }
 */

import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export class CapacityValidator {
  /**
   * 予約の検証を実行
   * @param {Object} reservation - 予約オブジェクト
   * @param {string} reservation.store_id - 店舗ID
   * @param {string} reservation.date - 予約日 (YYYY-MM-DD)
   * @param {string} reservation.time - 予約時間 (HH:MM)
   * @param {string} reservation.seat_type - 席タイプ
   * @param {string} reservation.menu - メニュー
   * @param {string} reservation.staff - スタッフ
   * @returns {Promise<{allowed: boolean, reason?: string, rule?: Object}>}
   */
  async validateReservation(reservation) {
    try {
      // 適用可能なルールを取得
      const rules = await this.getApplicableRules(reservation);
      
      if (rules.length === 0) {
        return { allowed: true };
      }

      // 優先度順でルール評価
      rules.sort((a, b) => b.priority - a.priority);

      for (const rule of rules) {
        const result = await this.evaluateRule(rule, reservation);
        if (!result.allowed) {
          return {
            allowed: false,
            reason: result.reason,
            rule: rule
          };
        }
      }

      return { allowed: true };

    } catch (error) {
      console.error('Capacity validation error:', error);
      // エラー時は予約を許可（安全側に倒す）
      return { allowed: true, error: error.message };
    }
  }

  /**
   * 予約に適用可能なルールを取得
   */
  async getApplicableRules(reservation) {
    const reservationDate = new Date(reservation.date + 'T' + reservation.time);
    const reservationWeekday = reservationDate.getDay(); // 0=Sunday, 1=Monday...

    // 基本クエリ: アクティブなルールのみ
    let query = supabase
      .from('capacity_rules')
      .select('*')
      .eq('store_id', reservation.store_id)
      .eq('active', true);

    const { data: allRules, error } = await query;
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // JavaScriptでフィルタリング（複雑な条件のため）
    return allRules.filter(rule => {
      // 日付範囲チェック
      if (rule.date_start && rule.date_end) {
        const startDate = new Date(rule.date_start);
        const endDate = new Date(rule.date_end);
        if (reservationDate < startDate || reservationDate > endDate) {
          return false;
        }
      }

      // 曜日チェック
      if (rule.weekdays && rule.weekdays.length > 0) {
        if (!rule.weekdays.includes(reservationWeekday)) {
          return false;
        }
      }

      // 時刻チェック
      if (rule.time_start || rule.time_end) {
        const reservationTime = reservation.time;
        if (rule.time_start && reservationTime < rule.time_start) {
          return false;
        }
        if (rule.time_end && reservationTime > rule.time_end) {
          return false;
        }
      }

      // スコープチェック
      return this.matchesScope(rule, reservation);
    });
  }

  /**
   * ルールのスコープが予約にマッチするかチェック
   */
  matchesScope(rule, reservation) {
    switch (rule.scope_type) {
      case 'store':
        return true; // 店舗全体のルール

      case 'seat_type':
        return rule.scope_ids && rule.scope_ids.includes(reservation.seat_type);

      case 'seat':
        return rule.scope_ids && rule.scope_ids.includes(reservation.seat_id);

      case 'menu':
        return rule.scope_ids && rule.scope_ids.includes(reservation.menu);

      case 'staff':
        return rule.scope_ids && rule.scope_ids.includes(reservation.staff);

      default:
        return false;
    }
  }

  /**
   * 個別ルールの評価
   */
  async evaluateRule(rule, reservation) {
    switch (rule.limit_type) {
      case 'stop':
        return {
          allowed: false,
          reason: `${rule.description || '予約停止中です'}`
        };

      case 'per_hour':
        return await this.checkHourlyLimit(rule, reservation);

      case 'per_day':
        return await this.checkDailyLimit(rule, reservation);

      case 'concurrent':
        return await this.checkConcurrentLimit(rule, reservation);

      default:
        return { allowed: true };
    }
  }

  /**
   * 1時間あたりの制限チェック
   */
  async checkHourlyLimit(rule, reservation) {
    const reservationDateTime = new Date(reservation.date + 'T' + reservation.time);
    const hourStart = new Date(reservationDateTime);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourEnd.getHours() + 1);

    const count = await this.countReservationsInTimeRange(
      rule, reservation, hourStart, hourEnd
    );

    if (count >= rule.limit_value) {
      return {
        allowed: false,
        reason: `${rule.description || `1時間あたり${rule.limit_value}件の制限に達しています`}`
      };
    }

    return { allowed: true };
  }

  /**
   * 1日あたりの制限チェック
   */
  async checkDailyLimit(rule, reservation) {
    const reservationDate = reservation.date;
    const dayStart = new Date(reservationDate + 'T00:00:00');
    const dayEnd = new Date(reservationDate + 'T23:59:59');

    const count = await this.countReservationsInTimeRange(
      rule, reservation, dayStart, dayEnd
    );

    if (count >= rule.limit_value) {
      return {
        allowed: false,
        reason: `${rule.description || `1日あたり${rule.limit_value}件の制限に達しています`}`
      };
    }

    return { allowed: true };
  }

  /**
   * 同時並行の制限チェック
   */
  async checkConcurrentLimit(rule, reservation) {
    // 仮の実装: 同じ時刻の予約数をカウント
    // 実際の実装では、予約の所要時間も考慮する必要がある
    const reservationDateTime = reservation.date + 'T' + reservation.time;
    
    const { data: existingReservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', reservation.store_id)
      .eq('date', reservation.date)
      .eq('time', reservation.time)
      .eq('status', 'confirmed');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // スコープでフィルタリング
    const scopeMatches = existingReservations.filter(r => 
      this.matchesScope(rule, r)
    );

    if (scopeMatches.length >= rule.limit_value) {
      return {
        allowed: false,
        reason: `${rule.description || `同時並行${rule.limit_value}件の制限に達しています`}`
      };
    }

    return { allowed: true };
  }

  /**
   * 指定時間範囲内の予約数をカウント
   */
  async countReservationsInTimeRange(rule, reservation, startTime, endTime) {
    // TODO: 実際のreservationsテーブルが作成されたら実装
    // 現在は仮の実装
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('store_id', reservation.store_id)
      .gte('created_at', startTime.toISOString())
      .lte('created_at', endTime.toISOString())
      .eq('status', 'confirmed');

    if (error) {
      console.warn('Count query failed:', error.message);
      return 0; // エラー時は0を返して予約を許可
    }

    // スコープでフィルタリング
    return reservations.filter(r => this.matchesScope(rule, r)).length;
  }

  /**
   * 制限ルールの一覧取得（管理用）
   */
  async getActiveRules(storeId) {
    const { data, error } = await supabase
      .from('capacity_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('active', true)
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * 制限統計の取得（ダッシュボード用）
   */
  async getCapacityStats(storeId, date) {
    const rules = await this.getActiveRules(storeId);
    const stats = [];

    for (const rule of rules) {
      if (rule.limit_type === 'stop') continue;

      const stat = {
        rule_id: rule.id,
        description: rule.description,
        limit_type: rule.limit_type,
        limit_value: rule.limit_value,
        current_count: 0,
        utilization: 0
      };

      // 現在の使用状況を計算
      // TODO: 実際のデータに基づいて実装

      stats.push(stat);
    }

    return stats;
  }
}

export default CapacityValidator;