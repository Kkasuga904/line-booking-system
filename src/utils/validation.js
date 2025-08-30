/**
 * 再発防止のためのバリデーションモジュール
 * @module utils/validation
 */

/**
 * 時刻データの妥当性をチェック
 * @param {Object} rule - ルールオブジェクト
 * @returns {Object} 検証結果
 */
export function validateTimeData(rule) {
  const issues = [];
  const warnings = [];
  
  // 1. 時刻フィールドの存在チェック
  if (!rule.startTime && !rule.endTime && rule.dateMode !== 'allday') {
    issues.push('時刻が設定されていません');
  }
  
  // 2. 時刻フォーマットの検証
  if (rule.startTime && !/^\d{2}:\d{2}$/.test(rule.startTime)) {
    issues.push(`開始時刻のフォーマットが不正: ${rule.startTime}`);
  }
  
  if (rule.endTime && !/^\d{2}:\d{2}$/.test(rule.endTime)) {
    issues.push(`終了時刻のフォーマットが不正: ${rule.endTime}`);
  }
  
  // 3. レガシープロパティの検出
  const legacyProps = ['start', 'end', 'from', 'to', 'time'];
  const foundLegacy = legacyProps.filter(prop => rule[prop] !== undefined);
  if (foundLegacy.length > 0) {
    warnings.push(`レガシープロパティが検出されました: ${foundLegacy.join(', ')}`);
  }
  
  // 4. スキーマバージョンチェック
  if (!rule.schemaVersion || rule.schemaVersion < 3) {
    warnings.push('古いスキーマバージョンです。マイグレーションが必要です');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * LocalStorageデータの整合性チェック
 * @returns {Object} 診断結果
 */
export function diagnoseLocalStorage() {
  const diagnostics = {
    hasData: false,
    dataValid: false,
    rules: [],
    issues: [],
    recommendations: []
  };
  
  try {
    const raw = localStorage.getItem('capacityRules');
    diagnostics.hasData = raw !== null && raw !== '[]';
    
    if (diagnostics.hasData) {
      const rules = JSON.parse(raw);
      diagnostics.rules = rules;
      
      // 各ルールを検証
      rules.forEach((rule, index) => {
        const validation = validateTimeData(rule);
        if (!validation.valid) {
          diagnostics.issues.push(`ルール${index + 1}: ${validation.issues.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
          diagnostics.recommendations.push(`ルール${index + 1}: ${validation.warnings.join(', ')}`);
        }
      });
      
      diagnostics.dataValid = diagnostics.issues.length === 0;
    }
  } catch (error) {
    diagnostics.issues.push(`LocalStorage読み込みエラー: ${error.message}`);
  }
  
  return diagnostics;
}

/**
 * データ修復関数
 * @param {Function} loadRulesFunc - loadRules関数
 * @returns {boolean} 修復成功フラグ
 */
export function repairData(loadRulesFunc) {
  console.log('データ修復を開始します...');
  
  const diagnostics = diagnoseLocalStorage();
  
  if (!diagnostics.hasData) {
    console.log('修復対象のデータがありません');
    return false;
  }
  
  if (diagnostics.dataValid && diagnostics.recommendations.length === 0) {
    console.log('データは正常です。修復の必要はありません');
    return true;
  }
  
  try {
    // 引数で渡されたloadRules関数を使用してマイグレーション
    if (!loadRulesFunc) {
      console.error('loadRules関数が提供されていません');
      return false;
    }
    
    const rules = loadRulesFunc(); // これが自動的にマイグレーションを実行
    
    console.log(`${rules.length}件のルールをマイグレーションしました`);
    
    // 再診断
    const afterDiagnostics = diagnoseLocalStorage();
    if (afterDiagnostics.dataValid) {
      console.log('データ修復が完了しました');
      return true;
    } else {
      console.error('修復後も問題が残っています:', afterDiagnostics.issues);
      return false;
    }
  } catch (error) {
    console.error('データ修復中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * デバッグ情報を出力
 */
export function debugTimeDisplay() {
  const diagnostics = diagnoseLocalStorage();
  
  console.group('🔍 時刻表示デバッグ情報');
  console.log('LocalStorageにデータが存在:', diagnostics.hasData);
  console.log('データの妥当性:', diagnostics.dataValid);
  
  if (diagnostics.rules.length > 0) {
    console.log('保存されているルール:');
    diagnostics.rules.forEach((rule, index) => {
      console.log(`  ルール${index + 1}:`, {
        startTime: rule.startTime,
        endTime: rule.endTime,
        dateMode: rule.dateMode,
        schemaVersion: rule.schemaVersion
      });
    });
  }
  
  if (diagnostics.issues.length > 0) {
    console.warn('検出された問題:', diagnostics.issues);
  }
  
  if (diagnostics.recommendations.length > 0) {
    console.info('推奨事項:', diagnostics.recommendations);
  }
  
  console.groupEnd();
}