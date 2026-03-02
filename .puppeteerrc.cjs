const { join } = require('path');

/**
 * Puppeteer config: store the Chrome binary inside the project directory
 * so it survives Railway's build → runtime handoff (which drops /root/.cache).
 */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
