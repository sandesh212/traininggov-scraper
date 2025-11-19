export type UocElement = {
  element: string;
  performanceCriteria: string[];
};

export interface Uoc {
  url: string;
  code: string;
  title: string;
  status?: string;
  release?: string;
  application?: string;
  unitSector?: string;
  licensingOrRegulatoryInfo?: string;
  prerequisites?: string[];
  elements?: UocElement[];
  foundationSkills?: string;
  assessmentConditions?: string;
  performanceEvidence?: string;
  knowledgeEvidence?: string;
  description?: string;
  supersededBy: { code: string; url: string } | null;
  supersedes: { code: string; url: string } | null;
  /**
   * Ordered hierarchical content sections extracted generically from headings (h2/h3/h4) and their following paragraphs & lists.
   * This captures raw structure for future Excel rendering or alternative exports without re-scraping.
   */
  sections?: UocSection[];
  lastFetchedAt: string;
}

export type UocSection = {
  heading: string;
  level: number; // 2 | 3 | 4 etc.
  paragraphs: string[];
  lists: string[][]; // each list is array of items (nested structure flattened)
};

export class UocModel {
    code: string;
    title: string;
    description: string;

    constructor(code: string, title: string, description: string) {
        this.code = code;
        this.title = title;
        this.description = description;
    }
}