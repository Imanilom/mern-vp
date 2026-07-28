# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install system dependencies required for 'canvas' module and node-gyp
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev libjpeg-turbo-dev giflib-dev

# Install ONLY production dependencies for lean final image
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install runtime libraries required by 'canvas' native module
RUN apk add --no-cache pixman cairo pango libjpeg-turbo giflib

WORKDIR /app

# Create non-root user for least-privilege execution
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy node_modules from builder (already built native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Remove sensitive files that should never be in the image
RUN rm -f .env .env.* && \
    rm -rf dump/ tests/ seed.js seed_dump.js migrate-db.js

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set production environment
ENV NODE_ENV=production

# Expose API port
EXPOSE 3030

# Health check for Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3030/api/health || exit 1

# Start command
CMD ["node", "--max-old-space-size=4096", "index.js"]
