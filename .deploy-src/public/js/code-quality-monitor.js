/**
 * コード品質監視システム
 * 重複宣言、スコープエラー、その他の一般的な問題を検出して警告
 */

(function() {
    'use strict';
    
    console.log('🔍 Code Quality Monitor - Initializing...');
    
    // エラー検出履歴
    const errorHistory = [];
    const MAX_ERROR_HISTORY = 100;
    
    // 重複宣言チェッカー
    class DuplicateDeclarationChecker {
        constructor() {
            this.declarations = new Map();
            this.scopeStack = [];
        }
        
        checkDeclaration(name, type, location) {
            const scope = this.getCurrentScope();
            const key = `${scope}:${name}`;
            
            if (this.declarations.has(key)) {
                const existing = this.declarations.get(key);
                console.error(`❌ [DUPLICATE] Variable '${name}' already declared`, {
                    first: existing,
                    duplicate: location,
                    type: type
                });
                return false;
            }
            
            this.declarations.set(key, { name, type, location, scope });
            return true;
        }
        
        enterScope(scopeName) {
            this.scopeStack.push(scopeName);
        }
        
        exitScope() {
            const scope = this.scopeStack.pop();
            // スコープを出る時、そのスコープの宣言をクリア
            const prefix = this.getCurrentScope() + ':';
            for (const [key] of this.declarations) {
                if (key.startsWith(prefix)) {
                    this.declarations.delete(key);
                }
            }
        }
        
        getCurrentScope() {
            return this.scopeStack.join('.');
        }
    }
    
    // グローバルエラーハンドラー
    const originalError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        // 重複宣言エラーを検出
        if (message.includes('has already been declared') || 
            message.includes('Identifier') && message.includes('already')) {
            
            const errorInfo = {
                type: 'DUPLICATE_DECLARATION',
                message: message,
                source: source,
                line: lineno,
                column: colno,
                timestamp: new Date().toISOString(),
                stack: error?.stack
            };
            
            errorHistory.push(errorInfo);
            if (errorHistory.length > MAX_ERROR_HISTORY) {
                errorHistory.shift();
            }
            
            console.group('🚨 重複宣言エラーが検出されました');
            console.error('エラー:', message);
            console.error('場所:', `${source}:${lineno}:${colno}`);
            console.error('スタック:', error?.stack);
            
            // 修正提案
            console.info('💡 修正提案:');
            console.info('1. const/let/var の重複宣言を確認してください');
            console.info('2. 同じスコープ内で同じ変数名を使用していないか確認してください');
            console.info('3. グローバル変数との競合を確認してください');
            
            // 変数名を抽出して詳細分析
            const varMatch = message.match(/'([^']+)'/);
            if (varMatch) {
                const varName = varMatch[1];
                console.info(`4. '${varName}' を検索: Ctrl+F で "${varName}" を検索してください`);
                
                // DOMに警告を表示
                showWarningBanner(`重複宣言: ${varName} (行: ${lineno})`);
            }
            
            console.groupEnd();
        }
        
        // オリジナルのエラーハンドラーを呼び出し
        if (originalError) {
            return originalError.apply(this, arguments);
        }
        return false;
    };
    
    // Promiseエラーハンドラー
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        if (reason && reason.toString().includes('already been declared')) {
            console.error('🚨 Promise内で重複宣言エラー:', reason);
            showWarningBanner('Promise内で重複宣言エラーが発生しました');
        }
    });
    
    // 警告バナーを表示
    function showWarningBanner(message) {
        // 既存のバナーを削除
        const existingBanner = document.getElementById('code-quality-warning');
        if (existingBanner) {
            existingBanner.remove();
        }
        
        // 新しいバナーを作成
        const banner = document.createElement('div');
        banner.id = 'code-quality-warning';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
            color: white;
            padding: 15px;
            text-align: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideDown 0.3s ease-out;
        `;
        
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">⚠️</span>
                    <strong>コードエラー検出:</strong>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                ">✕</button>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // 5秒後に自動的に削除
        setTimeout(() => {
            if (banner.parentElement) {
                banner.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => banner.remove(), 300);
            }
        }, 5000);
    }
    
    // アニメーションスタイルを追加
    if (!document.getElementById('code-quality-styles')) {
        const style = document.createElement('style');
        style.id = 'code-quality-styles';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(-100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // スクリプトの動的読み込みを監視
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function(child) {
        if (child.tagName === 'SCRIPT' && child.src) {
            console.log('📝 Script loading:', child.src);
            
            // スクリプトロード後にチェック
            child.addEventListener('load', function() {
                console.log('✅ Script loaded:', child.src);
                performCodeCheck();
            });
            
            child.addEventListener('error', function() {
                console.error('❌ Script load failed:', child.src);
            });
        }
        return originalAppendChild.call(this, child);
    };
    
    // コードチェックを実行
    function performCodeCheck() {
        // グローバル変数の重複チェック
        const globalVars = Object.keys(window);
        const duplicates = globalVars.filter((item, index) => globalVars.indexOf(item) !== index);
        
        if (duplicates.length > 0) {
            console.warn('⚠️ Potential duplicate global variables:', duplicates);
        }
    }
    
    // 開発者向けユーティリティ
    window.CodeQuality = {
        // エラー履歴を取得
        getErrorHistory: function() {
            return errorHistory;
        },
        
        // エラー履歴をクリア
        clearErrorHistory: function() {
            errorHistory.length = 0;
            console.log('✅ Error history cleared');
        },
        
        // 変数の重複をチェック
        checkDuplicates: function(code) {
            const checker = new DuplicateDeclarationChecker();
            const lines = code.split('\n');
            const varPattern = /^\s*(const|let|var)\s+(\w+)/;
            
            lines.forEach((line, index) => {
                const match = line.match(varPattern);
                if (match) {
                    const [, type, name] = match;
                    const location = `line ${index + 1}`;
                    checker.checkDeclaration(name, type, location);
                }
            });
        },
        
        // コード品質レポート
        generateReport: function() {
            console.group('📊 Code Quality Report');
            console.log('Error History:', errorHistory.length, 'errors');
            console.log('Most Recent Errors:');
            errorHistory.slice(-5).forEach(err => {
                console.log(`  - ${err.type}: ${err.message} (${err.timestamp})`);
            });
            console.groupEnd();
        },
        
        // 自動修正提案
        suggestFixes: function() {
            console.group('🔧 自動修正提案');
            
            // 最近のエラーから提案を生成
            const recentErrors = errorHistory.slice(-10);
            const suggestions = new Set();
            
            recentErrors.forEach(err => {
                if (err.type === 'DUPLICATE_DECLARATION') {
                    suggestions.add('変数宣言の前に既存の宣言を検索してください');
                    suggestions.add('関数スコープを適切に分離してください');
                    suggestions.add('グローバル変数の使用を最小限にしてください');
                }
            });
            
            if (suggestions.size === 0) {
                console.log('✅ 現在、修正が必要な問題は検出されていません');
            } else {
                console.log('以下の対策を検討してください:');
                Array.from(suggestions).forEach((suggestion, index) => {
                    console.log(`${index + 1}. ${suggestion}`);
                });
            }
            
            console.groupEnd();
        }
    };
    
    // 初期チェック
    setTimeout(() => {
        performCodeCheck();
        console.log('✅ Code Quality Monitor - Ready');
        console.log('💡 ヒント: window.CodeQuality でユーティリティにアクセスできます');
    }, 1000);
    
    // 定期的なチェック（開発環境のみ）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setInterval(() => {
            if (errorHistory.length > 0) {
                console.log(`⚠️ ${errorHistory.length} errors detected. Run CodeQuality.generateReport() for details.`);
            }
        }, 30000); // 30秒ごと
    }
    
})();