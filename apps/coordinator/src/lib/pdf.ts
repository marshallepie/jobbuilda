import puppeteer, { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

let browser: Browser | null = null;

/**
 * Find the Chrome/Chromium executable.
 * Priority: PUPPETEER_EXECUTABLE_PATH env var → known fixed paths
 * → PATH lookup → puppeteer's own Chrome (local dev).
 */
function findExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Check fixed paths first (apt-installed chromium has predictable paths)
  const fixedPaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  for (const p of fixedPaths) {
    if (existsSync(p)) {
      console.log(`[pdf] Using system Chrome at ${p}`);
      return p;
    }
  }

  // Fall back to PATH discovery
  for (const cmd of ['chromium-browser', 'chromium', 'google-chrome-stable', 'google-chrome']) {
    try {
      const p = execSync(`which ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (p) {
        console.log(`[pdf] Found Chrome via PATH: ${p}`);
        return p;
      }
    } catch { /* not found */ }
  }

  // Fall back to puppeteer's own Chrome (local dev)
  console.log('[pdf] No system Chrome found, using puppeteer default');
  return undefined;
}

/**
 * Get or create a Puppeteer browser instance.
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    const executablePath = findExecutablePath();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    });
  }
  return browser;
}

/**
 * Trigger browser launch at server startup so the first PDF request
 * doesn't pay the startup cost.
 */
export async function warmUpBrowser(): Promise<void> {
  console.log('[pdf] Warming up browser…');
  await getBrowser();
  console.log('[pdf] Browser ready');
}

/**
 * Generate a PDF from HTML content
 */
export async function generatePDFFromHTML(html: string, options: {
  format?: 'A4' | 'Letter';
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
} = {}): Promise<Buffer> {
  const browserInstance = await getBrowser();
  const page: Page = await browserInstance.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate || '',
      footerTemplate: options.footerTemplate || '',
      printBackground: options.printBackground ?? true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * Generate a PDF by rendering a URL
 */
export async function generatePDFFromURL(url: string, options: {
  format?: 'A4' | 'Letter';
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  waitForSelector?: string;
  timeout?: number;
} = {}): Promise<Buffer> {
  const browserInstance = await getBrowser();
  const page: Page = await browserInstance.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: options.timeout || 30000,
    });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 30000,
      });
    }

    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/**
 * Close the browser instance (call on server shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
