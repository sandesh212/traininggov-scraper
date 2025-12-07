import * as XLSX from 'xlsx-js-style';
import { ReportData, Unit } from '@/types';

export const generateExcelReport = (report: ReportData, fileName: string = 'Mapping_Matrix.xlsx') => {
    // 1. Prepare Columns
    // Standard columns based on user request/screenshot
    const headers = [
        'Unit',
        'Element',
        'Criteria/Evidence',
        'Performance Criteria',
        'Assessment Conditions',
        'Mapping Count'
    ];

    // Dynamic Columns based on Sections found in the assessment
    // We treat each unique section as a potential mapping column
    const sections = new Set<string>();
    report.results.forEach(r => {
        if (r.questionSection) {
            sections.add(r.questionSection);
        } else {
            sections.add('General');
        }
    });

    const sortedSections = Array.from(sections).sort();

    // Map section names to column indices for easy lookup later
    const sectionColIndex: Record<string, number> = {};
    sortedSections.forEach((sec, idx) => {
        headers.push(sec); // Add section as header
        sectionColIndex[sec] = headers.length - 1;
    });

    // 2. Build Rows
    const dataRows: any[][] = [];

    // Filter units that are actually used/mapped? 
    // Usually a mapping matrix includes ALL criteria of the relevant units to show coverage/gaps.
    // So we iterate through ALL mapped units.
    const unitsToProcess = report.mappedUnits.length > 0 ? report.mappedUnits : (report.fetchedUnits || []);

    // If we have too many units (e.g. database dump), maybe fallback to mapped only?
    // User probably wants the units relevant to the assessment.
    // Let's use `report.mappedUnits` if available.

    const TARGET_UNITS = report.mappedUnits || [];

    TARGET_UNITS.forEach((unit: Unit) => {
        if (!unit.elements || unit.elements.length === 0) {
            // Handle units with no elements (e.g. scraped poorly or just codes)
            dataRows.push([
                `${unit.code} ${unit.title}`,
                'No Elements Found',
                '',
                unit.description || '',
                unit.assessmentConditions || '',
                0
            ]);
            return;
        }

        unit.elements.forEach(element => {
            element.performanceCriteria.forEach(pc => {
                const row = new Array(headers.length).fill('');

                // Static Data
                row[0] = `${unit.code} ${unit.title}`;
                row[1] = element.title;
                row[2] = pc.id;
                row[3] = pc.text;
                row[4] = unit.assessmentConditions; // can be long

                // Mapping Data
                // Find questions that map to this Unit AND this PC
                const relevantQuestions = report.results.filter(q =>
                    q.mappedUnit === unit.code &&
                    q.mappedCriteria.includes(pc.id)
                );

                row[5] = relevantQuestions.length; // Mapping Count

                // Distribute questions into section columns
                relevantQuestions.forEach(q => {
                    const sec = q.questionSection || 'General';
                    const colIdx = sectionColIndex[sec];
                    if (colIdx) {
                        const currentVal = row[colIdx];
                        // Append Question ID or Text
                        // Usually "Q1", "Q2" is preferred if IDs exist.
                        // Our IDs are internal GUIDs usually? 
                        // If parser preserved "Q1", "1", etc., we use it.
                        // Let's assume we want a formatted list.
                        const qLabel = q.questionId.length < 5 ? `Q${q.questionId}` : (q.questionText.slice(0, 100) + '...');

                        // Try to find a nice human label if possible (e.g. from text)
                        // If text starts with "1." use "Q1".
                        let label = q.questionText.substring(0, 30).replace(/\n/g, ' ');
                        const match = q.questionText.match(/^(\d+[\.]?)/);
                        if (match) label = `Q${match[1]}`;

                        row[colIdx] = currentVal ? `${currentVal}, ${label}` : label;
                    }
                });

                dataRows.push(row);
            });
        });
    });

    // 3. Styling
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Apply Styles (Auto-width, Header Bold, etc.)
    const wscols = headers.map(() => ({ wch: 20 }));
    wscols[0] = { wch: 40 }; // Unit
    wscols[1] = { wch: 30 }; // Element
    wscols[3] = { wch: 50 }; // PC Text
    ws['!cols'] = wscols;

    // Bold Headers
    for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4F46E5" } }, // Indigo-600
            alignment: { horizontal: "center", vertical: "center" }
        };
    }

    // Append Sheet
    XLSX.utils.book_append_sheet(wb, ws, "Compliance Matrix");

    // 4. Download
    XLSX.writeFile(wb, fileName);
};
