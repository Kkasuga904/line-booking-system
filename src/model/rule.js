/**
 * ルールモデル
 * @module model/rule
 */

import { resolveTimes } from '../utils/time.js';

const STORAGE_KEY = 'capacityRules';

/**
 * ルールの形状を保証
 * @param {Object} rule - ルールオブジェクト
 * @returns {Object} 正規化されたルール
 */
export function ensureRuleShape(rule) {
  const r = { ...rule };
  const { s, e, isAllDay } = resolveTimes(r);
  
  if (s && e) {
    r.startTime = s;
    r.endTime = e;
  } else if (isAllDay) {
    r.startTime = "00:00";
    r.endTime = "23:59";
  } else {
    r.startTime = s || "";
    r.endTime = e || "";
  }
  
  // デフォルト値の設定
  if (!r.controlType) {
    r.controlType = 'groups';
  }
  
  if (!r.dateMode) {
    if (r.date) {
      r.dateMode = 'single';
    } else if (r.startDate && r.endDate) {
      r.dateMode = 'range';
    } else if (r.weekday !== undefined && r.weekday !== null) {
      r.dateMode = 'weekly';
    } else {
      r.dateMode = 'single';
    }
  }
  
  r.schemaVersion = 3;
  return r;
}

/**
 * ルールを読み込み
 * @returns {Array} ルールの配列
 */
export function loadRules() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const migrated = raw.map(ensureRuleShape);
    // 正規化したデータを保存し直す（マイグレーション）
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (error) {
    console.error('Failed to load rules:', error);
    return [];
  }
}

/**
 * ルールを保存
 * @param {Array} rules - ルールの配列
 */
export function saveRules(rules) {
  try {
    const normalized = rules.map(ensureRuleShape);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    console.error('Failed to save rules:', error);
    return false;
  }
}

/**
 * 新しいルールを追加
 * @param {Object} rule - 追加するルール
 * @returns {Array} 更新後のルール配列
 */
export function addRule(rule) {
  const rules = loadRules();
  const newRule = ensureRuleShape({
    ...rule,
    id: rule.id || Date.now(),
    createdAt: rule.createdAt || new Date().toISOString()
  });
  rules.push(newRule);
  saveRules(rules);
  return rules;
}

/**
 * ルールを削除
 * @param {string|number} id - 削除するルールのID
 * @returns {Array} 更新後のルール配列
 */
export function deleteRule(id) {
  const rules = loadRules();
  const filtered = rules.filter(r => r.id !== id && r.id !== Number(id));
  saveRules(filtered);
  return filtered;
}

/**
 * ルールを更新
 * @param {string|number} id - 更新するルールのID
 * @param {Object} updates - 更新内容
 * @returns {Array} 更新後のルール配列
 */
export function updateRule(id, updates) {
  const rules = loadRules();
  const index = rules.findIndex(r => r.id === id || r.id === Number(id));
  if (index !== -1) {
    rules[index] = ensureRuleShape({
      ...rules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    });
    saveRules(rules);
  }
  return rules;
}

/**
 * ルールを検索
 * @param {Object} criteria - 検索条件
 * @returns {Array} 検索結果
 */
export function findRules(criteria = {}) {
  const rules = loadRules();
  
  return rules.filter(rule => {
    if (criteria.dateMode && rule.dateMode !== criteria.dateMode) return false;
    if (criteria.date && rule.date !== criteria.date) return false;
    if (criteria.weekday !== undefined && rule.weekday !== criteria.weekday) return false;
    if (criteria.active !== undefined) {
      const isActive = checkRuleActive(rule);
      if (criteria.active !== isActive) return false;
    }
    return true;
  });
}

/**
 * ルールがアクティブかチェック
 * @param {Object} rule - チェックするルール
 * @returns {boolean} アクティブかどうか
 */
export function checkRuleActive(rule) {
  const today = new Date().toISOString().split('T')[0];
  
  switch (rule.dateMode) {
    case 'single':
      return rule.date === today;
    case 'range':
      return rule.startDate <= today && today <= rule.endDate;
    case 'weekly':
      const todayWeekday = new Date().getDay();
      return rule.weekday === todayWeekday;
    default:
      return false;
  }
}