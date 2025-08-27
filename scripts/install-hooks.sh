#!/bin/bash

# Pre-commit hooks インストールスクリプト

echo "================================"
echo "Pre-commit hooks セットアップ"
echo "================================"

# pre-commit のインストール確認
if ! command -v pre-commit &> /dev/null; then
    echo "pre-commit をインストールしています..."
    pip install pre-commit
fi

# gitleaks のインストール確認（Windows）
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    if ! command -v gitleaks &> /dev/null; then
        echo "gitleaks をインストールしています..."
        # Windowsの場合
        curl -sSfL https://github.com/zricethezav/gitleaks/releases/latest/download/gitleaks_windows_amd64.exe -o gitleaks.exe
        mkdir -p ~/bin
        mv gitleaks.exe ~/bin/
        export PATH=$PATH:~/bin
    fi
else
    # Linux/Mac の場合
    if ! command -v gitleaks &> /dev/null; then
        echo "gitleaks をインストールしています..."
        curl -sSfL https://raw.githubusercontent.com/zricethezav/gitleaks/master/scripts/install.sh | sh -s -- -b ~/bin
        export PATH=$PATH:~/bin
    fi
fi

# detect-secrets のインストール
if ! command -v detect-secrets &> /dev/null; then
    echo "detect-secrets をインストールしています..."
    pip install detect-secrets
fi

# スクリプトに実行権限を付与
chmod +x scripts/check-pii.sh

# pre-commit のインストール
echo "pre-commit hooks をインストールしています..."
pre-commit install

# .secrets.baseline の作成（初回のみ）
if [ ! -f .secrets.baseline ]; then
    echo "シークレットのベースラインを作成しています..."
    detect-secrets scan --baseline .secrets.baseline
fi

echo ""
echo "================================"
echo "✅ セットアップ完了！"
echo "================================"
echo ""
echo "以下のチェックが自動的に実行されます："
echo "  • 機密情報の検出（API keys, tokens, secrets）"
echo "  • 日本語個人情報のチェック"
echo "  • 環境変数ファイルのブロック"
echo "  • データベースファイルのブロック"
echo "  • ログファイルのブロック"
echo "  • 大きなファイルのチェック"
echo ""
echo "手動でチェックを実行する場合："
echo "  pre-commit run --all-files"
echo ""
echo "チェックをスキップしてコミットする場合："
echo "  git commit --no-verify"
echo ""