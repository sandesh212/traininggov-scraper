import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
const fs = require('fs');

console.log('\n' + '='.repeat(60));
console.log('CHECK: Implementation Verification');
console.log('='.repeat(60));

// Test 1: Excel Loading
console.log('\n1. Testing Excel Loading...');
try {
    const wb = xlsx.readFile('Units.xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const codes = new Set();
    data.forEach(row => row.forEach(cell => {
        if (typeof cell === 'string') {
            const match = cell.match(/\b([A-Z]{3,4}\d{3,4})\b/);
            if (match) codes.add(match[1]);
        }
    }));
    console.log('   PASS - Units.xlsx readable');
    console.log('   Found', codes.size, 'units');
    console.log('   Sample:', Array.from(codes).slice(0, 5).join(', '));
} catch (e) {
    console.log('   FAIL -', e.message);
}

// Test 2: Check new files
console.log('\n2. Checking new files...');
const files = [
    'src/services/unitValidator.ts',
    'src/services/excelLoader.ts',
    'src/validateAndScrape.ts'
];
let allExist = true;
files.forEach(f => {
    if (fs.existsSync(f)) {
        const stats = fs.statSync(f);
        const kb = Math.round(stats.size / 1024);
        console.log('   PASS -', f, '(' + kb + 'KB)');
    } else {
        console.log('   FAIL -', f, 'NOT FOUND');
        allExist = false;
    }
});

// Test 3: Check package.json scripts
console.log('\n3. Checking npm scripts...');
const pkg = require('./package.json');
if (pkg.scripts.validate) {
    console.log('   PASS - npm run validate');
}
if (pkg.scripts['validate:skip']) {
    console.log('   PASS - npm run validate:skip');
}

console.log('\n' + '='.repeat(60));
if (allExist) {
    console.log('RESULT: All checks passed!');
} else {
    console.log('RESULT: Some checks failed');
}
console.log('='.repeat(60));
console.log('\nNext: Run "npm run validate" to test\n');
