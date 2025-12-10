import { ScraperService } from './web/src/services/scraperService.ts';

const scraper = new ScraperService();
await scraper.scrapeUnits(['SFIAQU402']).then(result => {
  console.log(JSON.stringify(result.valid[0], null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
