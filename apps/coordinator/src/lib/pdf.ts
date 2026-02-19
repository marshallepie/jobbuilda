import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;

/**
 * Get or create a Puppeteer browser instance
 * Reuses the same browser instance for better performance
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
    // Set content and wait for it to load
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Generate PDF
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
    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: options.timeout || 30000,
    });

    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 30000,
      });
    }

    // Generate PDF
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
