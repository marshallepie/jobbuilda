# Use single-stage build for monorepo with workspace dependencies
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory to monorepo root
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy TypeScript and Turbo config files
COPY tsconfig.base.json turbo.json ./

# Copy packages (shared dependencies)
COPY packages ./packages

# Copy coordinator app
COPY apps/coordinator ./apps/coordinator

# Install all dependencies with hoisting for better module resolution
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Build shared packages
# Clean and build contracts with explicit paths
RUN cd /app/packages/contracts && \
    echo "=== Building contracts package ===" && \
    rm -rf dist .tsbuildinfo && \
    echo "Running: pnpm run build" && \
    pnpm run build && \
    echo "=== Build complete. Checking output ===" && \
    ls -la dist/ && \
    echo "=== Checking .d.ts files ===" && \
    ls -la dist/*.d.ts && \
    echo "=== Checking subdirectories ===" && \
    find dist/ -type f

# Build mcp-sdk
RUN cd /app/packages/mcp-sdk && \
    echo "=== Building mcp-sdk package ===" && \
    rm -rf dist .tsbuildinfo && \
    pnpm run build && \
    echo "=== mcp-sdk build complete ===" && \
    ls -la dist/

# Set working directory to coordinator
WORKDIR /app/apps/coordinator

# Expose port
EXPOSE 3000

# Run coordinator with tsx (packages are now built)
CMD ["npx", "tsx", "src/index.ts"]
