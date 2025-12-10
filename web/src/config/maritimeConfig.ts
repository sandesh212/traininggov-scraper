export interface SheetConfig {
    name: string;
    filterPrefixes?: string[];
    assessmentColumns: string[];
    // Extended properties for MaritimeExcelService
    mappingCountLabel: string;
    knowledgeColumns?: string[];
    showCategories?: boolean;
    hasAMPAConditions: boolean;
}

export const SHEET_CONFIGS: SheetConfig[] = [
    {
        name: 'ESS Mapping',
        hasAMPAConditions: true,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MARF'],
        assessmentColumns: [
            'Sea Survival Knowledge',
            'Fire Fighting at Sea Knowledge',
            'Fire Fighting at Sea - Classroom',
            'Sea Survival - Pool -Performance',
            'Fire fighting at Sea - The Lea - Performance '
        ],
        knowledgeColumns: [
            'Sea Survival Knowledge',
            'Fire Fighting at Sea Knowledge'
        ],
        showCategories: true
    },
    {
        name: 'Deck Mapping',
        hasAMPAConditions: true,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MARC', 'MARJ', 'MARI', 'MARK', 'MARN'],
        assessmentColumns: [
            'Knowledge Coxswain Deck ',
            'Seamanship Knowledge ',
            'Watchkeeping (Open book)',
            'Watchkeeping (Closed book)',
            'Vessel',
            'Classroom',
            'Readiness for assessment'
        ],
        knowledgeColumns: [
            'Knowledge Coxswain Deck ',
            'Seamanship Knowledge ',
            'Watchkeeping (Open book)',
            'Watchkeeping (Closed book)'
        ],
        showCategories: true
    },
    {
        name: 'Navigation Mapping',
        hasAMPAConditions: true,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MARH'],
        assessmentColumns: [
            'Symbols, Abbreviation, ENA, and Weather',
            'Passage Plan',
            'Vessel Passage'
        ],
        knowledgeColumns: [
            'Symbols, Abbreviation, ENA, and Weather',
            'Passage Plan'
        ],
        showCategories: true
    },
    {
        name: 'Engineering Mapping',
        hasAMPAConditions: true,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MARB'],
        assessmentColumns: [
            'Engineering',
            'Engineering Vessel',
            'Readiness for Assessment',
            'Work shop '
        ],
        knowledgeColumns: ['Engineering'],
        showCategories: true
    },
    {
        name: 'LROCP Mapping',
        hasAMPAConditions: false,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MARO', 'MARL'],
        assessmentColumns: [
            'Learners workbook question',
            'Workbook Classroom Activity',
            'Workbook Practical assessment '
        ],
        knowledgeColumns: ['Learners workbook question'],
        showCategories: true
    },
    {
        name: 'DMLA',
        hasAMPAConditions: false,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MAR'],
        assessmentColumns: [
            'Stability',
            'Machinery',
            'Machinery Practical',
            'Stability Practical',
            'Ropework'
        ],
        knowledgeColumns: ['Stability', 'Machinery'],
        showCategories: true
    },
    {
        name: 'Assessment Conditions',
        hasAMPAConditions: false,
        mappingCountLabel: 'Mapping Count',
        filterPrefixes: ['MAR'],
        assessmentColumns: [],
        knowledgeColumns: [],
        showCategories: false
    }
];
