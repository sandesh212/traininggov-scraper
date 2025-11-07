import { ExcelExportService } from './services/excelExportService.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx src/exportToExcel.ts <jsonl-file> [output-excel-name]');
    console.log('Example: npx tsx src/exportToExcel.ts data/uoc.jsonl UnitsOfCompetency.xlsx');
    process.exit(1);
  }

  const jsonlFile = args[0];
  const excelFile = args[1];

  const exporter = new ExcelExportService('data');
  await exporter.exportFromJsonl(jsonlFile, excelFile);

  console.log('✅ Export complete!');
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
