/// <reference types="vitest" />
import { describe, expect, it } from 'vitest';
import * as uocParser from '../src/parsers/uocParser.js';
import { parseUocHtml } from '../src/parsers/uocParser.js';
import { JSDOM } from 'jsdom';

describe('parseUoc', () => {
    it('should correctly parse a UOC page', () => {
        const html = `
            <html>
                <body>
                    <h1>Unit of Competency: MARH013</h1>
                    <h2>Title: Sample UOC Title</h2>
                    <p>Description: This is a sample description for the UOC.</p>
                </body>
            </html>
        `;
        const { document } = (new JSDOM(html)).window;

        const result = parseUocHtml(html, 'http://example.com/MARH013');

        // parseUocHtml returns a full Uoc object; assert core fields are present
        expect(result).toEqual(expect.objectContaining({
            code: 'MARH013',
            title: 'Sample UOC Title',
            description: 'This is a sample description for the UOC.'
        }));
    });

    it('should return null for missing elements', () => {
        const html = `
            <html>
                <body>
                    <h1>Unit of Competency: MARH013</h1>
                </body>
            </html>
        `;
        const { document } = (new JSDOM(html)).window;

        const result = parseUocHtml(html, 'http://example.com/MARH013');

        expect(result).toEqual(expect.objectContaining({
            code: 'MARH013',
            title: '',
            url: 'http://example.com/MARH013'
        }));
    });
});