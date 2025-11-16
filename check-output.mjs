import XLSX from 'xlsx-js-style';

const wb = XLSX.readFile('data/UnitsData.xlsx');
console.log('Sheets:', wb.SheetNames.join(', '));

function sheetInfo(name){
  const ws = wb.Sheets[name];
  if(!ws || !ws['!ref']) { console.log(name+': no data'); return; }
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`${name}: rows=${range.e.r+1}, cols=${range.e.c+1}`);
}

wb.SheetNames.forEach(sheetInfo);

console.log('\nAssessment Conditions preview:');
const ac = wb.Sheets['Assessment Conditions'];
if(ac){
  for(let r=0; r<12; r++) {
    const unit = ac[XLSX.utils.encode_cell({r, c:0})]?.v || '';
    const cond = ac[XLSX.utils.encode_cell({r, c:1})]?.v || '';
    console.log(`Row ${r+1}: Unit="${unit}" | Cond[0..80]="${String(cond).slice(0,80)}"`);
  }
}

console.log('\nLROCP Mapping headers:');
const lrocp = wb.Sheets['LROCP Mapping'];
if(lrocp){
  for(let c=6; c<=12; c++){
    const cat = lrocp[XLSX.utils.encode_cell({r:0,c})]?.v || '';
    const hdr = lrocp[XLSX.utils.encode_cell({r:1,c})]?.v || '';
    if(cat||hdr) console.log(`Col ${c}: cat="${cat}" hdr="${hdr}"`);
  }
}
