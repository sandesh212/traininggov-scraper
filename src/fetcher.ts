import puppeteer, { Browser } from "puppeteer";
import { sleep } from "./utils/requestUtils.js";
import { logger, classifyError } from './utils/logger.js';

export type FetcherOptions = {
  minDelayMs?: number;
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
  backoffMs?: number; // base backoff
};

export class Fetcher {
  private lastRequestAt = 0;
  private minDelayMs: number;
  private headless: boolean;
  private timeout: number;
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private launching = false;
  private maxRetries: number;
  private backoffMs: number;

  constructor(opts?: FetcherOptions) {
    this.minDelayMs = opts?.minDelayMs ?? 1500;
    this.headless = opts?.headless ?? true;
    this.timeout = opts?.timeout ?? 30000;
    this.maxRetries = opts?.maxRetries ?? 3;
    this.backoffMs = opts?.backoffMs ?? 750;
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (this.browserPromise) return this.browserPromise;
    if (this.launching) {
      // Wait briefly for initial launch to set browserPromise
      while (!this.browserPromise) {
        await sleep(25);
      }
      return this.browserPromise;
    }
    this.launching = true;
  logger.debug('Launching browser');
    this.browserPromise = puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    }).then(b => {
      this.browser = b;
      this.launching = false;
  logger.debug('Browser launched');
      return b;
    });
    return this.browserPromise;
  }

  private async ensurePoliteDelay() {
    const since = Date.now() - this.lastRequestAt;
    const wait = Math.max(0, this.minDelayMs - since);
    if (wait > 0) await sleep(wait);
  }

  async get(url: string): Promise<string> {
    await this.ensurePoliteDelay();
    const browser = await this.ensureBrowser();
    let attempt = 0;
    let lastErr: any;
    while (attempt < this.maxRetries) {
      attempt++;
      const page = await browser.newPage();
      const start = Date.now();
      try {
        if (attempt > 1) logger.info(`Retry ${attempt}/${this.maxRetries} ${url}`); else logger.debug(`GET ${url}`);
        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );
        await page.goto(url, { waitUntil: "networkidle2", timeout: this.timeout });
        // Render wait
        await page.waitForSelector("h1", { timeout: 8000 }).catch(() => {
          // continue – some pages may lack h1 but still contain data
        });
        await sleep(1000); // shorter settle time
  const html = await page.content();
  const duration = Date.now() - start;
  logger.debug(`OK ${url} ${html.length} bytes in ${duration}ms`);
        this.lastRequestAt = Date.now();
        await page.close();
        return html;
      } catch (err: any) {
        lastErr = err;
        const duration = Date.now() - start;
        logger.warn(`Fetch error attempt ${attempt} ${url} (${duration}ms)`, err?.message || err);
        await page.close();
        if (attempt < this.maxRetries) {
          const backoff = this.backoffMs * attempt;
          await sleep(backoff);
        }
      }
    }
    // Final failure
    const errMsg = lastErr?.message || String(lastErr) || 'Unknown error';
    const type = classifyError(lastErr);
    throw new Error(`FetchFailed:${type}:${errMsg}`);
  }

  async close() {
    if (this.browser) {
      logger.debug('Closing browser');
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default Fetcher;