import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;

/**
 * Get or create a Puppeteer browser instance.
 * Chrome is guaranteed to be present by the build phase (nixpacks.toml)
 * and the start.sh fallback check.
 */
async function getBrowser(): Promise<Browser> {
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
