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

# Copy MCP services
COPY services ./services

# Copy coordinator app
COPY apps/coordinator ./apps/coordinator

# Install all dependencies with hoisting for better module resolution
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Build shared packages - use WORKDIR instead of cd
WORKDIR /app/packages/contracts
RUN echo "=== Building contracts package ===" && \
    rm -rf dist *.tsbuildinfo && \
    pnpm run build && \
    echo "=== Build complete. Listing output ===" && \
    ls -laR dist/

# Build mcp-sdk
WORKDIR /app/packages/mcp-sdk
RUN echo "=== Building mcp-sdk package ===" && \
    rm -rf dist *.tsbuildinfo && \
    pnpm run build && \
    echo "=== Build complete. Listing output ===" && \
    ls -laR dist/

# Build all MCP services
WORKDIR /app/services
RUN echo "=== Building all MCP services ===" && \
    for service in identity-mcp clients-mcp suppliers-mcp quoting-mcp jobs-mcp materials-mcp variations-mcp tests-mcp invoicing-mcp payments-mcp reporting-mcp; do \
      echo "Building $service..." && \
      cd /app/services/$service && \
      rm -rf dist *.tsbuildinfo && \
      pnpm run build; \
    done && \
    echo "=== All services built ==="

# Set working directory to coordinator
WORKDIR /app/apps/coordinator

# Expose port
EXPOSE 3000

# Run coordinator with tsx (packages are now built)
CMD ["npx", "tsx", "src/index.ts"]
