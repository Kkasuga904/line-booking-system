FROM node:20-slim

# 作業ディレクトリ設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係インストール（ciの代わりにinstallを使用）
RUN npm install --production

# アプリケーションコードをコピー
COPY . .

# ポートとNode環境設定
ENV PORT=8080 \
    NODE_ENV=production

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/ping', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

# 非rootユーザーで実行（セキュリティ）
USER node

# サーバー起動
CMD ["node", "server.js"]