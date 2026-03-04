#!/bin/sh
# Ensure Chrome is present before starting the server.
# Normally Chrome is baked into the Docker image by the build phase.
# This check is a fallback in case the Docker layer was cached without Chrome.

CHROME_PATH=$(node -e "try { process.stdout.write(require('puppeteer').executablePath()) } catch(e) { process.exit(1) }" 2>/dev/null)

if [ $? -ne 0 ] || [ ! -f "$CHROME_PATH" ]; then
  echo "[start] Chrome not found — downloading now (~170 MB, may take a few minutes)..."
  node node_modules/puppeteer/lib/cjs/puppeteer/node/cli.js browsers install chrome
  echo "[start] Chrome installed."
else
  echo "[start] Chrome ready at $CHROME_PATH"
fi

exec node dist/index.js
