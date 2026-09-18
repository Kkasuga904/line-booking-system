FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server_cjs_min.js ./
COPY public/ /app/public/

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server_cjs_min.js"]
