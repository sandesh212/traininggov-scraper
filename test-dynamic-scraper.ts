import { ScraperService } from './web/src/services/scraperService.js';

async function testDynamicScraping() {
    console.log('🔍 Testing Dynamic Scraping on Sample URLs\n');
    
    const scraper = new ScraperService();
    const testUnits = ['MARH013', 'BSBTWK201'];
    
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
            console.log(`   Modification History: ${unit.modificationHistory ? 'Present' : 'N/A'}`);
            console.log(`   Foundation Skills: ${unit.foundationSkills ? 'Present' : 'N/A'}`);
            
            console.log(`\n🎯 Elements & Performance Criteria:`);
            console.log(`   Elements Count: ${unit.elements.length}`);
            unit.elements.forEach((el, i) => {
                console.log(`   ${i + 1}. ${el.title} (${el.performanceCriteria.length} PCs)`);
            });
            
            console.log(`\n🧠 Assessment Information:`);
            console.log(`   Knowledge Evidence: ${unit.knowledgeEvidence ? unit.knowledgeEvidence.length + ' chars' : 'N/A'}`);
            console.log(`   Performance Evidence: ${unit.performanceEvidence ? unit.performanceEvidence.length + ' chars' : 'N/A'}`);
            console.log(`   Assessment Conditions: ${unit.assessmentConditions ? unit.assessmentConditions.length + ' chars' : 'N/A'}`);
            
            console.log(`\n📂 Dynamic Sections (ALL extracted sections):`);
            console.log(`   Total Sections: ${unit.dynamicSections?.length || 0}`);
            unit.dynamicSections?.forEach((section, i) => {
                const preview = section.content.substring(0, 60).replace(/\n/g, ' ');
                console.log(`   ${i + 1}. [H${section.level}] ${section.title}`);
                console.log(`      Content: ${preview}...`);
            });
            
            // Save full JSON output
            const fs = require('fs');
            const outputFile = `/Users/sandeshkumar/Downloads/traininggov-scraper/test-output-${unitCode}.json`;
            fs.writeFileSync(outputFile, JSON.stringify(unit, null, 2));
            console.log(`\n💾 Full JSON saved to: test-output-${unitCode}.json`);
            
        } catch (error: any) {
            console.error(`\n❌ Error scraping ${unitCode}:`, error.message);
        }
    }
    
    await scraper.closeBrowser();
    console.log('\n✅ Testing complete!');
}

testDynamicScraping().catch(console.error);
