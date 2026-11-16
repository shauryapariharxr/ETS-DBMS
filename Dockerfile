# StagePass Express API — portable container image.
# Works on Render (Docker runtime), Railway, Fly.io, or any Docker host:
#   docker build -t stagepass-api .
#   docker run -p 4000:4000 \
#     -e DATABASE_URL="postgresql://user:pass@host:5432/stagepass" \
#     -e JWT_SECRET="change-me" \
#     -e FRONTEND_ORIGIN="https://your-frontend.example" \
#     stagepass-api

FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only — the API never needs the Next.js build tooling.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server ./server
COPY scripts ./scripts
COPY src/db ./src/db
COPY database ./database

# multer writes event banners here. Mount a volume and set UPLOAD_DIR to keep
# them across restarts (container filesystems are ephemeral).
RUN mkdir -p /app/server/uploads && chown -R node:node /app
USER node

EXPOSE 4000

# Uses the platform-injected PORT when present (Render/Railway set it).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

CMD ["node", "server/index.js"]
