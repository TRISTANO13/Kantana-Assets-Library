# Backend service Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

# Install production dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY server/. ./

ENV NODE_ENV=production

EXPOSE 5174

CMD ["npm", "run", "start"]
