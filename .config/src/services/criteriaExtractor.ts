/**
 * Enhanced Criteria Extractor
 * 
 * Extracts ALL criteria types from units:
 * - PC: Performance Criteria
 * - PE: Performance Evidence
 * - KE: Knowledge Evidence
 * 
 * No more hardcoded unit lists!
 */

export interface UnitCriteria {
  unitCode: string;
  unitTitle: string;
  criteria: Array<{
    type: 'PC' | 'PE' | 'KE';
    element?: string;
    number?: string;
    text: string;
    fullReference: string; // e.g., "MARI003:PC:1.1.5" or "MARH013:KE:battery-maintenance"
  }>;
}

/**
 * Extract all criteria (PC, PE, KE) from loaded units
 */
export function extractAllCriteria(units: any[]): UnitCriteria[] {
  const results: UnitCriteria[] = [];
  
  units.forEach(unit => {
    const criteria: UnitCriteria['criteria'] = [];
    
    // 1. Extract Performance Criteria (PC)
    unit.elements?.forEach((el: any, elIdx: number) => {
      const elementText = el.element || el.title || '';
      const elementNumber = elementText.match(/^(\d+)/)?.[1] || String(elIdx + 1);
      
      (el.performanceCriteria || []).forEach((pc: string) => {
        const pcMatch = pc.match(/^([\d\.]+)\s+(.+)$/);
        if (pcMatch) {
          criteria.push({
            type: 'PC',
            element: elementNumber,
            number: pcMatch[1],
            text: pcMatch[2],
            fullReference: `${unit.code}:PC:${elementNumber}.${pcMatch[1]}`
          });
        }
      });
    });
    
    // 2. Extract Performance Evidence (PE)
    if (unit.performanceEvidence) {
      const peText = unit.performanceEvidence;
      
      // Split by bullet points or numbered lists
      const peItems = extractBulletPoints(peText);
      
      peItems.forEach((item, idx) => {
        criteria.push({
          type: 'PE',
          text: item,
          fullReference: `${unit.code}:PE:${idx + 1}`
        });
      });
    }
    
    // 3. Extract Knowledge Evidence (KE)
    if (unit.knowledgeEvidence) {
      const keText = unit.knowledgeEvidence;
      
      // Split by bullet points or numbered lists
      const keItems = extractBulletPoints(keText);
      
      keItems.forEach((item, idx) => {
        criteria.push({
          type: 'KE',
          text: item,
          fullReference: `${unit.code}:KE:${idx + 1}`
        });
      });
    }
    
    results.push({
      unitCode: unit.code,
      unitTitle: unit.title,
      criteria
    });
  });
  
  return results;
}

/**
 * Extract bullet points or numbered items from text
 */
function extractBulletPoints(text: string): string[] {
  if (!text) return [];
  
  // Split by common bullet patterns
  const patterns = [
    /•\s+/g,
    /◦\s+/g,
    /\n\d+\.\s+/g,
    /\n[a-z]\)\s+/g,
    /\n-\s+/g
  ];
  
  let items: string[] = [];
  
  // Try splitting by newlines first (cleanest)
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20); // Filter out very short items
  
  if (lines.length > 1) {
    items = lines;
  } else {
    // Fallback: try bullet patterns
    let split = [text];
    for (const pattern of patterns) {
      if (text.match(pattern)) {
        split = text.split(pattern).map(s => s.trim()).filter(s => s.length > 20);
        break;
      }
    }
    items = split;
  }
  
  // Clean up items
  return items.map(item => {
    // Remove leading bullets/numbers
    return item
      .replace(/^[•◦\-]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^[a-z]\)\s*/, '')
      .trim();
  }).filter(item => item.length > 10); // Must be meaningful
}

/**
 * Get all criteria as flat array for matching
 */
export function getAllCriteriaFlat(unitCriteria: UnitCriteria[]): Array<{
  unitCode: string;
  type: 'PC' | 'PE' | 'KE';
  text: string;
  reference: string;
}> {
  const flat: Array<{
    unitCode: string;
    type: 'PC' | 'PE' | 'KE';
    text: string;
    reference: string;
  }> = [];
  
  unitCriteria.forEach(unit => {
    unit.criteria.forEach(crit => {
      flat.push({
        unitCode: unit.unitCode,
        type: crit.type,
        text: crit.text,
        reference: crit.fullReference
      });
    });
  });
  
  return flat;
}

/**
 * Filter criteria by unit codes
 */
export function filterCriteriaByUnits(
  allCriteria: UnitCriteria[],
  unitCodes: string[]
): UnitCriteria[] {
  return allCriteria.filter(uc => unitCodes.includes(uc.unitCode));
}
