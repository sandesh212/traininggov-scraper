import { MaritimeExcelService } from './dist/src/services/maritimeExcelService.js';
const svc = new MaritimeExcelService('data','UnitsData.xlsx');
await svc.generateExcel();
console.log('Regenerated Excel with updated headers.');
