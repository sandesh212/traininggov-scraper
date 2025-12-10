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

            // Navigate to the page
            const response = await page.goto(url, { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });

            // Check if redirected to search
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

            // Wait a bit for content to render
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get page content after JavaScript execution
            const bodyText = await page.evaluate(() => document.body.innerText);
            const htmlContent = await page.content();

            // Check for "not found" indicators in rendered content
            const textLower = bodyText.toLowerCase();
            const htmlLower = htmlContent.toLowerCase();

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

            // Check for valid unit indicators in rendered content
            const hasUnitCode = bodyText.includes(code) || htmlContent.includes(code);
            const hasElements = textLower.includes('elements and performance criteria') || 
                               textLower.includes('performance criteria') ||
                               textLower.includes('assessment conditions') ||
                               textLower.includes('application');

            const hasMinimalContent = bodyText.length > 500;

            if (!hasMinimalContent) {
                await page.close();
                return {
                    code,
                    valid: false,
                    reason: 'Page content too short - likely error page',
                    url
                };
            }

            if (hasUnitCode && hasElements) {
                await page.close();
                return { code, valid: true, url };
            }

            // If code is in page but no elements, might still be valid (different layout)
            if (hasUnitCode && hasMinimalContent) {
                await page.close();
                return { code, valid: true, url };
            }

            // Default to invalid if we can't confirm it's valid
            await page.close();
            return {
                code,
                valid: false,
                reason: 'Could not verify unit information on page',
                url
            };

        } catch (error: any) {
            await page.close();
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
    async validateUnits(codes: string[], batchSize: number = 3): Promise<{
        valid: ValidationResult[];
        invalid: ValidationResult[];
    }> {
        const results: ValidationResult[] = [];
        
        console.log(`\n🔍 Pre-validating ${codes.length} units against training.gov.au...`);
        console.log(`   Using Puppeteer for accurate JavaScript-rendered content check\n`);

        await this.init();

        // Process in batches to avoid overwhelming the browser
        for (let i = 0; i < codes.length; i += batchSize) {
            const batch = codes.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(codes.length / batchSize);
            
            console.log(`   Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

            // Process batch sequentially (browser reuse)
            for (const code of batch) {
                const result = await this.validateUnit(code);
                results.push(result);
            }

            // Small delay between batches
            if (i + batchSize < codes.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
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
