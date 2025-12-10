import { scraperService } from './web/src/services/scraperService.js';

async function testCompleteStructure() {
    console.log('Testing complete hierarchical structure extraction...\n');
    
    // Test with SFIAQU402 from user's example
    const testCode = 'SFIAQU402';
    
    console.log(`\n📋 Scraping ${testCode}...`);
    const unit = await scraperService.scrapeUnit(testCode);
    
    if (!unit) {
        console.error('❌ Failed to scrape unit');
        return;
    }
    
    console.log(`\n✅ Successfully scraped ${unit.code}: ${unit.title}`);
    console.log(`\n📊 Structure Summary:`);
    console.log(`   - Total sections: ${unit.sections?.length || 0}`);
    
    // Display detailed structure
    if (unit.sections && unit.sections.length > 0) {
        console.log(`\n📄 Section Details:`);
        displaySections(unit.sections, 0);
        
        // Save full JSON for inspection
        const fs = await import('fs');
        const outputPath = './test-output-complete-structure.json';
        fs.writeFileSync(outputPath, JSON.stringify(unit, null, 2));
        console.log(`\n💾 Full unit data saved to: ${outputPath}`);
    } else {
        console.log('\n⚠️  No sections found!');
    }
}

function displaySections(sections: any[], indent: number = 0) {
    const prefix = '  '.repeat(indent);
    
    for (const section of sections) {
        console.log(`${prefix}📌 ${section.heading} (Level ${section.level})`);
        console.log(`${prefix}   - Paragraphs: ${section.paragraphs?.length || 0}`);
        console.log(`${prefix}   - Lists: ${section.lists?.length || 0}`);
        
        // Show list structure
        if (section.lists && section.lists.length > 0) {
            displayLists(section.lists, indent + 2);
        }
        
        // Show subsections recursively
        if (section.subsections && section.subsections.length > 0) {
            console.log(`${prefix}   - Subsections: ${section.subsections.length}`);
            displaySections(section.subsections, indent + 1);
        }
    }
}

function displayLists(lists: any[], indent: number = 0) {
    const prefix = '  '.repeat(indent);
    
    for (const item of lists) {
        console.log(`${prefix}• ${item.text.substring(0, 60)}${item.text.length > 60 ? '...' : ''}`);
        if (item.children && item.children.length > 0) {
            displayLists(item.children, indent + 1);
        }
    }
}

testCompleteStructure().catch(console.error);
