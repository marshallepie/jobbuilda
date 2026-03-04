#!/bin/sh
echo "[start] PWD=$(pwd)"
echo "[start] PUPPETEER_CACHE_DIR=$PUPPETEER_CACHE_DIR"

# Check Chrome path
CHROME_PATH=$(node -e "try { process.stdout.write(require('puppeteer').executablePath()) } catch(e) { process.stderr.write(e.message); process.exit(1) }" 2>/dev/null)
EC=$?

echo "[start] Expected Chrome path: $CHROME_PATH"

if [ $EC -ne 0 ] || [ ! -f "$CHROME_PATH" ]; then
  echo "[start] Chrome not found — downloading now (~170 MB, may take a few minutes)..."
  node node_modules/puppeteer/lib/cjs/puppeteer/node/cli.js browsers install chrome
  echo "[start] Chrome install complete."
else
  echo "[start] Chrome ready."
fi

exec node dist/index.js
