# UPDATED FOR DEPLOYMENT PREP

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy production dependencies from build stage
COPY --from=build /app/node_modules ./node_modules
COPY . .

# Environment Defaults
ENV NODE_ENV=production
ENV PORT=5000

# Expose the API port
EXPOSE 5000

# Health Check (Docker level)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/v1/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"

# Run the server
CMD ["node", "server.js"]
