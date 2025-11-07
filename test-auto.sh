#!/bin/bash

# Quick test of the automatic scraper
echo "=== TESTING AUTOMATIC SCRAPER ==="
echo ""

# Create a test input file with just 2 units
cat > Units.xlsx.test << 'EOF'
We'll use the existing Units.xlsx
EOF

echo "Testing with existing Units.xlsx..."
echo ""

# Run with just a dry-run to test the logic
npx tsx -e "
import { syncUnits } from './src/autoSync.js';

(async () => {
  try {
    console.log('🧪 Testing automatic sync...\n');
    
    const result = await syncUnits({
      inputExcel: 'Units.xlsx',
      inputColumn: '',
      outputExcel: 'UnitsData_Test.xlsx',
      dataDir: 'data-test',
      maxRetries: 1,
      retryDelay: 1000,
      autoRetry: true
    });
    
    console.log('\n📊 Test Result:');
    console.log('   Success:', result.success);
    console.log('   Valid:', result.validCount);
    console.log('   Invalid:', result.invalidCount);
    console.log('   Errors:', result.errorCount);
    console.log('   Retries:', result.retryCount);
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
})();
"
