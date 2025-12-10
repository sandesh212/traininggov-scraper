// Quick test to check the new structure format
fetch('http://localhost:3000/api/units/SFIAQU402')
    .then(r => r.json())
    .then(unit => {
        console.log('\n=== SFIAQU402 Structure ===\n');
        console.log('Code:', unit.code);
        console.log('Title:', unit.title);
        console.log('\n--- Sections ---');
        console.log('Total sections:', unit.sections?.length || 0);
        
        if (unit.sections && unit.sections.length > 0) {
            // Show first few sections
            unit.sections.slice(0, 3).forEach((section, i) => {
                console.log(`\nSection ${i + 1}:`);
                console.log('  Heading:', section.heading);
                console.log('  Level:', section.level);
                console.log('  Paragraphs:', section.paragraphs?.length || 0);
                console.log('  Lists:', section.lists?.length || 0);
                console.log('  Subsections:', section.subsections?.length || 0);
                
                // Show first paragraph if exists
                if (section.paragraphs && section.paragraphs.length > 0) {
                    console.log('  First paragraph:', section.paragraphs[0].substring(0, 100) + '...');
                }
                
                // Show first list item if exists
                if (section.lists && section.lists.length > 0) {
                    console.log('  First list item:', section.lists[0].text.substring(0, 80) + '...');
                    if (section.lists[0].children && section.lists[0].children.length > 0) {
                        console.log('    Has', section.lists[0].children.length, 'child items');
                    }
                }
            });
            
            // Save full output
            require('fs').writeFileSync('sfiaqu402-structure.json', JSON.stringify(unit, null, 2));
            console.log('\n✅ Full data saved to sfiaqu402-structure.json');
        }
    })
    .catch(err => console.error('Error:', err.message));
