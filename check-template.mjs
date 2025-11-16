import XLSX from 'xlsx-js-style';

const wb = XLSX.readFile('UnitsOfCompetency.xlsx');

console.log('Template Sheets and Assessment Columns:\n');

wb.SheetNames.forEach(name => {
  if(name === 'Assessment Conditions') return;
  
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  console.log(`\n${name}:`);
  console.log('  Row 1 (Categories):');
  
  // Check row 1 (categories)
  for(let c=6; c<=range.e.c; c++){
    const addr = XLSX.utils.encode_cell({r:0,c});
    const cell = ws[addr];
    if(cell && cell.v) {
      console.log(`    Col ${String.fromCharCode(65+c)}: "${cell.v}"`);
    }
  }
  
  console.log('  Row 2 (Column Headers):');
  // Check row 2 (actual headers)
  for(let c=6; c<=range.e.c; c++){
    const addr = XLSX.utils.encode_cell({r:1,c});
    const cell = ws[addr];
    if(cell && cell.v) {
      console.log(`    Col ${String.fromCharCode(65+c)}: "${cell.v}"`);
    }
  }
});

console.log('\n\nChecking Assessment Conditions sheet:');
const acSheet = wb.Sheets['Assessment Conditions'];
if(acSheet) {
  const range = XLSX.utils.decode_range(acSheet['!ref']);
  console.log('First 10 rows:');
  for(let r=0; r<=Math.min(9, range.e.r); r++) {
    const unitCell = acSheet[XLSX.utils.encode_cell({r, c:0})];
    const condCell = acSheet[XLSX.utils.encode_cell({r, c:1})];
    console.log(`Row ${r+1}: Unit="${unitCell?.v||''}" | Conditions="${(condCell?.v||'').substring(0,50)}"`);
  }
}
