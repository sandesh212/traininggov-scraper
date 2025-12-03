```javascript
const cheerio = require('cheerio');

async function testScrape(code) {
    const url = `https://training.gov.au/Training/Details/${code}/unitdetails`;
console.log(`Testing ${url}...`);
try {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (response.ok) {
        const text = await response.text();
        console.log(`Length: ${text.length}`);
        if (text.includes('__nuxt')) console.log("Still Nuxt SPA");
        else console.log("Likely Static!");
    }
} catch (e) {
    console.error("Error:", e.message);
}
}

testScrape('MARA022');
```
