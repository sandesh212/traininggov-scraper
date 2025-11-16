import { MaritimeExcelService } from './src/services/maritimeExcelService.js';

const service = new MaritimeExcelService('data');
await service.generateExcel('UnitsData.xlsx');
console.log('✅ Excel regenerated successfully with clean data!');
