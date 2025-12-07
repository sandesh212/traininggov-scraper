const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Define the Maritime units relevant to Coxswain Deck
const units = [
    {
        code: 'MARB032',
        title: 'Carry out hand tool operations',
        description: 'This unit involves the skills and knowledge required to carry out hand tool operations.',
        elements: '1. Select and use hand tools\n2. Maintain hand tools',
        performanceCriteria: '1.1 Selects appropriate hand tools\n1.2 Uses tools safely\n2.1 Cleans and stores tools',
        knowledgeEvidence: 'Types of hand tools, safety procedures, maintenance requirements',
        performanceEvidence: 'Demonstrated use of hammers, screwdrivers, wrenches',
        assessmentConditions: 'On board a vessel or simulated environment'
    },
    {
        code: 'MARC022',
        title: 'Rig lifting equipment',
        description: 'This unit involves the skills and knowledge required to rig lifting equipment.',
        elements: '1. Plan lifting operations\n2. Select lifting equipment\n3. Conduct lifting operations',
        performanceCriteria: '1.1 Determines weight of load\n1.2 Selects appropriate slings and shackles\n1.3 Checks WLL of equipment',
        knowledgeEvidence: 'Working Load Limits (WLL), Safe Working Loads (SWL), types of ropes and slings, lifting signals',
        performanceEvidence: 'Rigging a load, checking equipment tags, identifying defects',
        assessmentConditions: 'Access to lifting gear, loads, and crane/lifting device'
    },
    {
        code: 'MARB002',
        title: 'Handle ropes and mooring lines',
        description: 'This unit involves the skills and knowledge required to handle ropes and mooring lines.',
        elements: '1. Handle ropes\n2. Secure vessel',
        performanceCriteria: '1.1 Coils and stows ropes\n1.2 Ties common knots (reef, bowline, clove hitch)\n2.1 Secures vessel to wharf',
        knowledgeEvidence: 'Types of ropes (synthetic, natural), knot tying, mooring procedures, safety when handling lines',
        performanceEvidence: 'Tying knots, throwing heaving lines, securing a vessel',
        assessmentConditions: 'Vessel or simulated mooring facility'
    },
    {
        code: 'MARA011',
        title: 'Contribute to safe navigation',
        description: 'This unit involves the skills and knowledge required to contribute to safe navigation.',
        elements: '1. Keep a lookout\n2. Steer vessel',
        performanceCriteria: '1.1 Maintains effective lookout\n1.2 Reports hazards\n2.1 Steers vessel as directed',
        knowledgeEvidence: 'IALA buoyage system, collision regulations, sound signals, light characteristics',
        performanceEvidence: 'Keeping a lookout, identifying marks and lights',
        assessmentConditions: 'Vessel underway or simulator'
    },
    {
        code: 'MARA018',
        title: 'Apply work health and safety practices',
        description: 'This unit involves the skills and knowledge required to apply WHS practices.',
        elements: '1. Follow safe work practices\n2. Participate in WHS consultation',
        performanceCriteria: '1.1 Follows safety procedures\n1.2 Uses PPE correctly\n2.1 Reports hazards',
        knowledgeEvidence: 'WHS legislation, PPE requirements, risk assessment, hazard identification',
        performanceEvidence: 'Using PPE, identifying hazards, following emergency procedures',
        assessmentConditions: 'Workplace or simulated environment'
    },
    {
        code: 'MARF027',
        title: 'Apply basic survival skills in the event of vessel abandonment',
        description: 'This unit involves the skills and knowledge required to apply basic survival skills.',
        elements: '1. Abandon vessel\n2. Operate survival craft',
        performanceCriteria: '1.1 Don lifejacket\n1.2 Muster at station\n2.1 Board survival craft',
        knowledgeEvidence: 'Emergency signals, lifejacket types, hypothermia, survival techniques',
        performanceEvidence: 'Donning lifejacket, swimming in survival suit, boarding raft',
        assessmentConditions: 'Pool or sheltered water'
    },
    {
        code: 'MARF028',
        title: 'Follow procedures to minimise and fight fires on board a vessel',
        description: 'This unit involves the skills and knowledge required to fight fires on board.',
        elements: '1. Minimise fire risk\n2. Fight fires',
        performanceCriteria: '1.1 Maintains housekeeping\n2.1 Selects appropriate extinguisher\n2.2 Extinguishes fire',
        knowledgeEvidence: 'Classes of fire, types of extinguishers, fire triangle, fire prevention',
        performanceEvidence: 'Using extinguishers, fire blankets, hoses',
        assessmentConditions: 'Designated fire ground'
    }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(units);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, "Units");

// Write to file
const outputPath = path.join(__dirname, 'Maritime_Units.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Created Maritime_Units.xlsx at ${outputPath}`);
