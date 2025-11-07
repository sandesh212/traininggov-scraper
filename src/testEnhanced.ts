import { EnhancedExcelExportService } from './services/enhancedExcelService.js';

async function main() {
  const service = new EnhancedExcelExportService('data', 'UnitsData_Enhanced.xlsx');
  await service.exportFromJsonl('data/uoc.jsonl', 'UnitsData_Enhanced.xlsx', false);
  console.log('✅ Enhanced Excel with colors created!');
}

main().catch(console.error);
