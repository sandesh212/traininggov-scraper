#!/usr/bin/env node
/**
 * Validate and Scrape Units from Excel
 * 
 * This script:
 * 1. Loads unit codes from Units.xlsx
 * 2. Validates them against training.gov.au (checks for 404)
 * 3. Only scrapes valid units
 * 
 * Usage: npx tsx src/validateAndScrape.ts [--skip-validation]
 */

import { ExcelLoader } from './services/excelLoader.js';
import { UnitValidator } from './services/unitValidator.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const args = process.argv.slice(2);
    const skipValidation = args.includes('--skip-validation');
    const showAll = args.includes('--show-all');
    const excelPath = args.find(arg => arg.endsWith('.xlsx') || arg.endsWith('.xls')) || 'Units.xlsx';

    console.log('\n🚀 Unit Validation and Scraping Tool\n');
    console.log('=' .repeat(60));

    // Step 1: Load units from Excel
    console.log('\n📊 Step 1: Loading units from Excel...');
    const loader = new ExcelLoader(excelPath);
    const excelUnits = loader.loadUnits();

    if (excelUnits.length === 0) {
        console.error('❌ No units found in Excel file!');
        console.error('   Make sure the file contains unit codes like MARA022, BSBTWK201, etc.');
        process.exit(1);
    }

    const unitCodes = excelUnits.map(u => u.code);
    console.log(`   Found ${unitCodes.length} unique unit codes`);
    
    // Show all codes if requested
    if (showAll) {
        console.log('\n   All unit codes found:');
        unitCodes.forEach((code, idx) => {
            console.log(`   ${idx + 1}. ${code}`);
        });
    } else {
        console.log(`   Sample (first 10): ${unitCodes.slice(0, 10).join(', ')}`);
        console.log(`   (Use --show-all to see complete list)`);
    }

    // Step 2: Validate units (unless skipped)
    let validCodes = unitCodes;
    let invalidUnits: any[] = [];

    if (!skipValidation) {
        console.log('\n🔍 Step 2: Validating units against training.gov.au...');
        const validator = new UnitValidator();
        const validation = await validator.validateUnits(unitCodes);

        validCodes = validation.valid.map(v => v.code);
        invalidUnits = validation.invalid;

        // Save validation report
        const reportPath = 'validation-report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalUnits: unitCodes.length,
            validUnits: validCodes.length,
            invalidUnits: invalidUnits.length,
            valid: validation.valid,
            invalid: validation.invalid
        }, null, 2));

        console.log(`\n📄 Validation report saved to: ${reportPath}`);

        if (invalidUnits.length > 0) {
            console.log('\n❌ Invalid/Not Found Units:');
            console.log('=' .repeat(60));
            invalidUnits.forEach(inv => {
                console.log(`   ${inv.code}: ${inv.reason}`);
            });
            
            // Save invalid units to separate file
            const invalidPath = 'invalid-units.txt';
            fs.writeFileSync(invalidPath, 
                'Invalid Units (404 or Not Found)\n' +
                '=' .repeat(60) + '\n\n' +
                invalidUnits.map(inv => `${inv.code}: ${inv.reason}\n  URL: ${inv.url}`).join('\n\n')
            );
            console.log(`\n   Invalid units list saved to: ${invalidPath}`);
        }
    } else {
        console.log('\n⚠️  Step 2: SKIPPED (validation disabled)');
    }

    // Step 3: Summary
    console.log('\n📊 Summary:');
    console.log('=' .repeat(60));
    console.log(`   Total units in Excel: ${unitCodes.length}`);
    console.log(`   Valid units: ${validCodes.length} (${Math.round(validCodes.length / unitCodes.length * 100)}%)`);
    console.log(`   Invalid units: ${invalidUnits.length} (${Math.round(invalidUnits.length / unitCodes.length * 100)}%)`);

    // Step 4: Save valid units list for scraping
    const validListPath = 'valid-units.txt';
    fs.writeFileSync(validListPath, validCodes.join('\n'));
    console.log(`\n✅ Valid units list saved to: ${validListPath}`);

    console.log('\n' + '=' .repeat(60));
    console.log('✨ Validation Complete!');
    console.log('\nNext steps:');
    console.log('  - Review invalid-units.txt to check which units are not found');
    console.log('  - Use valid-units.txt as input for your scraper');
    console.log('  - Run scraper only on valid units for better performance');
    console.log('=' .repeat(60) + '\n');
}

main().catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
});
