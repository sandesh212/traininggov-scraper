import * as cheerio from 'cheerio';
import { Unit, Element, PerformanceCriteria } from '../types';

export class ScraperService {
    private baseUrl = 'https://training.gov.au/Training/Details';

    async scrapeUnits(codes: string[]): Promise<Unit[]> {
        const units: Unit[] = [];
        for (const code of codes) {
            console.log(`   🌐 Scraping ${code}...`);
            const unit = await this.scrapeUnit(code);
            if (unit) {
                units.push(unit);
            }
        }
        return units;
    }

    async scrapeUnit(code: string): Promise<Unit | null> {
        try {
            // 1. Fetch Unit Page (Elements & PC)
            const unitUrl = `${this.baseUrl}/${code}`;
            const unitHtml = await fetch(unitUrl).then(r => r.text());
            const $ = cheerio.load(unitHtml);

            // Extract Title
            const titleRaw = $('h1').text().trim(); // e.g. "Unit of Competency details - MARN008 - Apply seamanship skills..."
            const titleMatch = titleRaw.match(new RegExp(`${code}\\s+-\\s+(.+)`));
            const title = titleMatch ? titleMatch[1].trim() : titleRaw;

            // Extract Elements & Performance Criteria
            const elements: Element[] = [];
            // Look for the table containing "Element" and "Performance Criteria"
            // TGA structure varies, but usually it's a table with class "layout" or similar, or just searching for headers.
            // We'll look for rows where the first cell matches "Element" pattern.

            // Strategy: Find the "Elements and Performance Criteria" header, then the table following it.
            const pcHeader = $('h2:contains("Elements and Performance Criteria")');
            const pcTable = pcHeader.nextAll('table').first();

            let currentElement: Element | null = null;

            pcTable.find('tr').each((_, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    const c1 = $(cells[0]).text().trim(); // Element or PC ID
                    const c2 = $(cells[1]).text().trim(); // Text

                    // Check if it's an Element (usually just "1", "2" or "1. Title")
                    // TGA often puts Element in one row and PCs in subsequent rows, OR Element in col 1 and PC in col 2.
                    // Common TGA format:
                    // Col 1: Element | Col 2: Performance Criteria
                    // But actually, often:
                    // Row 1: Element 1 | [Empty]
                    // Row 2: 1.1 | Text

                    // Let's assume standard TGA table:
                    // The table usually has headers "Element" and "Performance Criteria"

                    // If c1 looks like "1" or "1." and c2 is bold or looks like a title, it's an element.
                    // Or if the row has a specific class.

                    // Robust heuristic:
                    // If c1 is a single number (1, 2), it's likely an element ID.
                    // If c1 is number.number (1.1, 1.2), it's a PC.

                    if (/^\d+$/.test(c1)) {
                        // New Element
                        currentElement = {
                            title: c2,
                            performanceCriteria: []
                        };
                        elements.push(currentElement);
                    } else if (/^\d+\.\d+$/.test(c1) && currentElement) {
                        // PC
                        currentElement.performanceCriteria.push({
                            id: c1,
                            text: c2
                        });
                    }
                }
            });

            // 2. Fetch Assessment Requirements (KE, PE, AC)
            // Look for link "Assessment Requirements"
            const arLink = $('a:contains("Assessment Requirements")').attr('href');
            let knowledgeEvidence = '';
            let performanceEvidence = '';
            let assessmentConditions = '';

            if (arLink) {
                const arUrl = arLink.startsWith('http') ? arLink : `https://training.gov.au${arLink}`;
                console.log(`      🔗 Fetching Assessment Requirements: ${arUrl}`);
                const arHtml = await fetch(arUrl).then(r => r.text());
                const $ar = cheerio.load(arHtml);

                // Extract KE
                const keHeader = $ar('h2:contains("Knowledge Evidence")');
                knowledgeEvidence = this.extractSectionContent($ar, keHeader);

                // Extract PE
                const peHeader = $ar('h2:contains("Performance Evidence")');
                performanceEvidence = this.extractSectionContent($ar, peHeader);

                // Extract AC
                const acHeader = $ar('h2:contains("Assessment Conditions")');
                assessmentConditions = this.extractSectionContent($ar, acHeader);
            }

            return {
                code,
                title,
                elements,
                knowledgeEvidence,
                performanceEvidence,
                assessmentConditions
            };

        } catch (e) {
            console.error(`   ❌ Failed to scrape ${code}:`, e);
            return null;
        }
    }

    private extractSectionContent($: any, header: any): string {
        let content = '';
        let current = header.next();
        // Iterate until next h2 or end of container
        while (current.length && !current.is('h2')) {
            if (current.is('ul') || current.is('ol')) {
                content += this.parseList($, current, 0);
            } else if (current.is('table')) {
                current.find('tr').each((_: any, row: any) => {
                    const text = $(row).text().trim();
                    if (text) content += `• ${text}\n`;
                });
            } else if (current.is('p')) {
                const text = current.text().trim();
                if (text) content += `${text}\n`;
            }
            current = current.next();
        }
        return content;
    }

    private parseList($: any, list: any, depth: number): string {
        let content = '';
        const bullet = depth === 0 ? '•' : '◦';
        list.children('li').each((_: any, li: any) => {
            const $li = $(li);
            // Get text of this LI, excluding nested lists
            const text = $li.clone().children('ul, ol').remove().end().text().trim();
            if (text) content += `${bullet} ${text}\n`;

            const nested = $li.children('ul, ol');
            if (nested.length) {
                content += this.parseList($, nested, depth + 1);
            }
        });
        return content;
    }
}
