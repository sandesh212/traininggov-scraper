import * as cheerio from 'cheerio';
import { Unit, Element, PerformanceCriteria } from '../types';
import puppeteer, { Browser } from 'puppeteer';
import { logger } from '@/utils/logger';

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

    async scrapeUnitsWithDetails(codes: string[], skipValidation: boolean = true): Promise<{ valid: Unit[], invalid: { code: string, url: string, reason: string }[] }> {
        const valid: Unit[] = [];
        const invalid: { code: string, url: string, reason: string }[] = [];

        // Skip pre-validation - training.gov.au is a SPA, fetch validation doesn't work reliably
        // The full scraper with Puppeteer will properly detect 404s
        const codesToScrape = codes;

        if (codesToScrape.length === 0) {
            logger.warn('⚠️  No units to scrape!');
            return { valid, invalid };
        }

        await this.init(); // Initialize browser ONCE and reuse

        // IMPROVED CONCURRENCY: Increased to 15 for much better performance
        const BATCH_SIZE = 15;

        logger.info(`🚀 Starting parallel scrape for ${codesToScrape.length} units (Batch size: ${BATCH_SIZE})...`);

        // Helper to process a single unit
        const processUnit = async (code: string) => {
            try {
                logger.info(`   Scraping ${code}...`);
                const result = await this.scrapeUnitWithReason(code);
                if (result.success && result.unit) {
                    valid.push(result.unit);
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

            // Minimal delay between batches (50ms) for max speed
            if (i + BATCH_SIZE < codesToScrape.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        await this.close();
        return { valid, invalid };
    }

    private async scrapeUnitWithReason(code: string): Promise<{ success: boolean, unit?: Unit, reason?: string }> {
        try {
            const unit = await this.scrapeUnit(code);
            if (unit) {
                return { success: true, unit };
            }
            return { success: false, reason: 'Unit returned null without specific error' };
        } catch (e: any) {
            const errorMsg = e?.message || String(e);
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

        try {
            // 1. Try Direct Fetch (Fast)
            let unitUrl = `${this.baseUrl}/${code}`;
            let response = await this.fetchWithHeaders(unitUrl);
            let unitHtml = await response.text();
            let $ = cheerio.load(unitHtml);

            // Check if it's the SPA shell (empty title or specific Nuxt markers)
            let titleRaw = $('h1').first().text().trim();
            let mainHeading = $('h1').text().toLowerCase();
            let pageTitle = $('title').text().toLowerCase();
            isSpaShell = $('div#__nuxt').length > 0 || $('script[src*="_nuxt"]').length > 0;

            if (isSpaShell) {
                console.log(`   Detected SPA shell for ${code}. Switching to Puppeteer...`);
                if (!this.browser) await this.init();

                const page = await this.browser!.newPage();
                try {
                    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                    // Navigate to the page
                    await page.goto(unitUrl, { waitUntil: 'networkidle0', timeout: 45000 });

                    // Wait for specific content that indicates the page has loaded
                    // All units have "Assessment Conditions" so wait for that
                    try {
                        await page.waitForFunction(
                            () => {
                                const bodyText = document.body.innerText;
                                return bodyText.includes('Assessment Conditions') ||
                                    bodyText.includes('Elements and Performance Criteria') ||
                                    bodyText.includes('Application');
                            },
                            { timeout: 15000 }
                        );
                        console.log(`   Content loaded for ${code}`);
                    } catch (e) {
                        console.warn(`   Timeout waiting for content to load for ${code}`);
                        // Continue anyway, maybe content is there
                    }

                    // Additional wait for any animations
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    unitHtml = await page.content();
                    $ = cheerio.load(unitHtml);

                    // Debug: Check what we got
                    const bodyText = $('body').text();
                    console.log(`   Page text length: ${bodyText.length} chars for ${code}`);

                } catch (e) {
                    console.warn(`   Puppeteer had issues for ${code}:`, e);
                    console.warn(`   Continuing with regular fetch response...`);
                    // Don't return null - continue with the regular fetch response
                    // The unit might still be valid even if Puppeteer had issues
                } finally {
                    await page.close();
                }
            }

            // 2. If 404 or redirect to search, Try Search (only if not already handled by Puppeteer or if Puppeteer failed)
            if (!isSpaShell && (response.status === 404 || response.url.toLowerCase().includes('/search/'))) {
                console.warn(`   Direct link for ${code} failed (404 or redirect). Attempting search fallback...`);
                const searchUrl = `https://training.gov.au/Search?q=${encodeURIComponent(code)}`;
                const searchResponse = await this.fetchWithHeaders(searchUrl);

                if (!searchResponse.ok) {
                    console.warn(`   Search failed for ${code}. Reason: Search page request failed`);
                    return null;
                }

                const searchHtml = await searchResponse.text();
                const $search = cheerio.load(searchHtml);

                const link = $search(`a[href*="/Training/Details/"]`).filter((_, el) => {
                    const text = $search(el).text().trim();
                    const href = $search(el).attr('href') || '';
                    return text.includes(code) || href.toUpperCase().includes(code.toUpperCase());
                }).first();

                if (link.length > 0) {
                    const href = link.attr('href');
                    unitUrl = href?.startsWith('http') ? href : `https://training.gov.au${href}`;
                    console.log(`   Found ${code} via search: ${unitUrl}`);
                    response = await this.fetchWithHeaders(unitUrl);
                    unitHtml = await response.text();
                    $ = cheerio.load(unitHtml);
                } else {
                    console.warn(`   No valid link found in search results for ${code}. Reason: Unit code not found in search results`);
                    return null;
                }
            }

            if (response.status === 404 && !isSpaShell) {
                console.warn(`   Unit ${code} returned 404 after search fallback. Reason: HTTP 404 - Page not found`);
                return null;
            }

            // Check for 404 indicators in content
            pageTitle = $('title').text().toLowerCase();
            mainHeading = $('h1, h2').text().toLowerCase();

            if (pageTitle.includes('404') ||
                pageTitle.includes('page not found') ||
                mainHeading.includes('page not found') ||
                mainHeading.includes('error')) {
                console.warn(`   Unit ${code} page indicates not found. Reason: Page contains 404/error indicators`);
                return null;
            }

            // If we got here, the page exists and is valid (not 404, not error)
            console.log(`   ✓ Unit ${code} page is valid (not 404)`);


            // Extract Title
            titleRaw = $('h1').text().trim();
            if (!titleRaw) {
                // Try alternate title sources
                titleRaw = $('title').text().trim() || '';

                if (!titleRaw || titleRaw.toLowerCase().includes('training.gov.au')) {
                    console.warn(`   Unit ${code} has no clear title, using code as fallback`);
                    titleRaw = code; // Use code as fallback - page exists but title not parseable
                }
            }

            const titleMatch = titleRaw.match(new RegExp(`${code}\\s+-\\s+(.+)`, 'i'));
            const title = titleMatch ? titleMatch[1].trim() : titleRaw;

            // Helper to find headers case-insensitively
            const findHeader = (text: string) => {
                return $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
                    return $(el).text().toLowerCase().includes(text.toLowerCase());
                }).first();
            };

            // Extract ALL sections dynamically from main page (h2, h3, h4 headers)
            const mainPageSections = this.extractAllSectionsWithLevels($);

            // Extract specific known fields
            // Use findHeader helper to get the element, then extract content
            const application = this.extractSectionContent($, findHeader('Application'));
            const unitSector = this.extractSectionContent($, findHeader('Unit Sector'));
            const modificationHistory = this.extractSectionContent($, findHeader('Modification History'));
            const foundationSkills = this.extractSectionContent($, findHeader('Foundation Skills'));
            let performanceEvidence = this.extractSectionContent($, findHeader('Performance Evidence'));
            let knowledgeEvidence = this.extractSectionContent($, findHeader('Knowledge Evidence'));
            let assessmentConditions = this.extractSectionContent($, findHeader('Assessment Conditions'));

            // Extract Status and Release from header or summary
            let status = 'Current'; // Default
            let release = 'Release 1';

            // Try to find status/release in specific elements
            const releaseBanner = $('.releases-banner').text();
            if (releaseBanner) {
                if (releaseBanner.toLowerCase().includes('superseded')) status = 'Superseded';
            }

            // Re-read pageTitle after potential Puppeteer load if declared, otherwise declare it
            // Assuming pageTitle is declared at line 299 as let/var.
            pageTitle = $('title').text();
            const releaseMatch = pageTitle.match(/Release\s+(\d+)/i);
            if (releaseMatch) {
                release = `Release ${releaseMatch[1]}`;
            }

            // TGA specific: check for "Current" or "Superseded" badge
            if ($('.nrt-current').length > 0) status = 'Current';
            if ($('.nrt-superseded').length > 0) status = 'Superseded';

            // Also check <h2 class="h2-status">Current</h2> if exists
            const statusText = $('h2.status, .status-label').first().text().trim();
            if (statusText) status = statusText;

            // Extract Elements & Performance Criteria
            const elements: Element[] = [];
            const pcHeader = findHeader('Elements and Performance Criteria');

            if (pcHeader.length > 0) {
                let pcTable = pcHeader.nextAll('table').first();
                // If not found as direct sibling, check inside the next div (common in new TGA design)
                if (pcTable.length === 0) {
                    pcTable = pcHeader.nextAll('div').first().find('table').first();
                }

                let currentElement: Element | null = null;

                pcTable.find('tr').each((i, row) => {
                    const cells = $(row).find('td');
                    if (cells.length >= 2) {
                        const c1 = this.extractCellContent($, cells[0]);
                        const c2 = this.extractCellContent($, cells[1]);
                        const c3 = cells.length >= 3 ? this.extractCellContent($, cells[2]) : '';

                        // Check 1: Normal Format - c1 is Element ID (e.g. "1")
                        if (/^\d+\.?$/.test(c1.trim())) {
                            currentElement = { title: c2, performanceCriteria: [] };
                            elements.push(currentElement);
                        }
                        // Check 2: Normal Format - c1 is PC ID (e.g. "1.1")
                        else if (/^\d+\.\d+\.?$/.test(c1.trim()) && currentElement) {
                            currentElement.performanceCriteria.push({ id: c1.trim(), text: c2 });
                        }
                        // Check 3: 3-Column Format - c1=Element, c2=PC ID, c3=PC Text
                        else if (cells.length >= 3 && /^\d+\.\d+\.?$/.test(c2.trim())) {
                            if (c1.trim() && !c1.toLowerCase().includes('elements describe')) {
                                currentElement = { title: c1, performanceCriteria: [] };
                                elements.push(currentElement);
                            }

                            if (currentElement) {
                                currentElement.performanceCriteria.push({ id: c2.trim(), text: c3 });
                            }
                        }
                        // Check 4: Combined Format - c2 contains ID + Text (e.g. "1.1 Text...")
                        else {
                            const matchText = c2.trim();
                            const pcMatch = matchText.match(/^(\d+\.\d+)\.?\s+([\s\S]*)/);

                            if (pcMatch) {
                                // If c1 has text, it's a new Element
                                if (c1.trim() && !c1.toLowerCase().includes('elements describe')) {
                                    currentElement = { title: c1, performanceCriteria: [] };
                                    elements.push(currentElement);
                                }

                                if (currentElement) {
                                    currentElement.performanceCriteria.push({ id: pcMatch[1], text: pcMatch[2] });
                                }
                            }
                        }
                    }
                });
            }

            // Fallback for Elements
            if (elements.length === 0) {
                const tableWithPC = $('table').filter((_, el) => $(el).text().includes('Performance Criteria')).first();
                if (tableWithPC.length > 0) {
                    let currentElement: Element | null = null;
                    tableWithPC.find('tr').each((_, row) => {
                        const cells = $(row).find('td');
                        if (cells.length >= 2) {
                            const c1 = $(cells[0]).text().trim();
                            const c2 = $(cells[1]).text().trim();
                            if (/^\d+\.?$/.test(c1)) {
                                currentElement = { title: c2, performanceCriteria: [] };
                                elements.push(currentElement);
                            } else if (/^\d+\.\d+\.?$/.test(c1) && currentElement) {
                                currentElement.performanceCriteria.push({ id: c1, text: c2 });
                            }
                        }
                    });
                }
            }

            // Don't fail just because we couldn't parse elements perfectly
            // The unit is still valid if the page exists and has a title
            if (elements.length === 0) {
                console.warn(`   Unit ${code} has no elements parsed (parsing issue, but page is valid).`);
                // Create a minimal valid unit structure
                // The page exists and has a title, so it's a valid unit even if we can't parse details
            }

            // Store all sections (combine main page + AR page later)
            let allSections = [...mainPageSections];

            // 2. Fetch Assessment Requirements page if exists (sometimes has additional info)
            const arLink = $('a').filter((_, el) => $(el).text().includes('Assessment Requirements')).attr('href');

            if (arLink && !knowledgeEvidence) {
                // Only fetch AR page if we didn't already get the data from main page
                const arUrl = arLink.startsWith('http') ? arLink : `https://training.gov.au${arLink}`;
                console.log(`      Fetching Assessment Requirements: ${arUrl}`);

                let arHtml = '';
                if (isSpaShell) {
                    if (!this.browser) await this.init();
                    const page = await this.browser!.newPage();
                    try {
                        await page.goto(arUrl, { waitUntil: 'networkidle2' });
                        arHtml = await page.content();
                    } catch (e) {
                        console.warn(`      Puppeteer failed for AR ${code}:`, e);
                    } finally {
                        await page.close();
                    }
                } else {
                    try {
                        const arResponse = await this.fetchWithHeaders(arUrl);
                        if (arResponse.ok) arHtml = await arResponse.text();
                    } catch (e) {
                        console.warn(`      Failed to fetch Assessment Requirements for ${code}: ${e}`);
                    }
                }

                if (arHtml) {
                    const $ar = cheerio.load(arHtml);

                    // Extract ALL sections from AR page dynamically
                    const arSections = this.extractAllSectionsWithLevels($ar);
                    allSections = [...allSections, ...arSections];

                    // Extract specific known fields for backward compatibility (if not already found)
                    if (!knowledgeEvidence) knowledgeEvidence = this.findSectionContent(arSections, ['knowledge evidence']);
                    if (!performanceEvidence) performanceEvidence = this.findSectionContent(arSections, ['performance evidence']);
                    if (!assessmentConditions) assessmentConditions = this.findSectionContent(arSections, ['assessment conditions']);
                }
            }

            // Log what we extracted
            const pcCount = elements.reduce((sum, el) => sum + el.performanceCriteria.length, 0);
            console.log(`   ✅ Scraped ${code}:`);
            console.log(`      - Title: ${title}`);
            console.log(`      - Elements: ${elements.length}`);
            console.log(`      - Performance Criteria: ${pcCount}`);
            console.log(`      - Knowledge Evidence: ${knowledgeEvidence ? `${knowledgeEvidence.length} chars` : 'MISSING'}`);
            console.log(`      - Performance Evidence: ${performanceEvidence ? `${performanceEvidence.length} chars` : 'MISSING'}`);
            console.log(`      - Assessment Conditions: ${assessmentConditions ? `${assessmentConditions.length} chars` : 'MISSING'}`);
            console.log(`      - Foundation Skills: ${foundationSkills ? 'Yes' : 'No'}`);
            console.log(`      - Unit Sector: ${unitSector || 'N/A'}`);

            return {
                code,
                title,
                url: unitUrl,
                status,
                release,
                description: application,
                application,
                unitSector,
                modificationHistory,
                foundationSkills,
                elements,
                knowledgeEvidence,
                performanceEvidence,
                assessmentConditions,
                sections: allSections
            };

        } catch (e) {
            console.error(`   Failed to scrape ${code}:`, e);
            return null;
        }
    }

    private async fetchWithHeaders(url: string): Promise<Response> {
        return fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
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
