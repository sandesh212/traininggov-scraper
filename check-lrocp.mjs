import XLSX from 'xlsx-js-style';
const wb = XLSX.readFile('UnitsOfCompetency.xlsx');
const ws = wb.Sheets['LROCP Mapping'];
if (!ws) {
  console.log('No LROCP sheet found');
} else {
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log('LROCP Mapping units (first 15):');
  rows.slice(0, 15).forEach((r, i) => {
    const unit = r.Unit || '';
    if (unit) console.log(`${i+1}. ${unit}`);
  });
}
