/**
 * UI描画モジュール
 * @module ui/render
 */

import { loadRules, deleteRule } from '../model/rule.js';
import { resolveTimes } from '../utils/time.js';

/**
 * 時刻範囲をフォーマット
 * @param {Object} rule - ルールオブジェクト
 * @returns {string} フォーマット済み時刻範囲
 */
export function formatTimeRange(rule) {
  if (rule.dateMode === 'allday') {
    return '終日';
  }
  
  const { s, e } = resolveTimes(rule);
  
  if (!s && !e) {
    return '(時刻なし)';
  }
  
  if (s && e) {
    return `${s} - ${e}`;
  } else if (s) {
    return `${s} から`;
  } else if (e) {
    return `${e} まで`;
  }
  
  return '(時刻なし)';
}

/**
 * 日付をフォーマット
 * @param {string} dateStr - 日付文字列
 * @returns {string} フォーマット済み日付
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 曜日名を取得
 * @param {number} weekday - 曜日番号 (0-6)
 * @returns {string} 曜日名
 */
export function getWeekdayName(weekday) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return weekdays[weekday] || '';
}

/**
 * ルールカードを作成
 * @param {Object} rule - ルールオブジェクト
 * @returns {HTMLElement} カード要素
 */
export function createRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card';
  card.dataset.ruleId = rule.id;
  
  let dateInfo = '';
  switch (rule.dateMode) {
    case 'single':
      dateInfo = rule.date ? formatDate(rule.date) : '日付未設定';
      break;
    case 'range':
      const start = rule.startDate ? formatDate(rule.startDate) : '';
      const end = rule.endDate ? formatDate(rule.endDate) : '';
      dateInfo = `${start} 〜 ${end}`;
      break;
    case 'weekly':
      dateInfo = `毎週${getWeekdayName(rule.weekday)}曜日`;
      break;
    case 'allday':
      dateInfo = '終日';
      break;
    default:
      dateInfo = '設定なし';
  }
  
  const { s: startTime, e: endTime } = resolveTimes(rule);
  const timeDisplay = rule.dateMode === 'allday' ? '終日' : 
    (startTime && endTime ? `${startTime} - ${endTime}` : '(時刻なし)');
  
  const capacityInfo = rule.controlType === 'groups' 
    ? `${rule.groups || 0}組まで`
    : `${rule.people || 0}名まで`;
  
  card.innerHTML = `
    <div class="rule-header">
      <span class="rule-date">${dateInfo}</span>
      <button class="delete-btn" onclick="window.deleteRuleHandler(${rule.id})">削除</button>
    </div>
    <div class="rule-body">
      <div class="rule-time">${timeDisplay}</div>
      <div class="rule-capacity">${capacityInfo}</div>
    </div>
  `;
  
  return card;
}

/**
 * ルール一覧を描画
 * @param {string} containerId - コンテナ要素のID
 */
export function renderCards(containerId = 'rulesContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const rules = loadRules();
  container.innerHTML = '';
  
  if (rules.length === 0) {
    container.innerHTML = '<p class="no-rules">設定されたルールはありません</p>';
    return;
  }
  
  rules.forEach(rule => {
    container.appendChild(createRuleCard(rule));
  });
}

/**
 * 削除ハンドラーをグローバルに登録
 */
export function setupDeleteHandler() {
  window.deleteRuleHandler = function(id) {
    if (confirm('このルールを削除しますか？')) {
      deleteRule(id);
      renderCards();
    }
  };
}

/**
 * UIを初期化
 */
export function initUI() {
  setupDeleteHandler();
  renderCards();
}