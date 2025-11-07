#!/usr/bin/env node
/**
 * Training.gov.au Unit Scraper - Standalone Executable
 * 
 * Usage: Double-click to run, or execute from terminal
 * 
 * Requirements:
 * - Units.xlsx file in the same directory
 * - Internet connection
 * 
 * Features:
 * - Automatic retry for network errors
 * - Skip invalid unit codes (404s)
 * - Progress tracking
 * - Error logging
 */

import * as path from "path";
import { promises as fs } from "fs";
import { syncUnits } from "./src/autoSync";

const BANNER = `
╔════════════════════════════════════════════════════════════╗
║  Training.gov.au Unit of Competency Scraper               ║
║  Automatic Data Extraction & Excel Export                 ║
╚════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.clear();
  console.log(BANNER);
  console.log('🚀 Starting automatic unit scraping...\n');

  try {
    // Get the directory where the executable is located
    const workDir = process.cwd();
    console.log(`📁 Working directory: ${workDir}\n`);

    // Check if Units.xlsx exists
    const inputFile = path.join(workDir, 'Units.xlsx');
    try {
      await fs.access(inputFile);
      console.log('✅ Found Units.xlsx\n');
    } catch (error) {
      console.error('❌ ERROR: Units.xlsx not found in current directory!');
      console.error('   Please place Units.xlsx in the same folder as this program.\n');
      console.log('Press any key to exit...');
      process.stdin.setRawMode(true);
      process.stdin.resume();
      await new Promise(resolve => process.stdin.once('data', resolve));
      process.exit(1);
    }

    // Run the sync with automatic retry
    const result = await syncUnits({
      inputExcel: 'Units.xlsx',
      inputColumn: '',
      outputExcel: 'UnitsData_Enhanced.xlsx',
      dataDir: 'data',
      maxRetries: 3,
      retryDelay: 5000,
      autoRetry: true
    });

    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('✅ SCRAPING COMPLETED SUCCESSFULLY!');
      console.log(`\n📊 Results:`);
      console.log(`   ✓ Valid units scraped: ${result.validCount}`);
      console.log(`   ✗ Invalid units (404): ${result.invalidCount}`);
      console.log(`   ⚠ Failed units (errors): ${result.errorCount}`);
      console.log(`\n📁 Output files:`);
      console.log(`   - UnitsData_Enhanced.xlsx (Color-coded Excel)`);
      console.log(`   - data/uoc.jsonl (Raw JSON data)`);
      if (result.errorCount > 0) {
        console.log(`   - data/error-log.json (Error details)`);
      }
    } else {
      console.log('⚠️  SCRAPING COMPLETED WITH ERRORS');
      console.log(`\n📊 Results:`);
      console.log(`   ✓ Valid units scraped: ${result.validCount}`);
      console.log(`   ✗ Invalid units (404): ${result.invalidCount}`);
      console.log(`   ⚠ Failed units: ${result.errorCount}`);
      console.log(`\n   Check data/error-log.json for details`);
    }
    console.log('='.repeat(60) + '\n');

    console.log('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => process.stdin.once('data', resolve));

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('\n   Please check your internet connection and try again.\n');
    console.log('Press any key to exit...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => process.stdin.once('data', resolve));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user. Exiting...\n');
  process.exit(0);
});

process.on('unhandledRejection', (error: any) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
