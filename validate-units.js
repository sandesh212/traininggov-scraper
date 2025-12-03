// Script to validate CORRECT unit codes (without wrong suffixes)
const units = [
    'MARA022',
    'MARA024',
    'MARA025',
    'MARA004',
    'MARA005',
    'MARA007',
    'MARA008',
    'MARA009',
    'MARA010',
    'MARA011',
    'MARA014',
    'MARA015',
    'MARA016',
    'MARA017',
    'MARA018',
    'MARA019',
    'MARA020',
    'MARA021',
    'MARA023',
    'MARA026',
    'MARA027',
    'MARA028',
    'MARA029',
    'MARA030',
    'MARA031',
    'MARA032',
    'MARA033',
    'MARA034',
    'MARA035',
    'MARA036',
    'MARA037',
    'MARA038',
    'MARA039',
    'MARA040',
    'MARA041'
];

async function validateUnit(code) {
    try {
        const url = `https://training.gov.au/Training/Details/${code}`;
        const response = await fetch(url);
        const html = await response.text();

        // Check for common failure indicators
        if (response.status === 404) {
            return { code, valid: false, reason: 'HTTP 404 - Page not found', url };
        }

        if (html.toLowerCase().includes('page not found') ||
            html.toLowerCase().includes('404') ||
            html.toLowerCase().includes('no results found')) {
            return { code, valid: false, reason: 'Page contains 404/error indicators', url };
        }

        // Check if there's a title tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (!titleMatch || titleMatch[1].toLowerCase().includes('not found')) {
            return { code, valid: false, reason: 'No valid title found', url };
        }

        // Check for h1 with actual content
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (!h1Match || h1Match[1].trim().length === 0) {
            return { code, valid: false, reason: 'No title found on page (h1 element empty)', url };
        }

        // If we got here, it's likely valid
        return { code, valid: true, title: h1Match[1].trim(), url };

    } catch (error) {
        return { code, valid: false, reason: `Network error: ${error.message}`, url: `https://training.gov.au/Training/Details/${code}` };
    }
}

async function validateUnits() {
    console.log(`\n🔍 Validating ${units.length} CORRECTED unit codes (no suffixes)...\n`);

    const results = [];
    for (const code of units) {
        console.log(`   Checking ${code}...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        const result = await validateUnit(code);
        results.push(result);
    }

    const valid = results.filter(r => r.valid);
    const invalid = results.filter(r => !r.valid);

    console.log('\n✅ VALID UNITS:');
    console.log('================');
    valid.forEach(u => {
        console.log(`  ✓ ${u.code} - ${u.title || 'Valid'}`);
    });

    if (invalid.length > 0) {
        console.log('\n❌ INVALID UNITS:');
        console.log('==================');
        invalid.forEach(inv => {
            console.log(`  ✗ ${inv.code}`);
            console.log(`    Reason: ${inv.reason}`);
            console.log(`    URL: ${inv.url}`);
            console.log('');
        });
    }

    console.log('\n📊 SUMMARY:');
    console.log('============');
    console.log(`  Total: ${units.length}`);
    console.log(`  Valid: ${valid.length} (${Math.round(valid.length / units.length * 100)}%)`);
    console.log(`  Invalid: ${invalid.length} (${Math.round(invalid.length / units.length * 100)}%)`);

    if (valid.length === units.length) {
        console.log('\n🎉 ALL UNITS ARE VALID! ✅');
    }
}

validateUnits().catch(console.error);
