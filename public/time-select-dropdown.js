// 時間選択プルダウンコンポーネント
// AM/PM問題を完全に回避し、ユーザーフレンドリーな時間選択を提供

(function() {
    'use strict';
    
    // 時間のオプションを生成（30分単位）
    function generateTimeOptions() {
        const options = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const h = String(hour).padStart(2, '0');
                const m = String(minute).padStart(2, '0');
                const time = `${h}:${m}`;
                const label = hour === 0 ? `00:${m} (深夜)` :
                            hour < 6 ? `${h}:${m} (早朝)` :
                            hour < 12 ? `${h}:${m} (午前)` :
                            hour === 12 ? `12:${m} (正午)` :
                            hour < 18 ? `${h}:${m} (午後)` :
                            hour < 21 ? `${h}:${m} (夕方)` :
                            `${h}:${m} (夜)`;
                options.push({ value: time, label: label });
            }
        }
        return options;
    }
    
    // 営業時間用のオプションを生成（主に飲食店向け）
    function generateBusinessHours() {
        const options = [];
        // 朝営業: 6:00-11:00
        for (let h = 6; h <= 11; h++) {
            for (let m = 0; m < 60; m += 30) {
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                options.push({ value: time, label: time });
            }
        }
        // 昼営業: 11:30-14:30
        options.push({ value: '11:30', label: '11:30' });
        for (let h = 12; h <= 14; h++) {
            for (let m = 0; m < 60; m += 30) {
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                options.push({ value: time, label: time });
            }
        }
        // 夜営業: 17:00-23:30
        for (let h = 17; h <= 23; h++) {
            for (let m = 0; m < 60; m += 30) {
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                options.push({ value: time, label: time });
            }
        }
        return options;
    }
    
    // time inputをselectに変換
    function convertToTimeSelect(element, useBusinessHours = true) {
        if (!element) return;
        
        // すでに変換済みの場合はスキップ
        if (element.dataset.timeSelectConverted === 'true') {
            return;
        }
        
        // select要素を作成
        const select = document.createElement('select');
        select.id = element.id;
        select.name = element.name;
        select.className = element.className;
        select.required = element.required;
        
        // スタイルを追加
        select.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            cursor: pointer;
            transition: border-color 0.3s;
        `;
        
        // フォーカス時のスタイル
        select.addEventListener('focus', () => {
            select.style.borderColor = '#3b82f6';
            select.style.outline = 'none';
            select.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
        });
        
        select.addEventListener('blur', () => {
            select.style.borderColor = '#d1d5db';
            select.style.boxShadow = 'none';
        });
        
        // オプションを生成
        const options = useBusinessHours ? generateBusinessHours() : generateTimeOptions();
        
        // デフォルトオプション
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '時間を選択';
        defaultOption.disabled = true;
        defaultOption.selected = !element.value;
        select.appendChild(defaultOption);
        
        // 時間オプションを追加
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (element.value === opt.value) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        // カスタムデータ属性を設定
        select.dataset.timeSelectConverted = 'true';
        select.dataset.originalType = element.type;
        select.dataset.originalValue = element.value;
        
        // 元の要素を置き換え
        element.parentNode.replaceChild(select, element);
        
        console.log(`[TimeSelect] ${select.id || 'time input'}を選択メニューに変換しました`);
        
        return select;
    }
    
    // すべての時間入力を変換
    function convertAllTimeInputs() {
        // type="time"のinput要素
        const timeInputs = document.querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => convertToTimeSelect(input));
        
        // 時間入力用のtext input（IDやクラスで判定）
        const textTimeInputs = document.querySelectorAll([
            'input[id*="time"][type="text"]',
            'input[id*="Time"][type="text"]',
            'input[class*="time-input"]',
            '#startTime',
            '#endTime',
            '#editStartTime',
            '#editEndTime'
        ].join(', '));
        
        textTimeInputs.forEach(input => {
            // パターンマッチで時間入力と判定
            if (input.pattern && input.pattern.includes(':')) {
                convertToTimeSelect(input);
            }
        });
        
        console.log('[TimeSelect] 時間入力の変換を完了しました');
    }
    
    // DOM監視
    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            // 追加されたノード内の時間入力を検索
                            if (node.tagName === 'INPUT' && 
                                (node.type === 'time' || 
                                 (node.type === 'text' && node.pattern && node.pattern.includes(':')))) {
                                convertToTimeSelect(node);
                            } else if (node.querySelectorAll) {
                                const inputs = node.querySelectorAll('input[type="time"], input[type="text"]');
                                inputs.forEach(input => {
                                    if (input.type === 'time' || 
                                        (input.pattern && input.pattern.includes(':'))) {
                                        convertToTimeSelect(input);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('[TimeSelect] DOM監視を開始しました');
        return observer;
    }
    
    // 値の取得/設定用ヘルパー
    function getTimeValue(elementId) {
        const element = document.getElementById(elementId);
        if (element && element.tagName === 'SELECT') {
            return element.value;
        }
        return null;
    }
    
    function setTimeValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && element.tagName === 'SELECT') {
            element.value = value;
            // changeイベントを発火
            const event = new Event('change', { bubbles: true });
            element.dispatchEvent(event);
        }
    }
    
    // 初期化
    function init() {
        console.log('=== 時間選択プルダウン初期化 ===');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                convertAllTimeInputs();
                observeDOM();
            });
        } else {
            convertAllTimeInputs();
            observeDOM();
        }
    }
    
    // グローバルに公開
    window.timeSelect = {
        convert: convertToTimeSelect,
        convertAll: convertAllTimeInputs,
        getValue: getTimeValue,
        setValue: setTimeValue,
        generateOptions: generateTimeOptions,
        generateBusinessHours: generateBusinessHours,
        init: init
    };
    
    // 自動初期化
    init();
    
})();