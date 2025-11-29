import * as XLSX from 'xlsx';
import { ReportData } from '../types';

export function generateExcelReport(report: ReportData) {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
        ['Compliance Report Summary'],
        ['Generated On', new Date().toLocaleString()],
        ['Total Questions', report.questionsCount],
        ['Mapped Units', report.mappedUnits.length],
        ['Compliance Rate', `${Math.round((report.results.filter(r => r.isValid).length / report.questionsCount) * 100)}%`],
        [],
        ['Mapped Units List'],
        ...report.mappedUnits.map(u => [u.code, u.title])
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // 2. Detailed Findings Sheet
    const findingsData = [
        ['Question ID', 'Question Text', 'Status', 'Confidence', 'Mapped Unit', 'Mapped Criteria', 'Mapped Knowledge', 'Reasoning'],
        ...report.results.map(r => [
            r.questionId,
            r.questionText || '',
            r.isValid ? 'Compliant' : 'Non-Compliant',
            `${r.confidence}%`,
            r.mappedUnit || 'None',
            r.mappedCriteria.join(', '),
            r.mappedKnowledge?.join(', ') || '',
            r.reasoning
        ])
    ];
    const wsFindings = XLSX.utils.aoa_to_sheet(findingsData);
    // Set column widths
    wsFindings['!cols'] = [
        { wch: 10 }, // ID
        { wch: 50 }, // Text
        { wch: 15 }, // Status
        { wch: 10 }, // Confidence
        { wch: 15 }, // Unit
        { wch: 20 }, // Criteria
        { wch: 30 }, // Knowledge
        { wch: 50 }  // Reasoning
    ];
    XLSX.utils.book_append_sheet(wb, wsFindings, "Detailed Findings");

    // 3. Matrix Sheet (Pivot-like)
    const matrixRows: any[] = [['Unit', 'Element', 'Criteria', 'Performance Criteria', 'Mapping Count', 'Mapped Questions']];

    report.mappedUnits.forEach(unit => {
        // Elements/PC
        unit.elements?.forEach(el => {
            el.performanceCriteria.forEach(pc => {
                const mappedQsList = report.results
                    .filter(r => r.mappedUnit === unit.code && r.mappedCriteria.includes(pc.id))
                    .map(r => r.questionId);

                const count = mappedQsList.length;
                const mappedQs = mappedQsList.join(', ');

                matrixRows.push([
                    `${unit.code} ${unit.title}`,
                    el.title, // Use title instead of id
                    pc.id,
                    pc.text,
                    count,
                    mappedQs
                ]);
            });
        });

        // Knowledge Evidence Parsing
        if (unit.knowledgeEvidence) {
            const rawLines = unit.knowledgeEvidence.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
            const keItems: string[] = [];

            let currentItem = "";

            rawLines.forEach(line => {
                const startsWithBlackBullet = line.startsWith('•');
                const startsWithWhiteBullet = line.startsWith('◦');

                const previousImpliesList = currentItem.trim().endsWith(':') ||
                    currentItem.trim().toLowerCase().endsWith('including') ||
                    currentItem.trim().toLowerCase().endsWith('including:');

                const isContinuation = startsWithWhiteBullet || (previousImpliesList && !startsWithBlackBullet);
                const isNewItem = startsWithBlackBullet || (!isContinuation && currentItem.length > 0);

                if (currentItem && isContinuation) {
                    currentItem += "\n" + line;
                } else if (isNewItem) {
                    if (currentItem) keItems.push(currentItem);
                    currentItem = line;
                } else {
                    if (currentItem) currentItem += "\n" + line;
                    else currentItem = line;
                }
            });
            if (currentItem) keItems.push(currentItem);

            keItems.forEach((text, idx) => {
                const kId = `K${idx + 1}`;
                const mappedQsList = report.results
                    .filter(r => r.mappedUnit === unit.code && r.mappedKnowledge?.some(mk => mk.startsWith(`${kId}:`)))
                    .map(r => r.questionId);

                const count = mappedQsList.length;
                const mappedQs = mappedQsList.join(', ');

                matrixRows.push([
                    `${unit.code} ${unit.title}`,
                    'Knowledge Evidence',
                    kId,
                    text,
                    count,
                    mappedQs
                ]);
            });
        }
    });

    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
    wsMatrix['!cols'] = [
        { wch: 40 }, // Unit
        { wch: 20 }, // Element
        { wch: 10 }, // Criteria
        { wch: 80 }, // Text (Wide)
        { wch: 15 }, // Count
        { wch: 30 }  // Mapped Qs
    ];
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Mapping Matrix");

    // Write file
    XLSX.writeFile(wb, "Compliance_Report.xlsx");
}

export function generateUnitDataExcel(units: ReportData['mappedUnits']) {
    const wb = XLSX.utils.book_new();
    const rows = [['Unit Code', 'Unit Title', 'Type', 'ID', 'Text']];

    units.forEach(unit => {
        // Performance Criteria
        unit.elements?.forEach(el => {
            el.performanceCriteria.forEach(pc => {
                rows.push([unit.code, unit.title, 'Performance Criteria', pc.id, pc.text]);
            });
        });

        // Knowledge Evidence
        if (unit.knowledgeEvidence) {
            // Simple parsing for Excel export (flat list)
            const lines = unit.knowledgeEvidence.split('\n').map(l => l.trim()).filter(l => l);
            lines.forEach((line, i) => {
                rows.push([unit.code, unit.title, 'Knowledge Evidence', `K${i + 1}`, line]);
            });
        }

        // Performance Evidence
        if (unit.performanceEvidence) {
            const lines = unit.performanceEvidence.split('\n').map(l => l.trim()).filter(l => l);
            lines.forEach((line, i) => {
                rows.push([unit.code, unit.title, 'Performance Evidence', `PE${i + 1}`, line]);
            });
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 15 }, // Unit Code
        { wch: 40 }, // Unit Title
        { wch: 20 }, // Type
        { wch: 10 }, // ID
        { wch: 80 }  // Text
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Units Data");
    XLSX.writeFile(wb, "Units_Data.xlsx");
}
