import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

console.log('Fetching MARF028...');
await page.goto('https://training.gov.au/Training/Details/MARF028', { waitUntil: 'networkidle2' });

const html = await page.content();
const $ = cheerio.load(html);

console.log('\n=== Looking for Assessment Conditions ===\n');

// Check if "Assessment Conditions" text exists
const bodyText = $('body').text();
if (bodyText.includes('Assessment conditions')) {
  console.log('✓ "Assessment conditions" text found in body');
} else {
  console.log('✗ "Assessment conditions" text NOT found in body');
}

// Try <dl> tags
console.log('\n--- Strategy 1: <dl> tags ---');
$('dl').each((i, dl) => {
  const $dl = $(dl);
  const dtText = $dl.find('dt').first().text().trim();
  if (dtText.toLowerCase().includes('assessment')) {
    console.log(`Found <dl> with dt: "${dtText}"`);
    console.log(`Value: "${$dl.find('dd').first().text().trim().substring(0, 100)}"`);
  }
});

// Try h2/h3/h4 headings
console.log('\n--- Strategy 2: Headings ---');
$('h2, h3, h4').each((i, h) => {
  const text = $(h).text().trim();
  if (text.toLowerCase().includes('assessment')) {
    console.log(`Found <${h.name}>: "${text}"`);
    const next = $(h).next();
    if (next.length) {
      console.log(`  Next element: <${next[0].name}> with text: "${next.text().trim().substring(0, 100)}"`);
    }
  }
});

// Search in all paragraphs
console.log('\n--- Strategy 3: Paragraph search ---');
$('p').each((i, p) => {
  const text = $(p).text().trim();
  if (text.toLowerCase().includes('assessment conditions')) {
    console.log(`Found in <p>: "${text.substring(0, 150)}"`);
  }
});

await browser.close();
