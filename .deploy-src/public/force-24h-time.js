// 24時間形式強制スクリプト
// ブラウザのネイティブタイムピッカーがOS設定（en-US）でAM/PM表示になる問題を解決

(function() {
    'use strict';
    
    // 24時間形式への変換
    function to24Hour(timeStr) {
        if (!timeStr) return '';
        
        // すでに24時間形式の場合はそのまま返す
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
            const [h, m] = timeStr.split(':');
            return `${h.padStart(2, '0')}:${m}`;
        }
        
        // AM/PM形式の場合変換
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return timeStr;
        
        let [_, hours, minutes, period] = match;
        hours = parseInt(hours, 10);
        
        if (period.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period.toUpperCase() === 'AM' && hours === 12) {
            hours = 0;
        }
        
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    
    // 12時間形式への変換（表示用）
    function to12Hour(timeStr) {
        if (!timeStr) return '';
        
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return timeStr;
        
        let [_, hours, minutes] = match;
        hours = parseInt(hours, 10);
        
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        
        return `${hours}:${minutes} ${period}`;
    }
    
    // time inputをtext inputに置き換える
    function forceText24h(elementOrId) {
        const src = typeof elementOrId === 'string' 
            ? document.getElementById(elementOrId) 
            : elementOrId;
            
        if (!src) return;
        
        // すでにtext型の場合は処理済み
        if (src.type === 'text' && src.dataset.time24h === 'true') {
            return;
        }
        
        // 新しいtext inputを作成
        const dst = document.createElement('input');
        dst.type = 'text';
        dst.id = src.id;
        dst.name = src.name;
        dst.className = src.className;
        dst.required = src.required;
        dst.value = to24Hour(src.value);
        
        // 24時間形式の属性を設定
        dst.setAttribute('inputmode', 'numeric');
        dst.setAttribute('placeholder', 'HH:MM (例: 18:00)');
        dst.setAttribute('pattern', '^([01]\\d|2[0-3]):[0-5]\\d$');
        dst.setAttribute('maxlength', '5');
        dst.setAttribute('data-time24h', 'true');
        
        // バリデーション関数
        const validate = function(e) {
            const val = e.target.value;
            
            // 入力中の補完
            if (e.type === 'input') {
                // 数字のみ入力された場合
                if (/^\d{1,4}$/.test(val)) {
                    if (val.length === 3) {
                        // 3桁の場合 (例: 130 → 1:30)
                        e.target.value = val[0] + ':' + val.substr(1);
                    } else if (val.length === 4) {
                        // 4桁の場合 (例: 1830 → 18:30)
                        e.target.value = val.substr(0, 2) + ':' + val.substr(2);
                    }
                }
                
                // AM/PM形式を検出して変換
                const ampm = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (ampm) {
                    e.target.value = to24Hour(val);
                }
            }
            
            // blur時の検証
            if (e.type === 'blur') {
                const converted = to24Hour(val);
                if (converted !== val) {
                    e.target.value = converted;
                }
                
                // 形式チェック
                if (val && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) {
                    e.target.setCustomValidity('HH:MM形式で入力してください (例: 18:00)');
                    e.target.reportValidity();
                } else {
                    e.target.setCustomValidity('');
                }
            }
        };
        
        // イベントリスナーを設定
        dst.addEventListener('input', validate);
        dst.addEventListener('blur', validate);
        dst.addEventListener('change', validate);
        
        // キーボード入力の制御
        dst.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            const val = e.target.value;
            const pos = e.target.selectionStart;
            
            // 数字とコロンのみ許可
            if (!/[\d:]/.test(char)) {
                e.preventDefault();
                return;
            }
            
            // コロンの自動挿入
            if (/^\d{2}$/.test(val) && /\d/.test(char) && pos === 2) {
                e.target.value = val + ':';
            }
        });
        
        // 元の要素を置き換え
        src.parentNode.replaceChild(dst, src);
        
        console.log(`[24h強制] ${dst.id || 'time input'}を24時間形式テキスト入力に変換`);
        
        return dst;
    }
    
    // すべてのtime inputを変換
    function convertAllTimeInputs() {
        const timeInputs = document.querySelectorAll('input[type="time"]');
        let count = 0;
        
        timeInputs.forEach(input => {
            forceText24h(input);
            count++;
        });
        
        if (count > 0) {
            console.log(`[24h強制] ${count}個のtime inputを変換しました`);
        }
        
        return count;
    }
    
    // DOM監視して自動変換
    function startAutoConversion() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // 追加されたノード内のtime inputを検索
                            if (node.tagName === 'INPUT' && node.type === 'time') {
                                forceText24h(node);
                            } else if (node.querySelectorAll) {
                                const inputs = node.querySelectorAll('input[type="time"]');
                                inputs.forEach(input => forceText24h(input));
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
        
        console.log('[24h強制] DOM監視を開始しました');
        return observer;
    }
    
    // 初期化
    function init() {
        console.log('=== 24時間形式強制スクリプト開始 ===');
        
        // DOMContentLoaded後に実行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                convertAllTimeInputs();
                startAutoConversion();
            });
        } else {
            // すでに読み込み済みの場合
            convertAllTimeInputs();
            startAutoConversion();
        }
    }
    
    // グローバルに公開
    window.force24h = {
        convert: forceText24h,
        convertAll: convertAllTimeInputs,
        to24Hour: to24Hour,
        to12Hour: to12Hour,
        init: init
    };
    
    // 自動初期化
    init();
    
})();