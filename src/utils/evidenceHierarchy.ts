/**
 * Utility to parse evidence text (bulleted/indented) into a nested structure.
 * Handles:
 * - Top-level points (e.g., K1, P1, etc.)
 * - Sub-points (bullets, indented lines) nested under their parent
 *
 * Example input:
 * Types, characteristics and functions of:
 *   - equipment or tools used in cleaning and maintenance
 *   - vessel machinery and equipment
 *
 * Output:
 * [
 *   {
 *     text: 'Types, characteristics and functions of:',
 *     children: [
 *       { text: 'equipment or tools used in cleaning and maintenance' },
 *       { text: 'vessel machinery and equipment' }
 *     ]
 *   }
 * ]
 */
export interface EvidenceNode {
  text: string;
  children?: EvidenceNode[];
}

export function parseEvidenceHierarchy(evidence: string): EvidenceNode[] {
  const lines = evidence.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result: EvidenceNode[] = [];
  let current: EvidenceNode | null = null;

  for (const line of lines) {
    // Bullet or indented sub-point
    if (/^[-•*]\s+/.test(line) || /^\s{2,}/.test(line)) {
      if (current) {
        if (!current.children) current.children = [];
        current.children.push({ text: line.replace(/^[-•*]\s+/, '').trim() });
      } else {
        // Orphan bullet, treat as top-level
        result.push({ text: line.replace(/^[-•*]\s+/, '').trim() });
      }
    } else {
      // New top-level point
      current = { text: line };
      result.push(current);
    }
  }
  return result;
}
