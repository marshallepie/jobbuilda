# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set working directory to monorepo root
WORKDIR /app

# Copy entire monorepo
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build coordinator
RUN cd apps/coordinator && pnpm build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/coordinator/package.json ./apps/coordinator/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/apps/coordinator/dist ./apps/coordinator/dist

# Set working directory to coordinator
WORKDIR /app/apps/coordinator

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
