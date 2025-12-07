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

export function generateUnitDataExcel(units: any[]) {
    const wb = XLSX.utils.book_new();

    // 1. Units Summary Sheet
    const summaryRows = [['Unit Code', 'Unit Title', 'Sector', 'Application', 'Description', 'Assessment Conditions', 'Modification History']];
    units.forEach(u => {
        summaryRows.push([
            u.code,
            u.title,
            u.unitSector || '',
            u.application || '',
            u.description || '',
            u.assessmentConditions || '',
            u.modificationHistory || ''
        ]);
    });
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [
        { wch: 15 }, // Code
        { wch: 40 }, // Title
        { wch: 20 }, // Sector
        { wch: 50 }, // Application
        { wch: 50 }, // Description
        { wch: 50 }, // Assessment Conditions
        { wch: 30 }  // History
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Units Summary");

    // 2. Elements & PC Sheet
    const pcRows = [['Unit Code', 'Element Title', 'PC ID', 'Performance Criteria']];
    units.forEach(u => {
        u.elements?.forEach((el: any) => {
            el.performanceCriteria.forEach((pc: any) => {
                pcRows.push([u.code, el.title, pc.id, pc.text]);
            });
        });
    });
    const wsPC = XLSX.utils.aoa_to_sheet(pcRows);
    wsPC['!cols'] = [
        { wch: 15 }, // Code
        { wch: 30 }, // Element
        { wch: 10 }, // ID
        { wch: 80 }  // Text
    ];
    XLSX.utils.book_append_sheet(wb, wsPC, "Elements & PC");

    // 3. Knowledge Evidence Sheet
    const keRows = [['Unit Code', 'Knowledge Evidence Item']];
    units.forEach(u => {
        if (u.knowledgeEvidence) {
            const lines = u.knowledgeEvidence.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
            lines.forEach((line: string) => {
                keRows.push([u.code, line]);
            });
        }
    });
    const wsKE = XLSX.utils.aoa_to_sheet(keRows);
    wsKE['!cols'] = [{ wch: 15 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsKE, "Knowledge Evidence");

    // 4. Performance Evidence Sheet
    const peRows = [['Unit Code', 'Performance Evidence Item']];
    units.forEach(u => {
        if (u.performanceEvidence) {
            const lines = u.performanceEvidence.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
            lines.forEach((line: string) => {
                peRows.push([u.code, line]);
            });
        }
    });
    const wsPE = XLSX.utils.aoa_to_sheet(peRows);
    wsPE['!cols'] = [{ wch: 15 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsPE, "Performance Evidence");

    XLSX.writeFile(wb, "Units_Data_Full.xlsx");
}
