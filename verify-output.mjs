import XLSX from 'xlsx-js-style';

const wb = XLSX.readFile('data/UnitsData.xlsx');

console.log('=== Verification Report ===\n');

// Check each mapping sheet for category headers
['ESS Mapping', 'Deck Mapping', 'Navigation Mapping', 'Engineering Mapping', 'LROCP Mapping', 'DMLA'].forEach(name => {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`${name}: MISSING`); return; }
  
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`\n${name}:`);
  console.log(`  Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);
  console.log(`  Freeze panes: ${ws['!freeze'] ? `ySplit=${ws['!freeze'].ySplit}` : 'NONE'}`);
  
  // Check category headers (row 0, cols 6+)
  console.log('  Category headers (row 0):');
  for (let c = 6; c <= Math.min(range.e.c, 12); c++) {
    const cell = ws[XLSX.utils.encode_cell({r:0, c})];
    if (cell?.v) {
      const style = cell.s || {};
      const bgColor = style.fill?.fgColor?.rgb || 'none';
      const fontColor = style.font?.color?.rgb || 'default';
      console.log(`    Col ${c}: "${cell.v}" (bg:${bgColor}, font:${fontColor})`);
    }
  }
  
  // Check column headers (row 1, cols 6+)
  console.log('  Column headers (row 1):');
  for (let c = 6; c <= Math.min(range.e.c, 12); c++) {
    const cell = ws[XLSX.utils.encode_cell({r:1, c})];
    if (cell?.v) {
      const style = cell.s || {};
      const fontColor = style.font?.color?.rgb || 'default';
      console.log(`    Col ${c}: "${cell.v}" (font:${fontColor})`);
    }
  }
});

// Check Assessment Conditions sheet
console.log('\n\nAssessment Conditions sheet:');
const ac = wb.Sheets['Assessment Conditions'];
if (ac) {
  const range = XLSX.utils.decode_range(ac['!ref']);
  console.log(`  Rows: ${range.e.r + 1}`);
  console.log(`  Freeze panes: ${ac['!freeze'] ? `ySplit=${ac['!freeze'].ySplit}` : 'NONE'}`);
  
  // Check header styling
  const h0 = ac['A1'];
  if (h0?.s) {
    console.log(`  Header bg color: ${h0.s.fill?.fgColor?.rgb || 'none'}`);
  }
  
  // Check first few rows for blank separators
  console.log('  First 8 rows:');
  for (let r = 0; r < 8; r++) {
    const unitCell = ac[XLSX.utils.encode_cell({r, c:0})];
    const condCell = ac[XLSX.utils.encode_cell({r, c:1})];
    const unit = unitCell?.v || '';
    const isBlank = !unit && (!condCell?.v);
    const bgColor = unitCell?.s?.fill?.fgColor?.rgb || 'none';
    console.log(`    Row ${r}: "${String(unit).slice(0,40)}" blank=${isBlank} bg=${bgColor}`);
  }
}

console.log('\n=== End Report ===');
