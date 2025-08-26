FROM node:18-alpine

# アプリケーションディレクトリの作成
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm ci --only=production

# アプリケーションソースをコピー
COPY . .

# データと設定用のディレクトリを作成
RUN mkdir -p /app/data /app/logs /app/config

# 非rootユーザーの作成と権限設定
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# ユーザーを切り替え
USER nodejs

# アプリケーションの起動
CMD ["node", "multi-tenant-server.js"]