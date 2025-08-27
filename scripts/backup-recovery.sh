#!/bin/bash

# =====================================
# バックアップ＆リカバリースクリプト
# =====================================

set -euo pipefail

# 設定
BACKUP_DIR="/backups"
RETENTION_DAYS=30
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# =====================================
# バックアップ機能
# =====================================

backup_database() {
    log_info "Starting database backup..."
    
    # Supabase バックアップAPI呼び出し
    BACKUP_RESPONSE=$(curl -s -X POST \
        "${SUPABASE_URL}/backup/create" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"name": "scheduled_backup_'${TIMESTAMP}'"}')
    
    if [[ $? -eq 0 ]]; then
        log_info "Database backup initiated successfully"
        echo "${BACKUP_RESPONSE}" > "${BACKUP_DIR}/db_backup_${TIMESTAMP}.json"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

backup_environment() {
    log_info "Backing up environment variables..."
    
    # Vercel環境変数のエクスポート
    vercel env pull "${BACKUP_DIR}/env_backup_${TIMESTAMP}.env" --yes
    
    # 暗号化
    openssl enc -aes-256-cbc -salt -in "${BACKUP_DIR}/env_backup_${TIMESTAMP}.env" \
        -out "${BACKUP_DIR}/env_backup_${TIMESTAMP}.env.enc" \
        -pass pass:"${ENCRYPTION_KEY}"
    
    # 元ファイル削除
    rm "${BACKUP_DIR}/env_backup_${TIMESTAMP}.env"
    
    log_info "Environment variables backed up and encrypted"
}

backup_code() {
    log_info "Backing up code repository..."
    
    # Gitリポジトリのバックアップ
    git bundle create "${BACKUP_DIR}/code_backup_${TIMESTAMP}.bundle" --all
    
    # 圧縮
    tar -czf "${BACKUP_DIR}/code_backup_${TIMESTAMP}.tar.gz" \
        "${BACKUP_DIR}/code_backup_${TIMESTAMP}.bundle"
    
    rm "${BACKUP_DIR}/code_backup_${TIMESTAMP}.bundle"
    
    log_info "Code repository backed up"
}

backup_logs() {
    log_info "Backing up application logs..."
    
    # Vercelログの取得
    vercel logs --output "${BACKUP_DIR}/logs_${TIMESTAMP}.txt"
    
    # 圧縮
    gzip "${BACKUP_DIR}/logs_${TIMESTAMP}.txt"
    
    log_info "Logs backed up"
}

# =====================================
# リカバリー機能
# =====================================

restore_database() {
    local BACKUP_FILE=$1
    log_warning "Starting database restoration from ${BACKUP_FILE}..."
    
    # 確認プロンプト
    read -p "This will overwrite current database. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restoration cancelled"
        return
    fi
    
    # Supabase リストアAPI呼び出し
    curl -X POST \
        "${SUPABASE_URL}/backup/restore" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "@${BACKUP_FILE}"
    
    log_info "Database restoration completed"
}

restore_environment() {
    local BACKUP_FILE=$1
    log_warning "Restoring environment variables from ${BACKUP_FILE}..."
    
    # 復号化
    openssl enc -aes-256-cbc -d -in "${BACKUP_FILE}" \
        -out "${BACKUP_DIR}/temp_env.env" \
        -pass pass:"${ENCRYPTION_KEY}"
    
    # 環境変数の復元
    while IFS= read -r line; do
        if [[ ! -z "$line" && ! "$line" =~ ^# ]]; then
            KEY=$(echo "$line" | cut -d'=' -f1)
            VALUE=$(echo "$line" | cut -d'=' -f2-)
            vercel env add "${KEY}" production <<< "${VALUE}"
        fi
    done < "${BACKUP_DIR}/temp_env.env"
    
    rm "${BACKUP_DIR}/temp_env.env"
    
    log_info "Environment variables restored"
}

restore_code() {
    local BACKUP_FILE=$1
    log_warning "Restoring code from ${BACKUP_FILE}..."
    
    # 解凍
    tar -xzf "${BACKUP_FILE}" -C "${BACKUP_DIR}"
    
    # Gitバンドルから復元
    BUNDLE_FILE="${BACKUP_DIR}/$(basename ${BACKUP_FILE} .tar.gz).bundle"
    git clone "${BUNDLE_FILE}" restore_temp
    
    log_info "Code restored to ./restore_temp directory"
}

# =====================================
# クリーンアップ機能
# =====================================

cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    # 古いバックアップを削除
    find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete
    
    log_info "Cleanup completed"
}

# =====================================
# ヘルスチェック
# =====================================

verify_backup() {
    local BACKUP_FILE=$1
    log_info "Verifying backup integrity..."
    
    # ファイルサイズチェック
    if [[ ! -s "${BACKUP_FILE}" ]]; then
        log_error "Backup file is empty"
        return 1
    fi
    
    # チェックサム検証
    if [[ -f "${BACKUP_FILE}.sha256" ]]; then
        sha256sum -c "${BACKUP_FILE}.sha256"
        if [[ $? -eq 0 ]]; then
            log_info "Backup integrity verified"
        else
            log_error "Backup integrity check failed"
            return 1
        fi
    fi
    
    return 0
}

# =====================================
# 災害復旧プラン
# =====================================

disaster_recovery() {
    log_warning "Starting disaster recovery procedure..."
    
    # 最新のバックアップを検索
    LATEST_DB_BACKUP=$(ls -t "${BACKUP_DIR}"/db_backup_*.json 2>/dev/null | head -1)
    LATEST_ENV_BACKUP=$(ls -t "${BACKUP_DIR}"/env_backup_*.env.enc 2>/dev/null | head -1)
    LATEST_CODE_BACKUP=$(ls -t "${BACKUP_DIR}"/code_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [[ -z "${LATEST_DB_BACKUP}" ]]; then
        log_error "No database backup found"
        exit 1
    fi
    
    log_info "Found backups:"
    log_info "  Database: ${LATEST_DB_BACKUP}"
    log_info "  Environment: ${LATEST_ENV_BACKUP}"
    log_info "  Code: ${LATEST_CODE_BACKUP}"
    
    # 復旧実行
    restore_database "${LATEST_DB_BACKUP}"
    
    if [[ ! -z "${LATEST_ENV_BACKUP}" ]]; then
        restore_environment "${LATEST_ENV_BACKUP}"
    fi
    
    if [[ ! -z "${LATEST_CODE_BACKUP}" ]]; then
        restore_code "${LATEST_CODE_BACKUP}"
    fi
    
    # デプロイ
    log_info "Deploying recovered application..."
    vercel --prod
    
    # ヘルスチェック
    sleep 30
    HEALTH_CHECK=$(curl -s https://line-booking-system-seven.vercel.app/api/webhook | jq -r '.status')
    
    if [[ "${HEALTH_CHECK}" == "healthy" ]]; then
        log_info "Disaster recovery completed successfully!"
    else
        log_error "Application health check failed after recovery"
        exit 1
    fi
}

# =====================================
# メイン処理
# =====================================

main() {
    # ディレクトリ作成
    mkdir -p "${BACKUP_DIR}"
    
    case "${1:-}" in
        backup)
            backup_database
            backup_environment
            backup_code
            backup_logs
            cleanup_old_backups
            log_info "Backup completed successfully"
            ;;
        restore)
            if [[ -z "${2:-}" ]]; then
                log_error "Please specify backup file"
                exit 1
            fi
            restore_database "$2"
            ;;
        disaster-recovery)
            disaster_recovery
            ;;
        verify)
            if [[ -z "${2:-}" ]]; then
                log_error "Please specify backup file to verify"
                exit 1
            fi
            verify_backup "$2"
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {backup|restore <file>|disaster-recovery|verify <file>|cleanup}"
            exit 1
            ;;
    esac
}

main "$@"