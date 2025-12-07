import { Fetcher } from "./fetcher.js";
import { parseUocHtml } from "./parsers/uocParser.js";
import { ExportService } from "./services/exportService.js";
import { sleep } from "./utils/requestUtils.js";
import { Uoc } from "./models/uoc.js";
import { logger, classifyError } from './utils/logger.js';

export type CrawlerOptions = {
  concurrency?: number;
  onItem?: (item: Uoc) => void | Promise<void>;
  forceRefresh?: boolean; // re-fetch even if cached JSON exists
};

export class Crawler {
  private fetcher: Fetcher;
  private exporter: ExportService;
  private concurrency: number;
  private onItem?: (item: Uoc) => void | Promise<void>;

  constructor(fetcher: Fetcher, exporter: ExportService, opts?: CrawlerOptions) {
    this.fetcher = fetcher;
    this.exporter = exporter;
    this.concurrency = Math.max(1, opts?.concurrency ?? 1);
    this.onItem = opts?.onItem;
  }

  async crawlUocUrls(urls: string[]) {
    await this.exporter.init();

    const queue = [...new Set(urls)];
    let idx = 0;
    let successes = 0;
    let failures: { url: string; code?: string; message: string }[] = [];
    const startAll = Date.now();

    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= queue.length) break;
        const url = queue[i];
        try {
          const html = await this.fetcher.get(url);
          const uoc = parseUocHtml(html, url);
          if (this.onItem) await this.onItem(uoc);
          await this.exporter.writeJsonl(uoc);
          successes++;
          // small jitter to avoid burst
          await sleep(300 + Math.round(Math.random() * 300));
        } catch (err: any) {
          const message = err?.message || String(err);
            const type = classifyError(err);
            logger.warn(`Fail ${type} ${url} -> ${message}`);
            failures.push({ url, message });
            await this.exporter.logError({ url, errorType: type, message, stack: err?.stack });
        }
      }
    };

    const workers = Array.from({ length: this.concurrency }, () => worker());
    await Promise.all(workers);

    // Close browser after all work done
    await this.fetcher.close();

    const totalMs = Date.now() - startAll;
    const avgMs = successes ? Math.round(totalMs / successes) : 0;
    logger.info(`Crawl Summary targets=${queue.length} ok=${successes} fail=${failures.length} totalMs=${totalMs} avgMs=${avgMs}`);
    if (failures.length) {
      failures.slice(0, 10).forEach(f => logger.info(`Fail URL ${f.url} :: ${f.message}`));
      if (failures.length > 10) logger.info(`(and ${failures.length - 10} more failures)`);
    }
  }
}