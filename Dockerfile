# Production Dockerfile for Sampath's Studio
FROM node:20-bookworm-slim

# Install system dependencies (ffmpeg, python3, curl, ca-certificates, chromium) for audio streaming & scraping
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary for full-track audio stream resolution
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package manifests
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN cd backend && npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

# Copy application source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend assets and backend server
RUN cd frontend && npm run build
RUN cd backend && npm run build

# Create audio cache and data folders
RUN mkdir -p /app/backend/cache/audio /app/backend/data

ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
