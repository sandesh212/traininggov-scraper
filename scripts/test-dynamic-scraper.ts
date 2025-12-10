/**
 * Direct test of the scraper - no Next.js server needed
 * Just tests the scraping logic directly
 */

import scraperServiceModule from '../web/src/services/scraperService';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Handle both ESM and CJS
const ScraperService = (scraperServiceModule as any).ScraperService || (scraperServiceModule as any).default?.ScraperService || scraperServiceModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testUnits = ['MARH013', 'BSBTWK201'];

async function testDynamicScraping() {
    console.log('🔍 Testing Dynamic Scraping Directly\n');
    
    const scraper = new ScraperService();
    
    for (const unitCode of testUnits) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Testing: ${unitCode}`);
        console.log('='.repeat(80));
        
        try {
            const unit = await scraper.scrapeUnit(unitCode);
            
            console.log(`\n✅ Unit: ${unit.code} - ${unit.title}`);
            console.log(`\n📝 Basic Fields:`);
            console.log(`   Application: ${unit.application ? unit.application.substring(0, 100) + '...' : 'N/A'}`);
            console.log(`   Unit Sector: ${unit.unitSector || 'N/A'}`);
            console.log(`   Modification History: ${unit.modificationHistory ? 'Present (' + unit.modificationHistory.length + ' chars)' : 'N/A'}`);
            console.log(`   Foundation Skills: ${unit.foundationSkills ? 'Present (' + unit.foundationSkills.length + ' chars)' : 'N/A'}`);
            
            console.log(`\n🎯 Elements & Performance Criteria:`);
            console.log(`   Elements Count: ${unit.elements?.length || 0}`);
            unit.elements?.forEach((el, i) => {
                console.log(`   ${i + 1}. ${el.title} (${el.performanceCriteria?.length || 0} PCs)`);
            });
            
            console.log(`\n🧠 Assessment Information:`);
            console.log(`   Knowledge Evidence: ${unit.knowledgeEvidence ? unit.knowledgeEvidence.length + ' chars' : 'N/A'}`);
            console.log(`   Performance Evidence: ${unit.performanceEvidence ? unit.performanceEvidence.length + ' chars' : 'N/A'}`);
            console.log(`   Assessment Conditions: ${unit.assessmentConditions ? unit.assessmentConditions.length + ' chars' : 'N/A'}`);
            
            console.log(`\n📂 Dynamic Sections (ALL extracted sections):`);
            console.log(`   Total Sections: ${unit.dynamicSections?.length || 0}`);
            unit.dynamicSections?.forEach((section, i) => {
                const preview = section.content.substring(0, 60).replace(/\n/g, ' ');
                console.log(`   ${i + 1}. [H${section.level || '?'}] ${section.title}`);
                console.log(`      Preview: ${preview}...`);
            });
            
            // Save full JSON output
            const outputFile = resolve(__dirname, `..`, `test-output-${unitCode}.json`);
            writeFileSync(outputFile, JSON.stringify(unit, null, 2));
            console.log(`\n💾 Full JSON saved to: test-output-${unitCode}.json`);
            
        } catch (error) {
            console.error(`\n❌ Error scraping ${unitCode}:`, error.message);
        }
    }
    
    await ScraperService.closeSharedBrowser();
    console.log('\n✅ Testing complete!');
}

testDynamicScraping().catch(console.error);
