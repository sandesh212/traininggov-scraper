import { Fetcher } from "./fetcher.js";
import { parseUocHtml } from "./parsers/uocParser.js";
import { ExportService } from "./services/exportService.js";
import { sleep } from "./utils/requestUtils.js";
import { Uoc } from "./models/uoc.js";

export type CrawlerOptions = {
  concurrency?: number;
  onItem?: (item: Uoc) => void | Promise<void>;
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
          await sleep(500 + Math.round(Math.random() * 500));
        } catch (err: any) {
          console.error(`Failed: ${url}`, err?.message || err);
        }
      }
    };

    const workers = Array.from({ length: this.concurrency }, () => worker());
    await Promise.all(workers);

    // Close browser after all work done
    await this.fetcher.close();
  }
}