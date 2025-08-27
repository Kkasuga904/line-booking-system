#!/bin/bash

# 日本語個人情報チェックスクリプト
# Pre-commit hook で使用

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# チェック対象のパターン
PATTERNS=(
    "氏名"
    "名前"
    "住所"
    "電話番号"
    "メールアドレス"
    "生年月日"
    "マイナンバー"
    "クレジットカード"
    "口座番号"
    "免許証"
    "パスポート"
    "保険証"
    "店舗名"
    "企業名"
    "会社名"
    "ビジネス名"
    "サロン名"
    "レストラン"
    "美容室"
    "クリニック"
    "病院"
    "[0-9]{3}-?[0-9]{4}" # 郵便番号
    "0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{4}" # 電話番号
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" # メールアドレス
)

# 除外するファイル
EXCLUDE_PATTERNS=(
    "*.md"
    "*.test.js"
    "*.spec.js"
    "package.json"
    "package-lock.json"
)

# エラーフラグ
HAS_ERROR=0

echo -e "${GREEN}個人情報チェック開始...${NC}"

# 各ファイルをチェック
for file in "$@"; do
    # 除外ファイルかチェック
    should_skip=false
    for exclude in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$file" == $exclude ]]; then
            should_skip=true
            break
        fi
    done
    
    if [ "$should_skip" = true ]; then
        continue
    fi
    
    # バイナリファイルをスキップ
    if file "$file" | grep -q "binary"; then
        continue
    fi
    
    # 各パターンをチェック
    for pattern in "${PATTERNS[@]}"; do
        if grep -E "$pattern" "$file" > /dev/null 2>&1; then
            echo -e "${RED}警告: $file に個人情報の可能性があるパターンが見つかりました: $pattern${NC}"
            grep -n -E "$pattern" "$file" | head -5
            HAS_ERROR=1
        fi
    done
done

if [ $HAS_ERROR -eq 1 ]; then
    echo -e "${RED}個人情報の可能性があるデータが検出されました。${NC}"
    echo -e "${YELLOW}確認して問題なければ、--no-verify オプションでスキップできます。${NC}"
    exit 1
else
    echo -e "${GREEN}個人情報チェック完了 - 問題なし${NC}"
fi

exit 0