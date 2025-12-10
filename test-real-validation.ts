import { UnitValidator } from './src/services/unitValidator.js';

// Test with real units from the user's list + the invalid one
const testCodes = [
    'ACMWHS401',     // Valid from user's list
    'SFIAQU101',     // Valid from user's list
    'SFIFSH301',     // Valid from user's list
    'SISOSCB001',    // Valid from user's list
    'ferfef',        // Invalid - user's test case
    'INVALID999',    // Invalid - definitely doesn't exist
    'MARA022'        // Valid - known good unit
];

async function testValidation() {
    console.log('\n🧪 Testing Enhanced Validation Logic');
    console.log('=' .repeat(60));
    console.log('Testing', testCodes.length, 'units...\n');
    
    const validator = new UnitValidator();
    const results = await validator.validateUnits(testCodes, 3);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DETAILED RESULTS:');
    console.log('='.repeat(60));
    
    console.log('\n✅ VALID UNITS (' + results.valid.length + '):');
    results.valid.forEach(v => {
        console.log('   ✓', v.code);
    });
    
    console.log('\n❌ INVALID UNITS (' + results.invalid.length + '):');
    results.invalid.forEach(inv => {
        console.log('   ✗', inv.code);
        console.log('      Reason:', inv.reason);
        console.log('      URL:', inv.url);
        console.log('');
    });
    
    console.log('='.repeat(60));
    console.log('Test complete!\n');
}

testValidation().catch(console.error);
