# Use Debian-based image — Alpine uses musl libc which is incompatible
# with Chromium binaries (puppeteer) that require glibc
FROM node:20-bookworm-slim

# Install Chromium system dependencies and pnpm
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
    libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 wget \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

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
