/**
 * LIFF関連の問題を防ぐためのスクリプト
 * デプロイ前に実行して設定を検証
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class LIFFPreventionChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.fixes = [];
  }

  /**
   * すべてのチェックを実行
   */
  async runAllChecks() {
    console.log('🔍 LIFF設定チェック開始...\n');

    // 1. 環境変数チェック
    this.checkEnvironmentVariables();

    // 2. ファイル存在チェック
    this.checkRequiredFiles();

    // 3. コード内のLIFF設定チェック
    this.checkCodeConfiguration();

    // 4. Dockerfile設定チェック
    this.checkDockerConfiguration();

    // 5. URL形式チェック
    this.checkUrlFormats();

    // 結果表示
    this.displayResults();

    // 自動修正の提案
    if (this.fixes.length > 0) {
      this.suggestFixes();
    }

    return this.errors.length === 0;
  }

  /**
   * 環境変数チェック
   */
  checkEnvironmentVariables() {
    console.log('📋 環境変数チェック...');

    // .env.yamlチェック
    const envPath = path.join(process.cwd(), '.env.yaml');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      if (!envContent.includes('LIFF_ID:')) {
        this.errors.push('LIFF_IDが.env.yamlに設定されていません');
        this.fixes.push({
          file: '.env.yaml',
          action: 'LIFF_ID: "YOUR_LIFF_ID" を追加'
        });
      }

      if (!envContent.includes('BASE_URL:')) {
        this.warnings.push('BASE_URLが設定されていません');
        this.fixes.push({
          file: '.env.yaml',
          action: 'BASE_URL: "https://your-domain.run.app" を追加'
        });
      }
    } else {
      this.errors.push('.env.yamlファイルが存在しません');
    }

    console.log('✅ 環境変数チェック完了\n');
  }

  /**
   * 必要なファイルの存在チェック
   */
  checkRequiredFiles() {
    console.log('📁 ファイル存在チェック...');

    const requiredFiles = [
      'public/liff-calendar.html',
      'server.js',
      'Dockerfile'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`必須ファイルが見つかりません: ${file}`);
      }
    });

    console.log('✅ ファイル存在チェック完了\n');
  }

  /**
   * コード設定チェック
   */
  checkCodeConfiguration() {
    console.log('💻 コード設定チェック...');

    // server.jsチェック
    const serverPath = path.join(process.cwd(), 'server.js');
    if (fs.existsSync(serverPath)) {
      const serverContent = fs.readFileSync(serverPath, 'utf8');

      // 静的ファイル配信設定チェック
      if (!serverContent.includes("express.static") || !serverContent.includes("'public'")) {
        this.errors.push('server.jsに静的ファイル配信設定がありません');
        this.fixes.push({
          file: 'server.js',
          action: "app.use(express.static(path.join(__dirname, 'public'))); を追加"
        });
      }

      // LIFF URLの形式チェック（古い形式を検出）
      if (serverContent.includes('https://line.me/R/app/')) {
        this.errors.push('古いLIFF URL形式が使用されています');
        this.fixes.push({
          file: 'server.js',
          action: 'https://line.me/R/app/ を https://liff.line.me/ に変更'
        });
      }

      // Flex Messageの実装チェック
      if (!serverContent.includes('type: \'flex\'')) {
        this.warnings.push('Flex Messageが実装されていません（テキストのみの返信）');
      }
    }

    // liff-calendar.htmlチェック
    const liffPath = path.join(process.cwd(), 'public/liff-calendar.html');
    if (fs.existsSync(liffPath)) {
      const liffContent = fs.readFileSync(liffPath, 'utf8');

      // LIFF SDK読み込みチェック
      if (!liffContent.includes('https://static.line-scdn.net/liff/edge/2/sdk.js')) {
        this.errors.push('LIFF SDKが読み込まれていません');
        this.fixes.push({
          file: 'public/liff-calendar.html',
          action: '<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script> を追加'
        });
      }

      // LIFF初期化チェック
      if (!liffContent.includes('liff.init')) {
        this.errors.push('LIFF初期化コードがありません');
      }

      // ハードコードされたLIFF IDチェック
      const liffIdMatch = liffContent.match(/['"](\d{10}-[a-zA-Z0-9]+)['"]/);
      if (liffIdMatch && liffIdMatch[1] !== process.env.LIFF_ID) {
        this.warnings.push(`ハードコードされたLIFF ID: ${liffIdMatch[1]}`);
      }
    }

    console.log('✅ コード設定チェック完了\n');
  }

  /**
   * Docker設定チェック
   */
  checkDockerConfiguration() {
    console.log('🐳 Docker設定チェック...');

    // .dockerignoreチェック
    const dockerignorePath = path.join(process.cwd(), '.dockerignore');
    if (fs.existsSync(dockerignorePath)) {
      const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf8');
      
      if (dockerignoreContent.includes('public/') || dockerignoreContent.includes('public')) {
        this.errors.push('publicフォルダが.dockerignoreに含まれています');
        this.fixes.push({
          file: '.dockerignore',
          action: 'publicフォルダの除外を削除'
        });
      }
    }

    // Dockerfileチェック
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
      
      if (!dockerfileContent.includes('COPY . .') && !dockerfileContent.includes('COPY public')) {
        this.errors.push('Dockerfileでpublicフォルダがコピーされていません');
        this.fixes.push({
          file: 'Dockerfile',
          action: 'COPY . . または COPY public ./public を追加'
        });
      }
    }

    console.log('✅ Docker設定チェック完了\n');
  }

  /**
   * URL形式チェック
   */
  checkUrlFormats() {
    console.log('🔗 URL形式チェック...');

    // よくある間違いパターンをチェック
    const commonMistakes = [
      {
        pattern: /\/liff-calendar(?!\.html)/g,
        message: 'LIFFページURLに.html拡張子がありません',
        fix: '/liff-calendar を /liff-calendar.html に変更'
      },
      {
        pattern: /line\.me\/R\/app/g,
        message: '古いLIFF URL形式が使用されています',
        fix: 'https://line.me/R/app/ を https://liff.line.me/ に変更'
      }
    ];

    const filesToCheck = [
      'server.js',
      'public/index.html',
      'README.md'
    ];

    filesToCheck.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        commonMistakes.forEach(mistake => {
          if (mistake.pattern.test(content)) {
            this.warnings.push(`${file}: ${mistake.message}`);
            this.fixes.push({
              file: file,
              action: mistake.fix
            });
          }
        });
      }
    });

    console.log('✅ URL形式チェック完了\n');
  }

  /**
   * 結果表示
   */
  displayResults() {
    console.log('=' * 50);
    console.log('📊 チェック結果サマリー');
    console.log('=' * 50);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 すべてのチェックをパスしました！');
      return;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ エラー（修正必須）:');
      this.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告（確認推奨）:');
      this.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }
  }

  /**
   * 修正提案
   */
  suggestFixes() {
    console.log('\n💡 推奨される修正:');
    console.log('=' * 50);

    const fixesByFile = {};
    this.fixes.forEach(fix => {
      if (!fixesByFile[fix.file]) {
        fixesByFile[fix.file] = [];
      }
      fixesByFile[fix.file].push(fix.action);
    });

    Object.keys(fixesByFile).forEach(file => {
      console.log(`\n📄 ${file}:`);
      fixesByFile[file].forEach((action, i) => {
        console.log(`   ${i + 1}. ${action}`);
      });
    });

    console.log('\n実行コマンド例:');
    console.log('  node scripts/prevent-liff-issues.js');
  }
}

// スクリプト実行
if (require.main === module) {
  const checker = new LIFFPreventionChecker();
  checker.runAllChecks().then(success => {
    if (!success) {
      console.log('\n⚠️  修正が必要な項目があります。上記の提案を確認してください。');
      process.exit(1);
    }
    console.log('\n✅ デプロイ準備完了！');
    process.exit(0);
  });
}

module.exports = LIFFPreventionChecker;