import * as cheerio from 'cheerio';
import { Unit, Element, PerformanceCriteria } from '../types';
import puppeteer, { Browser } from 'puppeteer';
import { logger } from '@/utils/logger';

export class ScraperService {
    private baseUrl = 'https://training.gov.au/Training/Details';
    private browser: Browser | null = null;

    async init() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
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

    async scrapeUnitsWithDetails(codes: string[]): Promise<{ valid: Unit[], invalid: { code: string, url: string, reason: string }[] }> {
        await this.init();
        const valid: Unit[] = [];
        const invalid: { code: string, url: string, reason: string }[] = [];

        // CONCURRENCY CONTROL
        // Reduced to 3 to prevent memory/CPU exhaustion and timeouts
        const BATCH_SIZE = 3;

        logger.info(`🚀 Starting parallel scrape for ${codes.length} units (Batch size: ${BATCH_SIZE})...`);

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
        for (let i = 0; i < codes.length; i += BATCH_SIZE) {
            const batch = codes.slice(i, i + BATCH_SIZE);
            console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(codes.length / BATCH_SIZE)} (${batch.join(', ')})...`);

            // Run batch in parallel
            await Promise.all(batch.map(code => processUnit(code)));

            // Small delay between batches to be polite
            if (i + BATCH_SIZE < codes.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
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
                    console.error(`   Puppeteer failed for ${code}:`, e);
                    return null;
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

            // Extract Title
            titleRaw = $('h1').text().trim();
            if (!titleRaw) {
                console.warn(`   Unit ${code} has no title. Reason: No title found on page (h1 element empty)`);
                return null;
            }

            const titleMatch = titleRaw.match(new RegExp(`${code}\\s+-\\s+(.+)`, 'i'));
            const title = titleMatch ? titleMatch[1].trim() : titleRaw;

            // Helper to find headers case-insensitively
            const findHeader = (text: string) => {
                return $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
                    return $(el).text().toLowerCase().includes(text.toLowerCase());
                }).first();
            };

            // Extract Sections
            const application = this.extractSectionContent($, findHeader('Application'));
            const unitSector = this.extractSectionContent($, findHeader('Unit Sector'));
            const modificationHistory = this.extractSectionContent($, findHeader('Modification History'));
            const foundationSkills = this.extractSectionContent($, findHeader('Foundation Skills'));

            // Extract Elements & Performance Criteria
            const elements: Element[] = [];
            const pcHeader = findHeader('Elements and Performance Criteria');

            if (pcHeader.length > 0) {
                const pcTable = pcHeader.nextAll('table').first();
                let currentElement: Element | null = null;

                pcTable.find('tr').each((_, row) => {
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

            if (elements.length === 0) {
                console.warn(`   Unit ${code} has no elements parsed. Treating as invalid.`);
                return null;
            }

            // 2. Fetch Assessment Requirements
            const arLink = $('a').filter((_, el) => $(el).text().includes('Assessment Requirements')).attr('href');
            let knowledgeEvidence = '';
            let performanceEvidence = '';
            let assessmentConditions = '';

            if (arLink) {
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
                    const findArHeader = (text: string) => {
                        return $ar('h1, h2, h3, h4').filter((_, el) => $(el).text().toLowerCase().includes(text.toLowerCase())).first();
                    };

                    knowledgeEvidence = this.extractSectionContent($ar, findArHeader('Knowledge Evidence'));
                    performanceEvidence = this.extractSectionContent($ar, findArHeader('Performance Evidence'));
                    assessmentConditions = this.extractSectionContent($ar, findArHeader('Assessment Conditions'));
                }
            }

            return {
                code,
                title,
                description: application,
                application,
                unitSector,
                modificationHistory,
                foundationSkills,
                elements,
                knowledgeEvidence,
                performanceEvidence,
                assessmentConditions
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

    private extractSectionContent($: any, header: any): string {
        let content = '';
        let current = header.next();
        while (current.length && !current.is('h1, h2, h3, h4, h5, h6')) {
            if (current.is('ul') || current.is('ol')) {
                content += this.parseList($, current, 0);
            } else if (current.is('table')) {
                content += this.parseTable($, current);
            } else {
                const text = current.text().trim();
                if (text) {
                    content += text + '\n\n';
                }
            }
            current = current.next();
        }
        return content.trim();
    }

    private parseList($: any, list: any, depth: number): string {
        let content = '';
        const indent = '  '.repeat(depth);
        list.children('li').each((_: any, el: any) => {
            const li = $(el);
            const text = li.clone().children().remove().end().text().trim();
            if (text) {
                content += `${indent}- ${text}\n`;
            }
            const nestedList = li.children('ul, ol');
            if (nestedList.length > 0) {
                content += this.parseList($, nestedList, depth + 1);
            }
        });
        return content;
    }

    private parseTable($: any, table: any): string {
        let content = '';
        table.find('tr').each((_: any, row: any) => {
            const cells = $(row).find('th, td');
            const rowContent: string[] = [];
            cells.each((_: any, cell: any) => {
                rowContent.push($(cell).text().trim());
            });
            content += `| ${rowContent.join(' | ')} |\n`;
        });
        return content + '\n';
    }
}
