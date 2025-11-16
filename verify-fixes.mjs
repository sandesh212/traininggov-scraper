import XLSX from 'xlsx-js-style';

const wb = XLSX.readFile('data/UnitsData.xlsx');

console.log('=== VERIFICATION REPORT ===\n');

// 1. Check Assessment Conditions sheet
console.log('1. Assessment Conditions Sheet:');
const ac = wb.Sheets['Assessment Conditions'];
if(ac){
  // Check first few rows for black fill
  for(let r=0; r<8; r++) {
    const unitCell = ac[XLSX.utils.encode_cell({r, c:0})];
    const condCell = ac[XLSX.utils.encode_cell({r, c:1})];
    const unit = unitCell?.v || '';
    const hasBlackFill = unitCell?.s?.fill?.fgColor?.rgb === '000000';
    const alignment = unitCell?.s?.alignment;
    if(!unit || unit === 'Unit') continue;
    console.log(`  Row ${r+1}: ${unit ? 'Unit' : 'BLANK'} | BlackFill=${hasBlackFill} | Align=${alignment?.vertical},${alignment?.horizontal}`);
  }
}

// 2. Check DMLA headers
console.log('\n2. DMLA Sheet Headers:');
const dmla = wb.Sheets['DMLA'];
if(dmla){
  const cat0 = dmla[XLSX.utils.encode_cell({r:0,c:6})]?.v || '';
  const cat1 = dmla[XLSX.utils.encode_cell({r:0,c:7})]?.v || '';
  console.log(`  Row 0 Col 6: "${cat0}"`);
  console.log(`  Row 0 Col 7: "${cat1}"`);
  console.log(`  Has categories: ${cat0.includes('Assessment') || cat1.includes('Assessment')}`);
}

// 3. Check LROCP Mapping
console.log('\n3. LROCP Mapping:');
const lrocp = wb.Sheets['LROCP Mapping'];
if(lrocp){
  const range = XLSX.utils.decode_range(lrocp['!ref']);
  console.log(`  Total rows: ${range.e.r + 1}`);
  const cat = lrocp[XLSX.utils.encode_cell({r:0,c:6})]?.v || '';
  console.log(`  Category header (col 6): "${cat}"`);
  // Count data rows
  let dataCount = 0;
  for(let r=2; r<=range.e.r; r++){
    const unit = lrocp[XLSX.utils.encode_cell({r,c:0})]?.v;
    if(unit) dataCount++;
  }
  console.log(`  Data rows with units: ${dataCount}`);
}

// 4. Check Navigation Mapping
console.log('\n4. Navigation Mapping Headers:');
const nav = wb.Sheets['Navigation Mapping'];
if(nav){
  const knowledge = nav[XLSX.utils.encode_cell({r:0,c:6})]?.v || '';
  const perf = nav[XLSX.utils.encode_cell({r:0,c:7})]?.v || '';
  console.log(`  Col 6 category: "${knowledge}"`);
  console.log(`  Col 7 category: "${perf}"`);
  console.log(`  Col 6 name: "${nav[XLSX.utils.encode_cell({r:1,c:6})]?.v}"`);
  console.log(`  Col 7 name: "${nav[XLSX.utils.encode_cell({r:1,c:7})]?.v}"`);
  console.log(`  Col 8 name: "${nav[XLSX.utils.encode_cell({r:1,c:8})]?.v}"`);
}

// 5. Check category colors
console.log('\n5. Category Header Colors:');
const ess = wb.Sheets['ESS Mapping'];
if(ess){
  const knowledgeCell = ess[XLSX.utils.encode_cell({r:0,c:6})];
  const perfCell = ess[XLSX.utils.encode_cell({r:0,c:9})];
  console.log(`  Knowledge bg: ${knowledgeCell?.s?.fill?.fgColor?.rgb}`);
  console.log(`  Knowledge font: ${knowledgeCell?.s?.font?.color?.rgb}`);
  console.log(`  Performance bg: ${perfCell?.s?.fill?.fgColor?.rgb}`);
  console.log(`  Performance font: ${perfCell?.s?.font?.color?.rgb}`);
}

// 6. Check freeze panes
console.log('\n6. Freeze Panes (Sticky Headers):');
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const freeze = ws['!freeze'];
  if(freeze) {
    console.log(`  ${name}: ySplit=${freeze.ySplit} (freezes top ${freeze.ySplit} rows)`);
  }
});

console.log('\n=== END REPORT ===');
