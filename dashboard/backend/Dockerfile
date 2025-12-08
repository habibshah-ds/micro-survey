# ============================================
# Multi-stage Dockerfile for production
# ============================================
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache postgresql-client wget

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Development stage
FROM base AS dev
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS prod
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -f .env
EXPOSE 5000
USER node
CMD ["npm", "start"]
