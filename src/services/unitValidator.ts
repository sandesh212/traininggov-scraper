/**
 * Unit Validator Service
 * Validates units against training.gov.au to check if they exist (not 404)
 * This is a lightweight pre-check before scraping
 * 
 * NOTE: training.gov.au is an SPA (Single Page Application) that requires
 * JavaScript execution to render content. For proper validation, we need
 * to either use Puppeteer or check for specific patterns in the initial HTML.
 */

import puppeteer, { Browser } from 'puppeteer';

export interface ValidationResult {
    code: string;
    valid: boolean;
    reason?: string;
    url: string;
}

export class UnitValidator {
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

    /**
     * Validate a single unit code using Puppeteer
     * Training.gov.au is an SPA that requires JavaScript rendering
     */
    async validateUnit(code: string): Promise<ValidationResult> {
        const url = `${this.baseUrl}/${code}`;

        if (!this.browser) {
            await this.init();
        }

        const page = await this.browser!.newPage();

        try {
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Optimisation: Block images and stylesheets to save bandwidth and time
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Navigate to the page - Use domcontentloaded which is much faster than networkidle0
            const response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Fast fail for redirect
            const currentUrl = page.url();
            if (currentUrl.toLowerCase().includes('/search')) {
                await page.close();
                return {
                    code,
                    valid: false,
                    reason: 'Redirected to search page - unit not found',
                    url
                };
            }

            // Wait for key content headers instead of arbitrary sleep
            // We look for 'h1', 'h2', or standard TGA layout elements
            try {
                await page.waitForSelector('.ibox-content', { timeout: 5000 });
            } catch (e) {
                // Ignore timeout, we'll check content anyway
            }

            // Get page content
            const bodyText = await page.evaluate(() => document.body.innerText);
            const htmlContent = await page.content();

            // Check for "not found" indicators in rendered content
            const textLower = bodyText.toLowerCase();

            if (textLower.includes('page not found') ||
                textLower.includes('unit not found') ||
                textLower.includes('no results found') ||
                textLower.includes('error 404')) {
                await page.close();
                return {
                    code,
                    valid: false,
                    reason: 'Page indicates unit not found',
                    url
                };
            }

            // Check for valid unit indicators
            const hasUnitCode = bodyText.includes(code) || htmlContent.includes(code);
            const hasMinimalContent = bodyText.length > 500;

            if (hasUnitCode && hasMinimalContent) {
                await page.close();
                return { code, valid: true, url };
            }

            // Default to invalid if we can't confirm it's valid, but be lenient if content is substantial
            if (hasMinimalContent) {
                await page.close();
                return { code, valid: true, url }; // Assume valid if we have content
            }

            await page.close();
            return {
                code,
                valid: false,
                reason: 'Could not verify unit information on page',
                url
            };

        } catch (error: any) {
            try { await page.close(); } catch (e) { }
            return {
                code,
                valid: false,
                reason: `Validation error: ${error.message}`,
                url
            };
        }
    }

    /**
     * Validate multiple units in batches
     */
    async validateUnits(codes: string[], batchSize: number = 5): Promise<{
        valid: ValidationResult[];
        invalid: ValidationResult[];
    }> {
        const results: ValidationResult[] = [];

        console.log(`\n🔍 Pre-validating ${codes.length} units against training.gov.au...`);
        console.log(`   Using Puppeteer with optimized parallel batching (size: ${batchSize})\n`);

        await this.init();

        // Process in batches
        let processedCount = 0;
        const totalUnits = codes.length;

        const printProgress = (current: number, total: number) => {
            const width = 30;
            const percent = Math.round((current / total) * 100);
            const filled = Math.round((width * current) / total);
            const empty = width - filled;
            const bar = '▓'.repeat(filled) + '░'.repeat(empty);
            console.log(`\n   ${bar} ${percent}% (${current}/${total} checked)\n`);
        };

        for (let i = 0; i < codes.length; i += batchSize) {
            const batch = codes.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(codes.length / batchSize);

            console.log(`   Batch ${batchNum}/${totalBatches}: Checking ${batch.join(', ')} ...`);

            // Execute batch in PARALLEL
            const batchPromises = batch.map(async (code) => {
                const res = await this.validateUnit(code);
                processedCount++;
                printProgress(processedCount, totalUnits);
                return res;
            });
            const batchResults = await Promise.all(batchPromises);

            results.push(...batchResults);
        }

        await this.close();

        const valid = results.filter(r => r.valid);
        const invalid = results.filter(r => !r.valid);

        console.log(`\n✅ Valid: ${valid.length}/${codes.length}`);
        console.log(`❌ Invalid: ${invalid.length}/${codes.length}\n`);

        if (invalid.length > 0) {
            console.log('Invalid units:');
            invalid.forEach(inv => {
                console.log(`  ✗ ${inv.code}: ${inv.reason}`);
            });
            console.log('');
        }

        return { valid, invalid };
    }
}
