/**
 * 予約制御アプリケーション メインエントリーポイント
 * @module main
 */

import { loadRules, saveRules, addRule, deleteRule, updateRule } from './model/rule.js';
import { initUI, renderCards } from './ui/render.js';
import { normalizeHHMMAny, resolveTimes } from './utils/time.js';
import { diagnoseLocalStorage, repairData, debugTimeDisplay } from './utils/validation.js';

/**
 * アプリケーションの状態管理
 */
const appState = {
  currentEditingRule: null,
  isInitialized: false
};

/**
 * フォーム送信を処理
 * @param {Event} event - フォームイベント
 */
function handleFormSubmit(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const rule = {
    dateMode: formData.get('dateMode'),
    controlType: formData.get('controlType')
  };
  
  // 日付情報の設定
  switch (rule.dateMode) {
    case 'single':
      rule.date = formData.get('date');
      break;
    case 'range':
      rule.startDate = formData.get('startDate');
      rule.endDate = formData.get('endDate');
      break;
    case 'weekly':
      rule.weekday = parseInt(formData.get('weekday'));
      break;
  }
  
  // 時刻情報の設定
  if (rule.dateMode !== 'allday') {
    const startTime = normalizeHHMMAny(formData.get('startTime'));
    const endTime = normalizeHHMMAny(formData.get('endTime'));
    if (startTime) rule.startTime = startTime;
    if (endTime) rule.endTime = endTime;
  }
  
  // 容量情報の設定
  if (rule.controlType === 'groups') {
    rule.groups = parseInt(formData.get('groups')) || 0;
  } else {
    rule.people = parseInt(formData.get('people')) || 0;
  }
  
  // ルールの追加または更新
  if (appState.currentEditingRule) {
    updateRule(appState.currentEditingRule.id, rule);
    appState.currentEditingRule = null;
  } else {
    addRule(rule);
  }
  
  // フォームリセットと再描画
  event.target.reset();
  renderCards();
}

/**
 * 日付モード変更を処理
 * @param {Event} event - 変更イベント
 */
function handleDateModeChange(event) {
  const mode = event.target.value;
  const containers = {
    single: document.getElementById('singleDateContainer'),
    range: document.getElementById('rangeDateContainer'),
    weekly: document.getElementById('weeklyContainer'),
    time: document.getElementById('timeContainer')
  };
  
  // すべて非表示
  Object.values(containers).forEach(c => {
    if (c) c.style.display = 'none';
  });
  
  // 選択されたモードを表示
  switch (mode) {
    case 'single':
      if (containers.single) containers.single.style.display = 'block';
      if (containers.time) containers.time.style.display = 'block';
      break;
    case 'range':
      if (containers.range) containers.range.style.display = 'block';
      if (containers.time) containers.time.style.display = 'block';
      break;
    case 'weekly':
      if (containers.weekly) containers.weekly.style.display = 'block';
      if (containers.time) containers.time.style.display = 'block';
      break;
    case 'allday':
      // 終日の場合は時刻入力を非表示
      break;
  }
}

/**
 * 制御タイプ変更を処理
 * @param {Event} event - 変更イベント
 */
function handleControlTypeChange(event) {
  const type = event.target.value;
  const groupsContainer = document.getElementById('groupsContainer');
  const peopleContainer = document.getElementById('peopleContainer');
  
  if (type === 'groups') {
    if (groupsContainer) groupsContainer.style.display = 'block';
    if (peopleContainer) peopleContainer.style.display = 'none';
  } else {
    if (groupsContainer) groupsContainer.style.display = 'none';
    if (peopleContainer) peopleContainer.style.display = 'block';
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // フォーム送信
  const form = document.getElementById('ruleForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
  
  // 日付モード変更
  const dateModeSelect = document.getElementById('dateMode');
  if (dateModeSelect) {
    dateModeSelect.addEventListener('change', handleDateModeChange);
  }
  
  // 制御タイプ変更
  const controlTypeRadios = document.querySelectorAll('input[name="controlType"]');
  controlTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleControlTypeChange);
  });
  
  // 削除ハンドラー
  window.deleteRuleHandler = function(id) {
    if (confirm('このルールを削除しますか？')) {
      deleteRule(id);
      renderCards();
    }
  };
}

/**
 * 初期データマイグレーション（再発防止強化版）
 */
function migrateData() {
  console.log('=== データマイグレーション開始 ===');
  
  // 診断実行
  const diagnostics = diagnoseLocalStorage();
  
  if (!diagnostics.dataValid || diagnostics.recommendations.length > 0) {
    console.warn('データ問題を検出しました。修復を試みます...');
    const repaired = repairData(loadRules);
    
    if (!repaired) {
      console.error('自動修復に失敗しました。手動での確認が必要です');
      // デバッグ情報を出力
      debugTimeDisplay();
    }
  }
  
  // loadRulesが自動的にマイグレーションを実行
  const rules = loadRules();
  console.log(`マイグレーション完了: ${rules.length}件のルール`);
  
  // 開発環境ではデバッグ情報を自動出力
  if (window.location.hostname === 'localhost') {
    debugTimeDisplay();
  }
}

/**
 * アプリケーションを初期化
 */
export function initApp() {
  if (appState.isInitialized) return;
  
  console.log('予約制御アプリケーション初期化中...');
  
  // データマイグレーション
  migrateData();
  
  // UIを初期化
  initUI();
  
  // イベントリスナーを設定
  setupEventListeners();
  
  // 初期表示の設定
  handleDateModeChange({ target: { value: 'single' } });
  handleControlTypeChange({ target: { value: 'groups' } });
  
  appState.isInitialized = true;
  console.log('初期化完了');
}

// DOMContentLoadedで自動初期化
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initApp);
}

// エクスポート（デバッグ用）
export { appState, loadRules, saveRules, addRule, deleteRule, updateRule };