import puppeteer, { Browser, Page } from 'puppeteer';
import { access } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

let browser: Browser | null = null;
let chromeEnsured = false;

/**
 * On Railway the build caches node_modules between deploys, so Puppeteer's
 * postinstall (which downloads Chrome) may not run on every deploy.
 * This function checks whether Chrome is present and installs it if not.
 */
async function ensureChrome(): Promise<void> {
  if (chromeEnsured) return;

  const execPath = puppeteer.executablePath();
  try {
    await access(execPath);
    chromeEnsured = true;
    return;
  } catch {
    console.log(`[pdf] Chrome not found at ${execPath} — downloading now (first run only)…`);
  }

  // Locate the puppeteer CLI JS file relative to the puppeteer package itself.
  // The .bin/puppeteer shim has hardcoded local dev paths, so call it directly.
  // __dirname = …/dist/lib at runtime; coordRoot = apps/coordinator root.
  const coordRoot = resolve(__dirname, '..', '..');
  const puppeteerCli = resolve(
    coordRoot,
    'node_modules', 'puppeteer', 'lib', 'cjs', 'puppeteer', 'node', 'cli.js'
  );

  try {
    await execFileAsync(
      process.execPath,           // use the same node binary that's running now
      [puppeteerCli, 'browsers', 'install', 'chrome'],
      { timeout: 300_000 }        // 5 min — first download is ~170 MB
    );
    console.log('[pdf] Chrome installed successfully');
    chromeEnsured = true;
  } catch (err: any) {
    console.error('[pdf] Chrome install failed:', err.message);
    // Continue anyway — launch() will surface a clear error if still missing
  }
}

/**
 * Get or create a Puppeteer browser instance.
 * Reuses the same browser instance for better performance.
 */
async function getBrowser(): Promise<Browser> {
  await ensureChrome();

  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
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
 * Trigger Chrome download + browser launch at server startup so the first
 * real PDF request doesn't have to wait for the download.
 */
export async function warmUpBrowser(): Promise<void> {
  console.log('[pdf] Warming up browser…');
  await getBrowser();
  console.log('[pdf] Browser ready');
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
