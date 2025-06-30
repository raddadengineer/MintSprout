# Multi-stage build for MintSprout
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 mintsprout

# Copy built application
COPY --from=builder --chown=mintsprout:nodejs /app/dist ./dist
COPY --from=builder --chown=mintsprout:nodejs /app/package*.json ./
COPY --from=deps --chown=mintsprout:nodejs /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV JWT_SECRET=your-production-jwt-secret-change-this

# Expose port
EXPOSE 5000

# Switch to non-root user
USER mintsprout

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/auth/me', (res) => { process.exit(res.statusCode === 401 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]