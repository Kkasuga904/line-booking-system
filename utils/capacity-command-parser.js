/**
 * LINE Capacity Command Parser
 * 
 * 店長がLINEで送ったコマンドを解析して制限ルールに変換
 * 
 * サポートするコマンド例:
 * /limit today 20 ... 今日の総予約 20件で打ち止め
 * /limit 2025-09-01..2025-09-15 lunch 10 ... 日付範囲のランチを1時間10件
 * /limit sat,sun 11:00-14:00 3/h seat:カラー ... 週末のカラー席を1時間3件
 * /stop today 18:00- ... 今日18時以降停止
 * /limits ... ルール一覧表示
 * /limit off #123 ... ルールIDで無効化
 */

import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export class CapacityCommandParser {
  constructor() {
    this.weekdayMap = {
      'sun': 0, 'sunday': 0, '日': 0,
      'mon': 1, 'monday': 1, '月': 1,
      'tue': 2, 'tuesday': 2, '火': 2,
      'wed': 3, 'wednesday': 3, '水': 3,
      'thu': 4, 'thursday': 4, '木': 4,
      'fri': 5, 'friday': 5, '金': 5,
      'sat': 6, 'saturday': 6, '土': 6
    };
  }

  /**
   * コマンドを解析してルールオブジェクトに変換
   */
  async parseCommand(messageText, userId = null, storeId = 'account-001') {
    const text = messageText.trim();
    
    // コマンドの種類を判定
    if (text.startsWith('/limit ')) {
      return await this.parseLimitCommand(text.substring(7), userId, storeId);
    } else if (text.startsWith('/stop ')) {
      return await this.parseStopCommand(text.substring(6), userId, storeId);
    } else if (text === '/limits') {
      return await this.listRules(storeId);
    } else {
      return null; // コマンドではない
    }
  }

  /**
   * /limit コマンドの解析
   * 例: "today 20" "sat,sun 11:00-14:00 3/h seat:カラー"
   */
  async parseLimitCommand(params, userId, storeId) {
    const parts = params.split(' ').filter(p => p.length > 0);
    
    // /limit off #123 (ルール無効化)
    if (parts[0] === 'off' && parts[1]?.startsWith('#')) {
      const ruleId = parts[1].substring(1);
      return await this.deactivateRule(ruleId, storeId);
    }

    // 通常のlimitコマンドを解析
    const rule = {
      store_id: storeId,
      scope_type: 'store',
      scope_ids: null,
      active: true,
      created_by: userId,
      priority: 0
    };

    let i = 0;

    // 1. 時間指定の解析
    const timeResult = this.parseTimeSpecs(parts, i);
    Object.assign(rule, timeResult.rule);
    i = timeResult.nextIndex;

    // 2. 制限値の解析
    if (i < parts.length) {
      const limitResult = this.parseLimitValue(parts[i]);
      Object.assign(rule, limitResult);
      i++;
    }

    // 3. 対象範囲の解析 (seat:カラー, menu:カット等)
    while (i < parts.length) {
      const scopeResult = this.parseScope(parts[i]);
      if (scopeResult) {
        rule.scope_type = scopeResult.scope_type;
        rule.scope_ids = scopeResult.scope_ids;
      }
      i++;
    }

    // 自然文説明の生成
    rule.description = this.generateDescription(rule);

    // データベースに保存
    const { data, error } = await supabase
      .from('capacity_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      rule: data,
      message: `制限ルールを設定しました:\n${rule.description}`
    };
  }

  /**
   * /stop コマンドの解析
   * 例: "today 18:00-" "sat,sun"
   */
  async parseStopCommand(params, userId, storeId) {
    const rule = {
      store_id: storeId,
      scope_type: 'store',
      scope_ids: null,
      limit_type: 'stop',
      limit_value: null,
      active: true,
      created_by: userId,
      priority: 5 // stopは高優先度
    };

    const parts = params.split(' ').filter(p => p.length > 0);
    const timeResult = this.parseTimeSpecs(parts, 0);
    Object.assign(rule, timeResult.rule);

    rule.description = this.generateDescription(rule);

    const { data, error } = await supabase
      .from('capacity_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      rule: data,
      message: `予約停止ルールを設定しました:\n${rule.description}`
    };
  }

  /**
   * 時間指定の解析
   * today, tomorrow, 2025-01-01..2025-01-31, sat,sun, 11:00-14:00
   */
  parseTimeSpecs(parts, startIndex) {
    const rule = {};
    let i = startIndex;

    while (i < parts.length) {
      const part = parts[i].toLowerCase();

      // 日付指定
      if (part === 'today') {
        const today = new Date();
        rule.date_start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        rule.date_end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      } else if (part === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        rule.date_start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        rule.date_end = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
      } else if (part.includes('..')) {
        // 日付範囲: 2025-01-01..2025-01-31
        const [start, end] = part.split('..');
        rule.date_start = new Date(start + 'T00:00:00');
        rule.date_end = new Date(end + 'T23:59:59');
      } else if (part.includes(',') && this.isWeekdayList(part)) {
        // 曜日指定: sat,sun
        rule.weekdays = part.split(',').map(day => this.weekdayMap[day.trim()]).filter(d => d !== undefined);
      } else if (part.includes('-') && this.isTimeRange(part)) {
        // 時刻範囲: 11:00-14:00 or 18:00-
        const [start, end] = part.split('-');
        rule.time_start = start || null;
        rule.time_end = end || null;
      } else if (part === 'lunch') {
        // 定型時間
        rule.time_start = '11:00';
        rule.time_end = '15:00';
      } else if (part === 'dinner') {
        rule.time_start = '17:00';
        rule.time_end = '22:00';
      } else {
        // 時間指定ではない場合はループを抜ける
        break;
      }
      i++;
    }

    return { rule, nextIndex: i };
  }

  /**
   * 制限値の解析
   * 20, 3/h, 5/day, 2/concurrent
   */
  parseLimitValue(value) {
    if (value.includes('/h')) {
      return {
        limit_type: 'per_hour',
        limit_value: parseInt(value.replace('/h', ''))
      };
    } else if (value.includes('/day')) {
      return {
        limit_type: 'per_day',
        limit_value: parseInt(value.replace('/day', ''))
      };
    } else if (value.includes('/concurrent')) {
      return {
        limit_type: 'concurrent',
        limit_value: parseInt(value.replace('/concurrent', ''))
      };
    } else if (!isNaN(value)) {
      // 数値のみの場合はデフォルトで1日制限
      return {
        limit_type: 'per_day',
        limit_value: parseInt(value)
      };
    }
    
    return {
      limit_type: 'per_hour',
      limit_value: 1
    };
  }

  /**
   * 対象範囲の解析
   * seat:カラー, menu:カット, staff:田中
   */
  parseScope(scopeText) {
    if (!scopeText.includes(':')) return null;

    const [type, targets] = scopeText.split(':', 2);
    const targetList = targets.split(',').map(t => t.trim());

    const typeMap = {
      'seat': 'seat_type',
      '席': 'seat_type',
      'menu': 'menu',
      'メニュー': 'menu',
      'staff': 'staff',
      'スタッフ': 'staff'
    };

    return {
      scope_type: typeMap[type] || 'seat_type',
      scope_ids: targetList
    };
  }

  /**
   * 自然文説明の生成
   */
  generateDescription(rule) {
    let desc = '';

    // 時間条件
    if (rule.date_start && rule.date_end) {
      const start = new Date(rule.date_start);
      const end = new Date(rule.date_end);
      if (this.isSameDay(start, end)) {
        if (this.isToday(start)) {
          desc += '今日';
        } else if (this.isTomorrow(start)) {
          desc += '明日';
        } else {
          desc += start.toLocaleDateString('ja-JP');
        }
      } else {
        desc += `${start.toLocaleDateString('ja-JP')}〜${end.toLocaleDateString('ja-JP')}`;
      }
    } else if (rule.weekdays) {
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      desc += `毎週${rule.weekdays.map(d => dayNames[d]).join('・')}曜日`;
    }

    if (rule.time_start || rule.time_end) {
      if (desc) desc += 'の';
      desc += `${rule.time_start || '開店'}〜${rule.time_end || '閉店'}`;
    }

    // 対象範囲
    if (rule.scope_type !== 'store') {
      desc += `の${rule.scope_ids ? rule.scope_ids.join('・') : '指定範囲'}`;
    }

    // 制限内容
    if (rule.limit_type === 'stop') {
      desc += 'は予約停止';
    } else {
      const typeMap = {
        'per_hour': '1時間あたり',
        'per_day': '1日あたり',
        'concurrent': '同時並行'
      };
      desc += `は${typeMap[rule.limit_type]}${rule.limit_value}件まで`;
    }

    return desc;
  }

  /**
   * ルール一覧の取得
   */
  async listRules(storeId) {
    const { data, error } = await supabase
      .from('capacity_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('active', true)
      .order('priority', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.length === 0) {
      return { 
        success: true, 
        message: '現在、制限ルールは設定されていません。' 
      };
    }

    let message = '📋 現在の制限ルール:\n\n';
    data.forEach((rule, index) => {
      message += `${index + 1}. ${rule.description}\n`;
      message += `   ID: #${rule.id.split('-')[0]} ${rule.active ? '🟢' : '🔴'}\n\n`;
    });

    message += '無効にする場合: /limit off #ID';

    return { success: true, message };
  }

  /**
   * ルールの無効化
   */
  async deactivateRule(ruleId, storeId) {
    const { data, error } = await supabase
      .from('capacity_rules')
      .update({ active: false })
      .eq('store_id', storeId)
      .ilike('id', `${ruleId}%`)
      .select()
      .single();

    if (error) {
      return { success: false, error: 'ルールが見つかりませんでした' };
    }

    return {
      success: true,
      message: `ルールを無効化しました:\n${data.description}`
    };
  }

  // ヘルパー関数
  isWeekdayList(text) {
    const days = text.split(',');
    return days.every(day => this.weekdayMap[day.trim().toLowerCase()] !== undefined);
  }

  isTimeRange(text) {
    return /^\d{1,2}:\d{2}-(\d{1,2}:\d{2})?$/.test(text);
  }

  isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  isToday(date) {
    return this.isSameDay(date, new Date());
  }

  isTomorrow(date) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.isSameDay(date, tomorrow);
  }
}

export default CapacityCommandParser;