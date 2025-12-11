import { load } from 'cheerio';
import { Unit } from '../types';
import puppeteer, { Browser } from 'puppeteer';
import { logger } from '@/utils/logger';
import { parseUocHtml } from './uocParser';
import { UnitMapper } from '@/utils/unitMapper';

export class ScraperService {
    private baseUrl = 'https://training.gov.au/Training/Details';
    private browser: Browser | null = null;

    // Shared browser instance across all scrapers for better performance
    private static sharedBrowser: Browser | null = null;
    private static browserInitPromise: Promise<Browser> | null = null;

    async init() {
        if (ScraperService.sharedBrowser) {
            this.browser = ScraperService.sharedBrowser;
            return;
        }

        if (!ScraperService.browserInitPromise) {
            logger.info('🚀 Launching browser (one-time initialization)...');
            try {
                ScraperService.browserInitPromise = puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage', // Reduce memory usage
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                });
            } catch (launchError) {
                logger.error('❌ Failed to launch Puppeteer browser:', launchError);
                throw new Error(`Browser initialization failed: ${launchError instanceof Error ? launchError.message : String(launchError)}`);
            }
        }

        try {
            ScraperService.sharedBrowser = await ScraperService.browserInitPromise;
            this.browser = ScraperService.sharedBrowser;
            logger.info('✅ Browser ready');
        } catch (browserError) {
            logger.error('❌ Failed to await browser initialization:', browserError);
            ScraperService.browserInitPromise = null; // Reset so next attempt can retry
            throw new Error(`Browser initialization failed: ${browserError instanceof Error ? browserError.message : String(browserError)}`);
        }
    }

    async close() {
        // Don't close shared browser - keep it warm for next request
        // It will be reused for better performance
        this.browser = null;
    }

    // Optional: Call this to fully cleanup (e.g., on server shutdown)
    static async closeSharedBrowser() {
        if (ScraperService.sharedBrowser) {
            await ScraperService.sharedBrowser.close();
            ScraperService.sharedBrowser = null;
            ScraperService.browserInitPromise = null;
        }
    }

    async scrapeUnits(codes: string[]): Promise<Unit[]> {
        // Only init if we actually need it inside valid scrape
        // But scrapeUnit checks init.
        // For scrapeUnits standard flow, maybe we can skip global init too?
        // Let's leave this one for now, as it's less used.
        await this.init();
        const units: Unit[] = [];
        try {
            for (const code of codes) {
                console.log(`   Scraping ${code}...`);
                // Add a small delay to be polite and avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

                const unit = await this.scrapeUnitWithRetry(code);
                if (unit) {
                    units.push(unit);
                }
            }
        } finally {
            await this.close();
        }
        return units;
    }

    async scrapeUnitsWithDetails(codes: string[], skipValidation: boolean = true, onUnitScraped?: (unit: Unit) => Promise<void>): Promise<{ valid: Unit[], invalid: { code: string, url: string, reason: string }[] }> {
        const valid: Unit[] = [];
        const invalid: { code: string, url: string, reason: string }[] = [];

        // Skip pre-validation - training.gov.au is a SPA, fetch validation doesn't work reliably
        // The full scraper with Puppeteer will properly detect 404s
        const codesToScrape = codes;

        if (codesToScrape.length === 0) {
            logger.warn('⚠️  No units to scrape!');
            return { valid, invalid };
        }

        // REMOVED: await this.init(); 
        // We will initialize lazily inside scrapeUnit if needed. This prevents crashes if Puppeteer is broken but not needed.

        // CONCURRENCY: Reduced to 5 to prevent local system overload/crashing
        const BATCH_SIZE = 5;

        logger.info(`🚀 Starting parallel scrape for ${codesToScrape.length} units (Batch size: ${BATCH_SIZE})...`);

        // Helper to process a single unit
        const processUnit = async (code: string) => {
            try {
                logger.info(`   Scraping ${code}...`);
                // Use retry logic here to ensure "retrieve all" is robust
                const result = await this.scrapeUnitWithReason(code, 3);
                if (result.success && result.unit) {
                    valid.push(result.unit);
                    if (onUnitScraped) {
                        try {
                            await onUnitScraped(result.unit);
                        } catch (cbError) {
                            logger.error(`   ⚠️ Callback error for ${code}:`, cbError);
                        }
                    }
                    logger.info(`   ✅ Scraped ${code}`);
                } else {
                    logger.warn(`   ⚠️ Failed to scrape ${code}: ${result.reason}`);
                    invalid.push({
                        code,
                        url: `${this.baseUrl}/${code}`,
                        reason: result.reason || 'Unknown error'
                    });
                }
            } catch (e) {
                logger.error(`   ❌ Critical error processing ${code}:`, e);
                invalid.push({
                    code,
                    url: `${this.baseUrl}/${code}`,
                    reason: `Unexpected error: ${e}`
                });
            }
        };

        // Process in batches
        for (let i = 0; i < codesToScrape.length; i += BATCH_SIZE) {
            const batch = codesToScrape.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(codesToScrape.length / BATCH_SIZE);
            logger.info(`   Processing batch ${batchNum}/${totalBatches} (${batch.join(', ')})...`);

            // Run batch in parallel
            await Promise.all(batch.map(code => processUnit(code)));

            // Delay between batches
            if (i + BATCH_SIZE < codesToScrape.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        await this.close();
        return { valid, invalid };
    }

    private async scrapeUnitWithReason(code: string, retries = 1): Promise<{ success: boolean, unit?: Unit, reason?: string }> {
        for (let i = 0; i < retries; i++) {
            try {
                const unit = await this.scrapeUnit(code);
                if (unit) {
                    return { success: true, unit };
                }
                // If null returned without throw, it's usually a 404 or persistent failure logic in scrapeUnit,
                // but we might want to retry if it was a network blip disguised as null?
                // Currently scrapeUnit returns null for 404s. Retrying 404s is wasteful but safe.
                // However, scrapeUnit logs warnings.
            } catch (e: any) {
                const errorMsg = e?.message || String(e);

                // If it's the last retry, return failure
                if (i === retries - 1) {
                    // Extract reason from console.warn messages if available
                    if (errorMsg.includes('No title found')) {
                        return { success: false, reason: 'No title found on page (h1 element empty)' };
                    } else if (errorMsg.includes('404')) {
                        return { success: false, reason: 'HTTP 404 - Page not found' };
                    } else if (errorMsg.includes('Puppeteer')) {
                        return { success: false, reason: 'Browser automation failed (timeout or content issue)' };
                    } else if (errorMsg.includes('search')) {
                        return { success: false, reason: 'Not found in training.gov.au search results' };
                    }
                    return { success: false, reason: 'Scraping error: ' + errorMsg };
                }

                // Wait before retry
                const delay = 1000 * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return { success: false, reason: 'Unit returned null after retries' };
    }

    private async scrapeUnitWithRetry(code: string, retries = 3): Promise<Unit | null> {
        for (let i = 0; i < retries; i++) {
            try {
                const unit = await this.scrapeUnit(code);
                if (unit) return unit;
                break;
            } catch (e) {
                if (i === retries - 1) {
                    console.error(`   Failed to scrape ${code} after ${retries} attempts:`, e);
                    return null;
                }
                const delay = 1000 * Math.pow(2, i);
                console.warn(`   Error scraping ${code}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }

    async scrapeUnit(code: string): Promise<Unit | null> {
        let isSpaShell = false;
        let unitHtml = '';
        let $: any;
        let unitUrl = `${this.baseUrl}/${code}`;
        let response: Response | null = null;

        try {
            // 1. Try Direct Fetch (Fast)
            response = await this.fetchWithHeaders(unitUrl);

            // If we get blocked (403/429) or see a JS challenge, force Puppeteer
            if (response.status === 403 || response.status === 429) {
                console.warn(`   ⚠️ Access denied (${response.status}) for ${code}. Switching to Puppeteer...`);
                isSpaShell = true; // Force Puppeteer path
            } else {
                unitHtml = await response.text();
                $ = load(unitHtml);

                // Check if it's the SPA shell (empty title or specific Nuxt markers)
                isSpaShell = $('div#__nuxt').length > 0 || $('script[src*="_nuxt"]').length > 0;
            }

            if (isSpaShell) {
                console.log(`   Detected SPA shell or Block for ${code}. Switching to Puppeteer...`);
                // Note: init() will be called here if needed (safe check inside)
                if (!this.browser) await this.init();

                const page = await this.browser!.newPage();
                try {
                    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                    // Add extra headers to Puppeteer too
                    await page.setExtraHTTPHeaders({
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Upgrade-Insecure-Requests': '1'
                    });

                    // Navigate to the page
                    await page.goto(unitUrl, { waitUntil: 'networkidle0', timeout: 60000 }); // Increased timeout

                    // Wait for specific content that indicates the page has loaded
                    try {
                        await page.waitForFunction(
                            () => {
                                const bodyText = document.body.innerText;
                                return bodyText.includes('Assessment Conditions') ||
                                    bodyText.includes('Elements and Performance Criteria') ||
                                    bodyText.includes('Application');
                            },
                            { timeout: 20000 }
                        );
                        console.log(`   Content loaded for ${code}`);
                    } catch (e) {
                        // Double check content before failing
                        const content = await page.content();
                        if (!content.includes('Assessment Conditions') && !content.includes('Elements and Performance Criteria')) {
                            console.warn(`   Timeout waiting for content to load for ${code}`);
                        }
                    }

                    // Check for title presence
                    const titleCheck = await page.$('.heroSubheading');
                    if (!titleCheck) {
                        console.log(`   Title container not found immediately for ${code}, waiting explicitly...`);
                        try {
                            await page.waitForSelector('.heroSubheading', { timeout: 5000 });
                        } catch (e) {
                            console.warn(`   Could not find .heroSubheading after wait for ${code}`);
                        }
                    }

                    // additional wait
                    await new Promise(resolve => setTimeout(resolve, 4000));

                    unitHtml = await page.content();
                    $ = load(unitHtml);

                } catch (e) {
                    console.error(`   Puppeteer had issues for ${code}:`, e);
                    // If blocked fetch AND puppeteer failed, return null
                    if (response && response.status === 403) return null;
                } finally {
                    await page.close();
                }
            }

            // 2. If 404 or redirect to search, Try Search (only if not already handled by Puppeteer or if Puppeteer failed and we have no content)
            // If isSpaShell is true, unitHtml should be populated. If empty, maybe puppeteer failed.
            if (!isSpaShell && response && (response.status === 404 || response.url.toLowerCase().includes('/search/'))) {
                console.warn(`   Direct link for ${code} failed (404 or redirect). Attempting search fallback...`);
                const searchUrl = `https://training.gov.au/Search?q=${encodeURIComponent(code)}`;
                const searchResponse = await this.fetchWithHeaders(searchUrl);

                if (searchResponse.ok) {
                    const searchHtml = await searchResponse.text();
                    const $search = load(searchHtml);

                    const link = $search(`a[href*="/Training/Details/"]`).filter((_, el) => {
                        const text = $search(el).text().trim();
                        const href = $search(el).attr('href') || '';
                        return text.includes(code) || href.toUpperCase().includes(code.toUpperCase());
                    }).first();

                    if (link.length > 0) {
                        const href = link.attr('href');
                        unitUrl = href?.startsWith('http') ? href : `https://training.gov.au${href}`;
                        console.log(`   Found ${code} via search: ${unitUrl}`);
                        const finalRes = await this.fetchWithHeaders(unitUrl);
                        unitHtml = await finalRes.text();
                        $ = load(unitHtml);
                    } else {
                        console.warn(`   No valid link found in search results for ${code}`);
                        return null;
                    }
                }
            }

            if (!unitHtml || !$) {
                // Should have been populated by now
                return null;
            }

            // Check for 404 indicators in content
            const pageTitle = $('title').text().toLowerCase();
            const mainHeading = $('h1, h2').text().toLowerCase();

            if (pageTitle.includes('404') ||
                pageTitle.includes('page not found') ||
                mainHeading.includes('page not found') ||
                mainHeading.includes('error')) {
                console.warn(`   Unit ${code} page indicates not found.`);
                return null;
            }

            // If we got here, the page exists and is valid
            console.log(`   ✓ Unit ${code} page is valid.`);

            // Use the advanced parser
            const uoc = parseUocHtml(unitHtml, unitUrl);
            const unit = UnitMapper.fromUoc(uoc);

            console.log(`   ✅ Scraped ${code}: ${unit.title}`);
            return unit;

        } catch (e) {
            console.error(`   Failed to scrape ${code}:`, e);
            return null;
        }
    }

    private async fetchWithHeaders(url: string): Promise<Response> {
        return fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-AU,en;q=0.9,en-US;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });
    }



    /**
     * Extract ALL sections with complete hierarchy: headings, sub-headings, paragraphs, lists with nested items
     * Returns sections in the format: { heading, level, paragraphs[], lists[], subsections[] }
     */
    private extractAllSectionsWithLevels($: any): any[] {
        const allHeaders: any[] = [];

        // Collect all headers with their DOM elements
        $('h2, h3, h4, h5, h6').each((index: number, el: any) => {
            const header = $(el);
            const title = header.text().trim();
            const tagName = el.tagName.toLowerCase();
            const level = parseInt(tagName.replace('h', ''));

            // Skip empty titles or common non-content headers
            if (!title || ['navigation', 'menu', 'search', 'footer', 'header', 'sidebar'].some(s => title.toLowerCase().includes(s))) {
                return;
            }

            // Skip duplicate table headers or generic labels  
            if (title.toLowerCase() === 'elements describe' ||
                title.toLowerCase() === 'performance criteria specify' ||
                title.length < 3) {
                return;
            }

            allHeaders.push({
                element: header,
                heading: title,
                level,
                index
            });
        });

        // Build hierarchical structure with paragraphs and lists
        return this.buildSectionHierarchy($, allHeaders);
    }

    /**
     * Build hierarchical structure from flat header list
     */
    private buildSectionHierarchy($: any, headers: any[]): any[] {
        const root: any[] = [];
        const stack: any[] = [];

        for (let i = 0; i < headers.length; i++) {
            const current = headers[i];
            const nextHeader = headers[i + 1];

            // Extract complete content structure
            const contentData = this.extractCompleteContent($, current.element, nextHeader?.element);

            const section: any = {
                heading: current.heading,
                level: current.level,
                paragraphs: contentData.paragraphs,
                lists: contentData.lists,
                tables: contentData.tables,
                children: []
            };

            // Find parent in stack
            while (stack.length > 0 && stack[stack.length - 1].level >= current.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                root.push(section);
            } else {
                stack[stack.length - 1].children.push(section);
            }

            stack.push(section);
        }

        return root;
    }

    /**
     * Extract complete content structure: paragraphs[], lists[] with nested children, and tables[][]
     */
    private extractCompleteContent($: any, header: any, nextHeader?: any): { paragraphs: string[]; lists: any[]; tables: any[][] } {
        if (!header || header.length === 0) return { paragraphs: [], lists: [], tables: [] };

        const paragraphs: string[] = [];
        const lists: any[] = [];
        const tables: any[][] = [];
        let current = header.next();

        const headerLevel = parseInt(header.prop('tagName').toLowerCase().replace('h', ''));

        while (current && current.length > 0) {
            // Stop if we hit the next header at same or higher level
            if (current.is('h1, h2, h3, h4, h5, h6')) {
                const currentLevel = parseInt(current.prop('tagName').toLowerCase().replace('h', ''));
                if (currentLevel <= headerLevel) break;
            }

            // Stop if we reached the next header we're looking for
            if (nextHeader && current[0] === nextHeader[0]) break;

            // Extract paragraphs
            if (current.is('p')) {
                const text = current.text().trim();
                if (text) paragraphs.push(text);
            }
            // Extract divs with text (some content is in divs)
            else if (current.is('div')) {
                // Use the robust extraction to get text with newlines/spacing
                // We treat the whole div content as one "paragraph" entry if it's text,
                // but we also want to extract lists if they exist inside.

                // 1. Extract lists inside the div
                current.find('ul, ol').each((_: any, list: any) => {
                    // Only process direct children lists or lists not nested within other lists we've already processed?
                    // Simplified: Just extract top-level lists within this div
                    const $list = $(list);
                    // Check if this list is already inside another list we processed? 
                    // find() gets all descendants. We want top-level lists in this div.
                    if ($list.parentsUntil(current).filter('ul, ol').length === 0) {
                        const extracted = this.parseNestedList($, $list);
                        lists.push(...extracted);
                    }
                });

                // 2. Extract text (excluding the lists we just extracted to avoid dupes?)
                // Actually, for simple text extraction we can just use a modified text extractor that respects spacing
                // formatting it as a paragraph.

                // Clone and remove block elements that we might handle separately or want to treat as breaks
                const $clone = current.clone();
                $clone.find('ul, ol, table').remove(); // Remove lists/tables managed above

                // Now get text from what remains, with newlines for block elements
                // We can use a trick: replace <br>, <p>, <div> with newlines before text()
                $clone.find('br').replaceWith('\n');
                $clone.find('p, div').prepend('\n');

                const text = $clone.text().replace(/\n+/g, '\n').trim();
                if (text) paragraphs.push(text);
            }
            // Extract lists with full recursive nesting
            else if (current.is('ul, ol')) {
                const extracted = this.parseNestedList($, current);
                lists.push(...extracted);
            }
            // Extract tables as structured data
            else if (current.is('table')) {
                const tableData = this.parseTableStructured($, current);
                if (tableData && tableData.length > 0) tables.push(tableData);
            }

            current = current.next();
        }

        return {
            paragraphs,
            lists,
            tables
        };
    }

    /**
     * Recursively parse nested list items with all child levels
     * Returns ListItem[] matching format: { text: string, children?: ListItem[] }
     */
    private parseNestedList($: any, listElement: any): any[] {
        const items: any[] = [];

        listElement.children('li').each((_: any, li: any) => {
            const $li = $(li);

            // Get direct text content (excluding nested lists)
            const directText = $li.clone().children('ul, ol').remove().end().text().trim();

            if (!directText) return; // Skip empty items

            const item: any = {
                text: directText
            };

            // Find nested lists recursively
            const nestedLists = $li.children('ul, ol');
            if (nestedLists.length > 0) {
                const children: any[] = [];
                nestedLists.each((_: any, nestedList: any) => {
                    const nestedItems = this.parseNestedList($, $(nestedList));
                    children.push(...nestedItems);
                });
                if (children.length > 0) {
                    item.children = children;
                }
            }

            items.push(item);
        });

        return items;
    }

    /**
     * Parse table as structured data: TableRow[][] = { cells: string[] }[]
     */
    private parseTableStructured($: any, tableElement: any): any[] {
        const rows: any[] = [];

        tableElement.find('tr').each((_: any, tr: any) => {
            const $tr = $(tr);
            const cells: string[] = [];

            $tr.find('td, th').each((_: any, cell: any) => {
                const text = $(cell).text().trim();
                cells.push(text);
            });

            if (cells.length > 0) {
                rows.push({ cells });
            }
        });

        return rows;
    }

    /**
     * Find section content by matching heading (case-insensitive, fuzzy)
     * Searches recursively through nested sections and returns combined content
     */
    private findSectionContent(sections: any[], searchTerms: string[]): string {
        for (const section of sections) {
            for (const term of searchTerms) {
                if (section.heading.toLowerCase().includes(term.toLowerCase())) {
                    // Combine all content from this section
                    let content = '';

                    // Add paragraphs
                    if (section.paragraphs && section.paragraphs.length > 0) {
                        content += section.paragraphs.join('\n\n') + '\n\n';
                    }

                    // Add list items as text
                    if (section.lists && section.lists.length > 0) {
                        content += this.flattenListsToText(section.lists) + '\n\n';
                    }

                    // Add table data as text
                    if (section.tables && section.tables.length > 0) {
                        section.tables.forEach((table: any) => {
                            content += this.flattenTableToText(table) + '\n\n';
                        });
                    }

                    return content.trim();
                }
            }

            // Search in children recursively
            if (section.children && section.children.length > 0) {
                const childResult = this.findSectionContent(section.children, searchTerms);
                if (childResult) return childResult;
            }
        }
        return '';
    }

    /**
     * Flatten nested lists to text format
     */
    private flattenListsToText(lists: any[]): string {
        let text = '';
        lists.forEach((item: any) => {
            const indent = '  '.repeat(item.level || 0);
            text += indent + item.text + '\n';
            if (item.children && item.children.length > 0) {
                text += this.flattenListsToText(item.children);
            }
        });
        return text;
    }

    /**
     * Flatten table to text format (table is array of { cells: string[] })
     */
    private flattenTableToText(table: any[]): string {
        let text = '';
        table.forEach((row: any) => {
            if (row.cells && row.cells.length > 0) {
                text += row.cells.join('    ') + '\n';
            }
        });
        return text;
    }

    private extractSectionContent($: any, header: any): string {
        if (!header || header.length === 0) return '';

        // Determine the level of the starting header (e.g., h2 -> 2)
        const tagName = header[0].tagName.toLowerCase();
        const headerLevel = parseInt(tagName.replace('h', '')) || 6; // Default to 6 if unknown

        let content = '';
        let current = header.next();

        // Safety break
        let iterations = 0;

        while (current.length && iterations < 200) {
            iterations++;

            // Check if current element is a header
            if (current.is('h1, h2, h3, h4, h5, h6')) {
                const currentTagName = current[0].tagName.toLowerCase();
                const currentLevel = parseInt(currentTagName.replace('h', '')) || 6;

                // Stop if we hit a header of the same level or higher (smaller number)
                // e.g. if we started at h2, stop at h2 or h1.
                // Allow h3, h4, etc. to be included.
                if (currentLevel <= headerLevel) {
                    break;
                }

                // If it's a sub-header, include it formatted as markdown header
                // We use ## for h2, ### for h3 etc.
                content += `\n${'#'.repeat(currentLevel)} ${current.text().trim()}\n\n`;
            }

            if (current.is('ul') || current.is('ol')) {
                content += this.parseList($, current, 0);
            } else if (current.is('table')) {
                content += this.parseTable($, current);
            } else if (current.is('div')) {
                // Process div contents recursively
                content += this.processContainer($, current);
            } else if (current.is('p')) {
                content += current.text().trim() + '\n\n';
            } else if (!current.is('h1, h2, h3, h4, h5, h6')) { // Avoid double adding headers processed above
                const text = current.text().trim();
                if (text) {
                    content += text + '\n\n';
                }
            }
            current = current.next();
        }
        return content.trim();
    }

    private processContainer($: any, container: any): string {
        let content = '';
        container.contents().each((_: any, el: any) => {
            const element = $(el);

            // Skip empty text nodes
            if (element[0].type === 'text') {
                const text = element.text().trim();
                if (text) content += text + '\n';
                return;
            }

            if (element.is('ul') || element.is('ol')) {
                content += this.parseList($, element, 0);
            } else if (element.is('table')) {
                content += this.parseTable($, element);
            } else if (element.is('div')) {
                content += this.processContainer($, element);
            } else if (element.is('p')) {
                content += element.text().trim() + '\n\n';
            } else if (element.is('h1, h2, h3, h4, h5, h6')) {
                content += `\n### ${element.text().trim()}\n\n`;
            } else {
                // Handle other block elements or just text
                const text = element.text().trim();
                if (text && !element.is('script') && !element.is('style')) {
                    content += text + '\n';
                }
            }
        });
        return content;
    }

    private parseList($: any, list: any, depth: number): string {
        let content = '';
        // Use 2 spaces for indentation
        const indent = '  '.repeat(depth + 1);

        const isOrdered = list.is('ol');
        // Check for alpha class like 'loweralpha' common in TGA or type attribute
        const listClass = list.attr('class') || '';
        const listType = list.attr('type') || '';
        const isAlpha = listClass.includes('alpha') || listType === 'a' || listType === 'A';

        list.children('li').each((index: number, el: any) => {
            const li = $(el);
            const liClone = li.clone();
            liClone.children('ul, ol').remove();

            // Clean text but keep inner spacing
            const text = liClone.text().replace(/\s+/g, ' ').trim();

            // Determine marker
            let marker = '•';
            if (isOrdered) {
                if (isAlpha) {
                    marker = String.fromCharCode(97 + (index % 26)) + ')'; // a), b)
                } else {
                    marker = (index + 1) + '.';
                }
            }

            if (text) {
                content += `\n${indent}${marker} ${text}`;
            }

            const nestedList = li.children('ul, ol');
            if (nestedList.length > 0) {
                content += this.parseList($, nestedList, depth + 1); // Recurse
            }
        });
        return content;
    }

    /**
     * Extract structured content from a table cell, preserving nested lists and paragraphs
     */
    private extractCellContent($: any, cell: any): string {
        let content = '';
        // Iterate through all child nodes to preserve order
        $(cell).contents().each((_: any, el: any) => {
            const element = $(el);

            if (element[0].type === 'text') {
                const text = element.text().trim();
                if (text) content += text + ' ';
            } else if (element.is('strong, b')) {
                const text = element.text().trim();
                if (text) content += text + ' ';
            } else if (element.is('br')) {
                content += '\n';
            } else if (element.is('p')) {
                const text = element.text().trim();
                if (text) content += '\n' + text + '\n';
            } else if (element.is('ul') || element.is('ol')) {
                content += this.parseList($, element, 0);
            } else if (element.is('div')) {
                // divs in cells might be containers
                const divText = element.clone().children('ul, ol').remove().end().text().trim();
                if (divText) content += '\n' + divText + '\n';

                // Handle lists inside div
                element.children('ul, ol').each((_: any, list: any) => {
                    content += this.parseList($, $(list), 0);
                });
            } else {
                // Handle other inline/block elements
                const text = element.text().trim();
                if (text) content += text + ' ';
            }
        });

        // Clean up excessive whitespace and ensure text is clean
        return content
            .replace(/ \n/g, '\n')
            .replace(/\n /g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/([a-zA-Z0-9])([A-Z])/g, '$1 $2') // Fix mashed camelCase words if any
            .trim();
    }

    private parseTable($: any, table: any): string {
        let content = '';
        table.find('tr').each((_: any, row: any) => {
            const cells = $(row).find('th, td');
            const rowContent: string[] = [];
            cells.each((_: any, cell: any) => {
                rowContent.push($(cell).text().replace(/\s+/g, ' ').trim());
            });
            content += `${rowContent.join('    ')}\n`;
        });
        return content + '\n';
    }
}
