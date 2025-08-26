#!/bin/bash

# LINE予約システム マルチテナント デプロイスクリプト
# 使用方法: ./deploy.sh [tenant-name] [environment]
# 例: ./deploy.sh tenant-a production
#     ./deploy.sh all staging

set -e

# カラー出力の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
TENANT=${1:-all}
ENVIRONMENT=${2:-production}
DOCKER_COMPOSE_FILE="docker-compose.yml"

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# バナー表示
show_banner() {
    echo "=================================================="
    echo "   LINE予約システム マルチテナント デプロイ"
    echo "=================================================="
    echo "テナント: $TENANT"
    echo "環境: $ENVIRONMENT"
    echo "=================================================="
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # Docker チェック
    if ! command -v docker &> /dev/null; then
        log_error "Dockerがインストールされていません"
        exit 1
    fi
    
    # Docker Compose チェック
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Composeがインストールされていません"
        exit 1
    fi
    
    # 環境変数ファイルチェック
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        log_error ".env.$ENVIRONMENT ファイルが見つかりません"
        exit 1
    fi
    
    log_info "前提条件チェック完了 ✓"
}

# 環境変数のセットアップ
setup_environment() {
    log_info "環境変数をセットアップ中..."
    
    # 環境別の.envファイルをコピー
    cp ".env.$ENVIRONMENT" .env
    
    # 環境変数の検証
    required_vars=""
    if [ "$TENANT" != "all" ]; then
        tenant_upper=$(echo "$TENANT" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
        required_vars="${tenant_upper}_CHANNEL_ACCESS_TOKEN ${tenant_upper}_CHANNEL_SECRET"
    else
        required_vars="TENANT_A_CHANNEL_ACCESS_TOKEN TENANT_A_CHANNEL_SECRET TENANT_B_CHANNEL_ACCESS_TOKEN TENANT_B_CHANNEL_SECRET"
    fi
    
    for var in $required_vars; do
        if ! grep -q "^$var=" .env; then
            log_warn "環境変数 $var が設定されていません"
        fi
    done
    
    log_info "環境変数セットアップ完了 ✓"
}

# Dockerイメージのビルド
build_images() {
    log_info "Dockerイメージをビルド中..."
    
    if [ "$TENANT" == "all" ]; then
        docker-compose build --parallel
    else
        docker-compose build "$TENANT"
    fi
    
    log_info "Dockerイメージビルド完了 ✓"
}

# コンテナのデプロイ
deploy_containers() {
    log_info "コンテナをデプロイ中..."
    
    if [ "$TENANT" == "all" ]; then
        # すべてのテナントをデプロイ
        docker-compose down
        docker-compose up -d
    else
        # 特定のテナントのみデプロイ（他のテナントに影響なし）
        docker-compose stop "$TENANT"
        docker-compose rm -f "$TENANT"
        docker-compose up -d "$TENANT"
    fi
    
    log_info "コンテナデプロイ完了 ✓"
}

# ヘルスチェック
health_check() {
    log_info "ヘルスチェック実行中..."
    
    # 起動待機
    sleep 10
    
    success=true
    
    if [ "$TENANT" == "all" ]; then
        services="tenant-a tenant-b tenant-c nginx"
    else
        services="$TENANT"
    fi
    
    for service in $services; do
        if docker-compose ps | grep -q "$service.*Up"; then
            log_info "✓ $service は正常に稼働しています"
            
            # APIヘルスチェック
            port=""
            case $service in
                tenant-a) port=3001 ;;
                tenant-b) port=3002 ;;
                tenant-c) port=3003 ;;
                nginx) port=80 ;;
            esac
            
            if [ -n "$port" ] && [ "$service" != "nginx" ]; then
                if curl -f "http://localhost:$port/health" &>/dev/null; then
                    log_info "  └─ APIヘルスチェック: OK"
                else
                    log_warn "  └─ APIヘルスチェック: 失敗"
                fi
            fi
        else
            log_error "✗ $service の起動に失敗しました"
            success=false
        fi
    done
    
    if [ "$success" = false ]; then
        log_error "デプロイに失敗しました"
        exit 1
    fi
    
    log_info "ヘルスチェック完了 ✓"
}

# ログ表示
show_logs() {
    log_info "最新のログ:"
    
    if [ "$TENANT" == "all" ]; then
        docker-compose logs --tail=20
    else
        docker-compose logs --tail=20 "$TENANT"
    fi
}

# デプロイ情報の表示
show_deployment_info() {
    echo ""
    echo "=================================================="
    echo "   デプロイ完了！"
    echo "=================================================="
    
    if [ "$TENANT" == "all" ]; then
        echo "Webhook URLs:"
        echo "  Tenant A: https://app.yourdomain.com/tenant-a/webhook"
        echo "  Tenant B: https://app.yourdomain.com/tenant-b/webhook"
        echo "  Tenant C: https://app.yourdomain.com/tenant-c/webhook"
        echo ""
        echo "管理画面:"
        echo "  Tenant A: http://localhost:3001/admin"
        echo "  Tenant B: http://localhost:3002/admin"
        echo "  Tenant C: http://localhost:3003/admin"
    else
        case $TENANT in
            tenant-a)
                echo "Webhook URL: https://app.yourdomain.com/tenant-a/webhook"
                echo "管理画面: http://localhost:3001/admin"
                ;;
            tenant-b)
                echo "Webhook URL: https://app.yourdomain.com/tenant-b/webhook"
                echo "管理画面: http://localhost:3002/admin"
                ;;
            tenant-c)
                echo "Webhook URL: https://app.yourdomain.com/tenant-c/webhook"
                echo "管理画面: http://localhost:3003/admin"
                ;;
        esac
    fi
    
    echo "=================================================="
}

# メイン処理
main() {
    show_banner
    check_prerequisites
    setup_environment
    build_images
    deploy_containers
    health_check
    show_logs
    show_deployment_info
}

# エラーハンドリング
trap 'log_error "エラーが発生しました。デプロイを中断します。"' ERR

# 実行
main