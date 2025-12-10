/**
 * Test hierarchical structure extraction
 */

async function testHierarchicalStructure() {
    console.log('🔍 Testing Hierarchical Structure Extraction\n');
    
    const unitCode = 'BSBTWK201';
    
    try {
        console.log(`Fetching ${unitCode}...`);
        const response = await fetch(`http://localhost:3000/api/scrape?code=${unitCode}`);
        
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`);
            return;
        }
        
        const unit = await response.json();
        
        console.log(`\n✅ Unit: ${unit.code} - ${unit.title}\n`);
        console.log(`Total Top-Level Sections: ${unit.dynamicSections?.length || 0}\n`);
        
        // Function to display hierarchical structure
        function displaySection(section: any, indent: string = '') {
            console.log(`${indent}[H${section.level}] ${section.title}`);
            
            if (section.content && section.content.length > 0) {
                const preview = section.content.substring(0, 80).replace(/\n/g, ' ');
                console.log(`${indent}  Content: ${preview}${section.content.length > 80 ? '...' : ''}`);
            }
            
            // Display bullet points
            if (section.bulletPoints && section.bulletPoints.length > 0) {
                console.log(`${indent}  Bullet Points: ${section.bulletPoints.length}`);
                section.bulletPoints.forEach((bp: any, i: number) => {
                    if (i < 3) { // Show first 3
                        displayBulletPoint(bp, indent + '    ');
                    }
                });
                if (section.bulletPoints.length > 3) {
                    console.log(`${indent}    ... and ${section.bulletPoints.length - 3} more`);
                }
            }
            
            // Display children sections
            if (section.children && section.children.length > 0) {
                console.log(`${indent}  Children: ${section.children.length} sub-sections`);
                section.children.forEach((child: any) => {
                    displaySection(child, indent + '  ');
                });
            }
        }
        
        function displayBulletPoint(bp: any, indent: string = '') {
            const text = bp.text.substring(0, 60);
            console.log(`${indent}• ${text}${bp.text.length > 60 ? '...' : ''}`);
            if (bp.children && bp.children.length > 0) {
                bp.children.forEach((child: any, i: number) => {
                    if (i < 2) { // Show first 2 children
                        displayBulletPoint(child, indent + '  ');
                    }
                });
                if (bp.children.length > 2) {
                    console.log(`${indent}  ... and ${bp.children.length - 2} more children`);
                }
            }
        }
        
        // Display first 5 sections
        console.log('📂 Section Hierarchy:\n');
        unit.dynamicSections?.slice(0, 5).forEach((section: any) => {
            displaySection(section);
            console.log('');
        });
        
        if (unit.dynamicSections && unit.dynamicSections.length > 5) {
            console.log(`... and ${unit.dynamicSections.length - 5} more top-level sections\n`);
        }
        
        // Count total nested items
        function countAll(section: any): { sections: number; bullets: number } {
            let sections = 1;
            let bullets = section.bulletPoints?.length || 0;
            
            if (section.children) {
                section.children.forEach((child: any) => {
                    const counts = countAll(child);
                    sections += counts.sections;
                    bullets += counts.bullets;
                });
            }
            
            if (section.bulletPoints) {
                section.bulletPoints.forEach((bp: any) => {
                    bullets += countBullets(bp);
                });
            }
            
            return { sections, bullets };
        }
        
        function countBullets(bp: any): number {
            let count = 0;
            if (bp.children) {
                count += bp.children.length;
                bp.children.forEach((child: any) => {
                    count += countBullets(child);
                });
            }
            return count;
        }
        
        const totals = { sections: 0, bullets: 0 };
        unit.dynamicSections?.forEach((section: any) => {
            const counts = countAll(section);
            totals.sections += counts.sections;
            totals.bullets += counts.bullets;
        });
        
        console.log(`\n📊 Total Statistics:`);
        console.log(`   Total Sections (all levels): ${totals.sections}`);
        console.log(`   Total Bullet Points (all levels): ${totals.bullets}`);
        console.log(`   Elements: ${unit.elements?.length || 0}`);
        console.log(`   Knowledge Evidence: ${unit.knowledgeEvidence?.length || 0} chars`);
        console.log(`   Performance Evidence: ${unit.performanceEvidence?.length || 0} chars`);
        console.log(`   Assessment Conditions: ${unit.assessmentConditions?.length || 0} chars`);
        
        // Save to file
        const fs = require('fs');
        fs.writeFileSync(
            `/Users/sandeshkumar/Downloads/traininggov-scraper/test-hierarchical-${unitCode}.json`,
            JSON.stringify(unit, null, 2)
        );
        console.log(`\n💾 Full hierarchical data saved to: test-hierarchical-${unitCode}.json`);
        
    } catch (error: any) {
        console.error(`\n❌ Error:`, error.message);
    }
}

testHierarchicalStructure().catch(console.error);
