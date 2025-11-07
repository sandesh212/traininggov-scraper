import puppeteer, { Browser, Page } from "puppeteer";
import { sleep } from "./utils/requestUtils.js";

export type FetcherOptions = {
  minDelayMs?: number;
  headless?: boolean;
  timeout?: number;
};

export class Fetcher {
  private lastRequestAt = 0;
  private minDelayMs: number;
  private headless: boolean;
  private timeout: number;
  private browser: Browser | null = null;

  constructor(opts?: FetcherOptions) {
    this.minDelayMs = opts?.minDelayMs ?? 2000;
    this.headless = opts?.headless ?? true;
    this.timeout = opts?.timeout ?? 30000;
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log("[Fetcher] Launching browser...");
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      console.log("[Fetcher] Browser launched");
    }
    return this.browser;
  }

  private async ensurePoliteDelay() {
    const since = Date.now() - this.lastRequestAt;
    const wait = Math.max(0, this.minDelayMs - since);
    if (wait > 0) await sleep(wait);
  }

  async get(url: string): Promise<string> {
    await this.ensurePoliteDelay();
    console.log(`[Fetcher] Requesting: ${url}`);

    const browser = await this.ensureBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: this.timeout
      });

      // Wait for Vue/Nuxt to render content
      console.log("[Fetcher] Waiting for content to render...");
      await page.waitForSelector("h1", { timeout: 10000 }).catch(() => {
        console.log("[Fetcher] Warning: h1 not found, continuing anyway");
      });

      // Extra wait for dynamic content
      await sleep(2000);

      const html = await page.content();
      console.log(`[Fetcher] Success: ${url} (${html.length} bytes rendered)`);

      this.lastRequestAt = Date.now();
      return html;
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      console.log("[Fetcher] Closing browser...");
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default Fetcher;