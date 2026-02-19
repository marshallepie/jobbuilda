# Use single-stage build for monorepo with workspace dependencies
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory to monorepo root
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy TypeScript config files
COPY tsconfig.base.json ./

# Copy packages (shared dependencies)
COPY packages ./packages

# Copy coordinator app
COPY apps/coordinator ./apps/coordinator

# Install all dependencies (needed for workspace packages)
RUN pnpm install --frozen-lockfile

# Build coordinator
RUN cd apps/coordinator && pnpm build

# Set working directory to coordinator
WORKDIR /app/apps/coordinator

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
