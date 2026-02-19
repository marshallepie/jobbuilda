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

# Build shared packages - use WORKDIR instead of cd
WORKDIR /app/packages/contracts
RUN echo "=== Building contracts package ===" && \
    echo "Current directory: $(pwd)" && \
    echo "Checking tsconfig:" && \
    ls -la tsconfig.json && \
    rm -rf dist .tsbuildinfo && \
    echo "Running: npx tsc --version" && \
    npx tsc --version && \
    echo "Running: pnpm run build with full output" && \
    pnpm run build 2>&1 | tee build.log && \
    echo "=== Build exit code: $? ===" && \
    echo "=== Build output: ===" && \
    cat build.log && \
    echo "=== Checking current directory contents ===" && \
    ls -la && \
    echo "=== Contents of dist (if exists) ===" && \
    (ls -laR dist/ || echo "dist directory not found")

# Build mcp-sdk
WORKDIR /app/packages/mcp-sdk
RUN echo "=== Building mcp-sdk package ===" && \
    rm -rf dist .tsbuildinfo && \
    pnpm run build 2>&1 && \
    (ls -laR dist/ || echo "dist directory not found")

# Set working directory to coordinator
WORKDIR /app/apps/coordinator

# Expose port
EXPOSE 3000

# Run coordinator with tsx (packages are now built)
CMD ["npx", "tsx", "src/index.ts"]
