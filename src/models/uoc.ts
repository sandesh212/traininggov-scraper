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
  supersededBy: { code: string; url: string } | null;
  supersedes: { code: string; url: string } | null;
  lastFetchedAt: string;
}

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