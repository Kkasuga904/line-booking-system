FROM node:20-slim

WORKDIR /app

# Copy package files if they exist
COPY package*.json ./

# Initialize package.json if it doesn't exist and install dependencies
RUN if [ ! -f package.json ]; then npm init -y; fi && \
    npm install express @supabase/supabase-js

# Copy all public files and server code
COPY public ./public
COPY deploy.js ./server.js

# Set environment variable
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]