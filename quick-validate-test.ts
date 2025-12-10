import { UnitValidator } from './src/services/unitValidator.js';
import * as fs from 'fs';

const testCodes = ['ACMWHS401', 'SFIAQU101', 'BSBTWK201', 'ferfef', 'INVALID999'];

async function test() {
    console.log('Testing:', testCodes.join(', '));    console.log('\n
    console.log('\nStarting at:', new Date().toISOString());
    
    const validator = new UnitValidator();
    
    // Test with detailed output
    const startTime = Date.now();
    const results = await validator.validateUnits(testCodes, 1); // Process 1 at a time for clarity
    const endTime = Date.now();
    
    console.log('\  Total time:', ((endTime - startTime) / 1000).toFixed(2), 'seconds');n
    console.log('   Average per unit:', ((endTime - startTime) / testCodes.length / 1000).toFixed(2), 'seconds');
    
    console.log(\n VALID:', results.valid.length);
', v.url));
    
    console.log('\ INVALID:', results.invalid.length);n
', i.reason));
    
    console.log('\nEnded at:', new Date().toISOString());
}

test().catch(console.error);
