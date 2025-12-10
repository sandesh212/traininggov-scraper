import { Unit, Element, Section, PerformanceCriteria } from '../types';
import { Uoc, UocElement, UocSection } from '../models/uoc';

export class UnitMapper {
    static toUoc(unit: Unit): Uoc {
        return {
            url: unit.url || `https://training.gov.au/Training/Details/${unit.code}`,
            code: unit.code,
            title: unit.title,
            status: unit.status,
            release: unit.release,
            application: unit.application || unit.description, // fallback
            unitSector: unit.unitSector,
            licensingOrRegulatoryInfo: undefined, // ScraperService doesn't explicitly separate this yet, mainly in description
            prerequisites: undefined, // ScraperService doesn't explicit parse prereqs yet
            elements: unit.elements ? unit.elements.map(e => this.toUocElement(e)) : [],
            foundationSkills: unit.foundationSkills,
            assessmentConditions: unit.assessmentConditions,
            performanceEvidence: unit.performanceEvidence,
            knowledgeEvidence: unit.knowledgeEvidence,
            description: unit.description,
            supersededBy: unit.supersededBy ? { code: unit.supersededBy, url: '' } : null,
            supersedes: unit.supersedes ? { code: unit.supersedes, url: '' } : null,
            sections: unit.sections ? unit.sections.map(s => this.toUocSection(s)) : [],
            lastFetchedAt: unit.lastFetchedAt || new Date().toISOString()
        };
    }

    private static toUocElement(element: Element): UocElement {
        return {
            element: element.title,
            performanceCriteria: element.performanceCriteria.map(pc => ({
                id: pc.id,
                text: pc.text
            }))
        };
    }

    private static toUocSection(section: Section): UocSection {
        // Flatten lists to simple string arrays (losing nesting structure unfortunately, unless we enhance UocSection)
        // UocSection lists is string[][].
        // Our Section.lists is ListItem[].

        const lists: string[][] = [];
        if (section.lists) {
            // We push one "list" (array of strings) per list encountered.
            // But Section.lists is an array of items (one list).
            // So we just have 1 list.
            const flatList = section.lists.map(item => item.text);
            if (flatList.length > 0) lists.push(flatList);
        }

        return {
            heading: section.heading,
            level: section.level,
            paragraphs: section.paragraphs,
            lists: lists
        };
    }

    static fromUoc(uoc: Uoc): Unit {
        return {
            code: uoc.code,
            title: uoc.title,
            url: uoc.url,
            status: uoc.status,
            release: uoc.release,
            description: uoc.description,
            application: uoc.application,
            unitSector: uoc.unitSector,
            modificationHistory: undefined, // Uoc doesn't have this explicitly
            foundationSkills: uoc.foundationSkills,
            elements: uoc.elements ? uoc.elements.map(e => this.fromUocElement(e)) : [],
            performanceEvidence: uoc.performanceEvidence || '',
            knowledgeEvidence: uoc.knowledgeEvidence || '',
            assessmentConditions: uoc.assessmentConditions || '',
            supersededBy: uoc.supersededBy?.code,
            supersedes: uoc.supersedes?.code,
            sections: uoc.sections ? uoc.sections.map(s => this.fromUocSection(s)) : [],
            lastFetchedAt: uoc.lastFetchedAt,
            dynamicSections: []
        };
    }

    private static fromUocElement(element: UocElement): Element {
        // performanceCriteria is already { id, text }[] in UocElement
        const pcs: PerformanceCriteria[] = element.performanceCriteria.map(pc => ({
            id: pc.id,
            text: pc.text
        }));

        return {
            title: element.element,
            performanceCriteria: pcs
        };
    }

    private static fromUocSection(section: UocSection): Section {
        return {
            heading: section.heading,
            level: section.level,
            paragraphs: section.paragraphs,
            lists: (section.lists || []).flat().map(text => ({ text })),
            subsections: []
        };
    }
}

