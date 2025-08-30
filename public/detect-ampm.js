// AM/PM表示の原因特定と修正スクリプト

// ========== 検出フェーズ ==========
console.log('=== AM/PM表示の検出開始 ===');

// 1. DOM内のAM/PM表記を検出
function detectAMPM() {
    const results = [];
    [...document.querySelectorAll('input, label, span, div, td, th, button')].forEach(n => {
        const text = (n.value || n.textContent || '').trim();
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text)) {
            results.push({
                element: n,
                tagName: n.tagName,
                id: n.id,
                className: n.className,
                text: text,
                type: n.value ? 'input' : 'text'
            });
            console.log('AM/PM found:', {
                element: n,
                text: text,
                path: getElementPath(n)
            });
        }
    });
    return results;
}

// 要素のパスを取得
function getElementPath(el) {
    const path = [];
    while (el && el !== document.body) {
        let selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className) selector += '.' + el.className.split(' ').join('.');
        path.unshift(selector);
        el = el.parentElement;
    }
    return path.join(' > ');
}

// 2. toLocaleTimeStringの使用を監視
(function() {
    const orig = Date.prototype.toLocaleTimeString;
    Date.prototype.toLocaleTimeString = function(locale, opts) {
        if (!opts || opts.hour12 !== false) {
            console.warn('[toLocaleTimeString] 12時間形式で呼ばれました:', {
                locale: locale,
                options: opts,
                date: this,
                stack: new Error().stack
            });
        }
        return orig.call(this, locale, opts);
    };
    console.log('toLocaleTimeString を監視中...');
})();

// ========== 修正フェーズ ==========

// 24時間形式への変換関数
function to24h(timeStr) {
    if (!timeStr) return timeStr;
    
    // AM/PM形式を24時間形式に変換
    const match = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
    if (!match) return timeStr;
    
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    
    if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return String(hours).padStart(2, '0') + ':' + minutes;
}

// DOM内のすべてのAM/PM表記を24時間形式に変換
function convertAllTo24h() {
    let convertedCount = 0;
    
    // input要素の値を変換
    document.querySelectorAll('input[type="text"], input[type="time"]').forEach(el => {
        const value = el.value?.trim();
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(value)) {
            const newValue = to24h(value);
            el.value = newValue;
            console.log(`変換: ${value} → ${newValue} (input#${el.id})`);
            convertedCount++;
        }
    });
    
    // テキストノードを変換
    document.querySelectorAll('label, span, div, td, th').forEach(el => {
        const text = el.textContent?.trim();
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text)) {
            const newText = to24h(text);
            el.textContent = newText;
            console.log(`変換: ${text} → ${newText} (${el.tagName})`);
            convertedCount++;
        }
    });
    
    return convertedCount;
}

// DOM変更を監視して自動変換
function startAutoConversion() {
    const observer = new MutationObserver((mutations) => {
        let needsConversion = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const target = mutation.target;
                const text = target.textContent || target.value || '';
                if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)) {
                    needsConversion = true;
                }
            }
        });
        
        if (needsConversion) {
            console.log('AM/PM detected in DOM change, converting...');
            convertAllTo24h();
        }
    });
    
    observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['value']
    });
    
    console.log('DOM監視を開始しました（AM/PM自動変換）');
    return observer;
}

// ========== 実行 ==========

console.log('\n1. 現在のAM/PM表示を検出:');
const ampmElements = detectAMPM();
console.log(`  → ${ampmElements.length}個のAM/PM表示を検出`);

console.log('\n2. 24時間形式に変換:');
const converted = convertAllTo24h();
console.log(`  → ${converted}個の要素を変換`);

console.log('\n3. 自動変換を開始:');
const observer = startAutoConversion();

console.log('\n=== 完了 ===');
console.log('今後AM/PM表示が現れても自動的に24時間形式に変換されます');
console.log('停止する場合: observer.disconnect()');

// グローバルに公開
window.ampmDetector = {
    detect: detectAMPM,
    convert: convertAllTo24h,
    to24h: to24h,
    observer: observer
};