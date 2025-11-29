const xlsx = require('xlsx');

// Create a sample Excel file with unit codes
const data = [
    ['Unit Code', 'Unit Title'],
    ['MARN008', 'Prepare and monitor a passage plan for a vessel up to 12 metres'],
    ['MARB027', 'Service and maintain propulsion machinery and auxiliary equipment']
];

const ws = xlsx.utils.aoa_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Units');

xlsx.writeFile(wb, 'sample-units.xlsx');
console.log('Created sample-units.xlsx');
