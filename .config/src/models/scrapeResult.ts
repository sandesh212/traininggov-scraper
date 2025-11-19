export interface ScrapeResult {
  success: string[];        // Successfully scraped unit codes
  notFound: string[];       // Units that don't exist (404)
  networkErrors: string[];  // Units that had network/timeout errors
  parsingErrors: string[];  // Units that scraped but failed to parse
}

export interface UnitError {
  code: string;
  url: string;
  error: string;
  timestamp: string;
}
