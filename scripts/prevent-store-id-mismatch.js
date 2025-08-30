/**
 * Store ID不一致防止スクリプト
 * 
 * 問題: フロントエンドとバックエンドでStore IDの値が異なることによる予約失敗
 * 原因: 各ファイルで独立してデフォルト値を設定しているため、値の不整合が発生
 * 
 * このスクリプトは全ファイルのStore ID設定を検査し、不整合を検出・修正します
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 標準のStore ID値
const STANDARD_STORE_ID = 'default-store';
const LEGACY_STORE_ID = 'default';

// Store ID設定パターン
const patterns = {
    javascript: [
        /store_id\s*[:|=]\s*['"`]([^'"`]+)['"`]/gi,
        /storeId\s*[:|=]\s*urlParams\.get\(['"`]store_id['"`]\)\s*\|\|\s*['"`]([^'"`]+)['"`]/gi,
        /STORE_ID\s*\|\|\s*['"`]([^'"`]+)['"`]/gi
    ],
    html: [
        /store_id['"`]?\s*[:|=]\s*['"`]([^'"`]+)['"`]/gi
    ]
};

// チェック対象ファイル
const filesToCheck = [
    'server.js',
    'public/*.html',
    'public/**/*.html',
    'api/*.js',
    'src/**/*.js'
];

class StoreIdValidator {
    constructor() {
        this.issues = [];
        this.fixedCount = 0;
    }

    /**
     * Store ID設定を検査
     */
    async validateStoreIds() {
        console.log('🔍 Store ID設定の検査を開始...\n');
        
        for (const pattern of filesToCheck) {
            const files = glob.sync(path.join(process.cwd(), pattern));
            
            for (const file of files) {
                await this.checkFile(file);
            }
        }
        
        return this.issues;
    }

    /**
     * ファイル内のStore ID設定をチェック
     */
    async checkFile(filepath) {
        const content = fs.readFileSync(filepath, 'utf8');
        const ext = path.extname(filepath);
        const filename = path.basename(filepath);
        
        // 適切なパターンを選択
        const checkPatterns = ext === '.html' ? patterns.html : patterns.javascript;
        
        for (const pattern of checkPatterns) {
            let match;
            pattern.lastIndex = 0; // Reset regex
            
            while ((match = pattern.exec(content)) !== null) {
                const foundValue = match[1];
                
                // 問題のあるStore IDを検出
                if (foundValue === LEGACY_STORE_ID) {
                    this.issues.push({
                        file: filepath,
                        line: this.getLineNumber(content, match.index),
                        found: foundValue,
                        expected: STANDARD_STORE_ID,
                        context: match[0]
                    });
                }
            }
        }
    }

    /**
     * 検出した問題を修正
     */
    async fixIssues(autoFix = false) {
        if (this.issues.length === 0) {
            console.log('✅ Store ID設定に問題はありません\n');
            return;
        }
        
        console.log(`⚠️  ${this.issues.length}件のStore ID不整合を検出:\n`);
        
        for (const issue of this.issues) {
            console.log(`📄 ${issue.file}:${issue.line}`);
            console.log(`   発見: "${issue.found}" → 期待値: "${issue.expected}"`);
            console.log(`   コンテキスト: ${issue.context}\n`);
            
            if (autoFix) {
                await this.fixFile(issue);
            }
        }
        
        if (autoFix) {
            console.log(`\n✅ ${this.fixedCount}件の問題を修正しました`);
        } else {
            console.log('\n💡 修正するには --fix オプションを付けて実行してください');
        }
    }

    /**
     * ファイルを修正
     */
    async fixFile(issue) {
        let content = fs.readFileSync(issue.file, 'utf8');
        
        // Store IDを正しい値に置換
        const oldPattern = new RegExp(
            issue.context.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'g'
        );
        const newContext = issue.context.replace(issue.found, issue.expected);
        
        content = content.replace(oldPattern, newContext);
        
        fs.writeFileSync(issue.file, content, 'utf8');
        this.fixedCount++;
        
        console.log(`   ✅ 修正完了: ${issue.file}`);
    }

    /**
     * 行番号を取得
     */
    getLineNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }

    /**
     * サーバー側の正規化ロジックを確認
     */
    validateNormalization() {
        const serverFile = path.join(process.cwd(), 'server.js');
        
        if (!fs.existsSync(serverFile)) {
            console.log('⚠️  server.js が見つかりません');
            return false;
        }
        
        const content = fs.readFileSync(serverFile, 'utf8');
        
        // 正規化ロジックの存在を確認
        const hasNormalization = content.includes("store_id === 'default' ? 'default-store'");
        
        if (hasNormalization) {
            console.log('✅ サーバー側にStore ID正規化ロジックが存在します\n');
            return true;
        } else {
            console.log('⚠️  サーバー側にStore ID正規化ロジックがありません');
            console.log('   以下のコードを追加することを推奨:\n');
            console.log(this.getNormalizationCode());
            return false;
        }
    }

    /**
     * 推奨される正規化コード
     */
    getNormalizationCode() {
        return `
    // Store ID正規化（レガシー値との互換性維持）
    const normalizeStoreId = (storeId) => {
        if (!storeId) return 'default-store';
        return storeId === 'default' ? 'default-store' : storeId;
    };
    
    // フロントエンドとサーバーのStore IDを正規化
    const normalizedFrontendStoreId = normalizeStoreId(store_id);
    const normalizedServerStoreId = normalizeStoreId(storeId);
    
    // 正規化後の値で比較
    if (normalizedFrontendStoreId !== normalizedServerStoreId) {
        // エラー処理
    }`;
    }
}

// 実行
async function main() {
    const validator = new StoreIdValidator();
    const autoFix = process.argv.includes('--fix');
    
    console.log('====================================');
    console.log('  Store ID 整合性チェックツール');
    console.log('====================================\n');
    
    // Store ID設定を検査
    await validator.validateStoreIds();
    
    // 正規化ロジックを確認
    validator.validateNormalization();
    
    // 問題を修正
    await validator.fixIssues(autoFix);
    
    console.log('\n====================================');
    console.log('  チェック完了');
    console.log('====================================');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
});

// スクリプトを実行
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { StoreIdValidator };