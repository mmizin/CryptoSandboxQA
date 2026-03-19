# ========== Build stage ==========
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build application
COPY . .
RUN npm run build

# ========== Runtime stage ==========
FROM node:20-alpine AS runtime

# Create non-root user and add curl for healthcheck
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    apk add --no-cache curl

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# Copy built output from builder
COPY --from=builder /app/dist ./dist

USER nestjs

# Port configurable via env
ENV NODE_ENV=production
EXPOSE 3001

# Wait for DB, apply schema, then start
CMD ["sh", "-c", "until npx prisma db push 2>/dev/null; do echo 'Waiting for database...'; sleep 2; done && node dist/main.js"]
