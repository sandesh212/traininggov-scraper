const XLSX = require('xlsx');
const wb = XLSX.utils.book_new();
const ws_data = [
    ["Unit Code"],
    ["MARN008"],
    ["MARJ006"],
    ["MARK007"],
    ["MARC037"],
    ["MARI003"]
];
const ws = XLSX.utils.aoa_to_sheet(ws_data);
XLSX.utils.book_append_sheet(wb, ws, "Units");
XLSX.writeFile(wb, "Units_List_Sample.xlsx");
console.log("Created Units_List_Sample.xlsx");
