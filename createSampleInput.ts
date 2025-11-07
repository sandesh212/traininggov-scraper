import XLSX from 'xlsx';

// Create a sample input Excel with some unit codes
const data = [
  { 'Unit Code': 'MARK007' },
  { 'Unit Code': 'MARH013' },
  { 'Unit Code': 'BSBPMG430' },
  { 'Unit Code': 'BSBWHS411' },  // New unit to test
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Units');

XLSX.writeFile(wb, 'units-list.xlsx');
console.log('✅ Created units-list.xlsx with sample unit codes');
