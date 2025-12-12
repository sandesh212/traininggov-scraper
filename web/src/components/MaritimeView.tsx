import React, { useState, useEffect } from 'react';
import { Unit } from '../types';
import { Download, Loader2 } from 'lucide-react';

import { SHEET_CONFIGS, SheetConfig } from '../config/maritimeConfig';

interface MaritimeViewProps {
    onClose?: () => void;
    isEmbedded?: boolean;
    selectedUnit?: Unit | null;
}

export function MaritimeView({ onClose, isEmbedded = false, selectedUnit }: MaritimeViewProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedUnit) {
            setUnits([selectedUnit]);
        } else {
            setUnits([]);
        }
    }, [selectedUnit]);

    useEffect(() => {
        if (!selectedUnit && !isEmbedded) {
            fetch('/api/units?full=true')
                .then(res => res.json())
                .then(data => setUnits(data.units || []))
                .catch(console.error);
        }
    }, [selectedUnit, isEmbedded]);

    // Determine the best config for the selected unit
    const activeConfig = React.useMemo(() => {
        if (!selectedUnit) return SHEET_CONFIGS[0];

        // Find specific mapping category
        const match = SHEET_CONFIGS.find(cfg =>
            cfg.name !== 'Assessment Conditions' &&
            cfg.filterPrefixes?.some(p => selectedUnit.code.toUpperCase().startsWith(p))
        );

        // Default to DMLA (catch-all) or first available
        return match || SHEET_CONFIGS.find(c => c.name === 'DMLA') || SHEET_CONFIGS[0];
    }, [selectedUnit]);

    const getUnitsForSheet = (config: SheetConfig, allUnits: Unit[], usedCodes: Set<string>) => {
        if (config.name === 'Assessment Conditions') return allUnits;

        return allUnits.filter(u => {
            const code = u.code.toUpperCase();
            if (usedCodes.has(code)) return false;

            // If a specific unit is selected, show it in the ACTIVE config regardless of filter
            // This allows 'Other' units to be viewed in the default/fallback config
            if (selectedUnit) return true;

            if (config.filterPrefixes) {
                return config.filterPrefixes.some(p => code.startsWith(p));
            }
            return true;
        }).sort((a, b) => a.code.localeCompare(b.code));
    };

    const parseEvidence = (text: string) => {
        if (!text) return [];
        const lines = text.split('\n').filter(l => l.trim());
        const groups: { type: 'text' | 'list'; title: string; items: { text: string; level: number }[] }[] = [];
        let currentGroup: { type: 'text' | 'list'; title: string; items: { text: string; level: number }[] } | null = null;

        lines.forEach(line => {
            // Check for indentation level based on leading spaces or specific markers
            // 2 spaces or [L1] = level 1
            // 4 spaces or [L2] = level 2
            let level = 0;
            if (line.startsWith('    ') || line.startsWith('\t\t') || /^\[L2\]/.test(line)) level = 2;
            else if (line.startsWith('  ') || line.startsWith('\t') || /^\[L1\]/.test(line)) level = 1;

            const trimmedLine = line.trim();

            // Clean content markers
            // We recognize standard bullets: -, •, *, [L*], digit.
            const isBullet = /^(\[L\d+\]|[•◦\-\*]|\d+\.)/.test(trimmedLine);
            const cleanContent = trimmedLine.replace(/^(\[L\d+\]|[•◦\-\*]|\d+\.)\s*/, '').trim();

            if (!cleanContent) return;

            if (isBullet) {
                // It's a list item
                if (currentGroup && currentGroup.type === 'list') {
                    // Start new group if we hit a top-level bullet (Level 0) AND we are currently deep? 
                    // No, usually assume continuous list. 
                    // BUT if we hit a numbering "1." and we were validly iterating, maybe new item?
                    // For now, assume single massive list for specific sections like PE/KE is fine, 
                    // unless we detect a major header change (which text extractor usually splits).

                    // Allow indentation override: If the line *looked* like a top level bullet (e.g. "• Item") 
                    // but had leading spaces, respect the spaces.
                    currentGroup.items.push({ text: cleanContent, level });
                } else {
                    // Start new list group
                    currentGroup = { type: 'list', title: '', items: [{ text: cleanContent, level }] };
                    groups.push(currentGroup);
                }
            } else {
                // Text line (Header or Paragraph)
                // If it's a short text line followed by bullets, it's a title.
                // If we are in a text group, append? 
                if (currentGroup && currentGroup.type === 'text') {
                    // Append as new paragraph or same?
                    // New generic item
                    currentGroup.items.push({ text: cleanContent, level: 0 });
                } else {
                    // New text group (or title)
                    currentGroup = { type: 'text', title: cleanContent, items: [] };
                    groups.push(currentGroup);
                }
            }
        });
        return groups;
    };

    const renderEvidenceSection = (title: string, content: string | undefined, contentHtml: string | undefined | null, colorClass: string, options: { prefix?: string, style?: 'numbered' | 'bullet' } = { style: 'numbered' }) => {
        if (!content && !contentHtml) return null;

        if (contentHtml) {
            return (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        <span className={`w-1 h-4 ${colorClass} rounded-full`}></span>
                        {title}
                    </h4>
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none pl-3 border-l border-slate-100 dark:border-slate-800
                                   prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-400
                                   prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed
                                   prose-headings:text-slate-800 dark:prose-headings:text-slate-100
                                   prose-td:align-top prose-td:p-2 prose-td:border prose-td:border-slate-200 dark:prose-td:border-slate-700
                                   prose-th:p-2 prose-th:bg-slate-50 dark:prose-th:bg-slate-800"
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </div>
            );
        }

        const groups = parseEvidence(content!);
        let listCount = 0;

        return (
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-1 h-4 ${colorClass} rounded-full`}></span>
                    {title}
                </h4>
                <div className="space-y-4 pl-3 border-l border-slate-100 dark:border-slate-800">
                    {groups.map((group, i) => {
                        const isList = group.type === 'list';
                        if (isList && group.title) {
                            // If a list group has a title (from previous logic), treat it as Header + List
                        }

                        // Determine marker
                        let mainMarker: React.ReactNode = null;
                        if (isList && !group.title) {
                            // If it's a pure list group without a header
                            // We don't render a main marker for the GROUP, we render markers for ITEMS.
                        } else if (isList && group.title) {
                            listCount++;
                            if (options.style === 'bullet') {
                                mainMarker = <span className="text-slate-400 text-lg leading-none">•</span>;
                            } else {
                                mainMarker = <span className="text-xs font-mono font-bold text-slate-400">{options.prefix}{listCount}.</span>;
                            }
                        }

                        return (
                            <div key={i} className="flex gap-4 items-start">
                                {/* Only show Group Marker if it has a title (treated as distinct section) */}
                                {group.title && (
                                    <div className="shrink-0 w-8 text-right flex justify-end">
                                        {mainMarker}
                                    </div>
                                )}

                                <div className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed w-full min-w-0 ${!group.title ? 'pl-12' : ''}`}>
                                    {group.title && <div className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-200">{group.title}</div>}

                                    {group.items.length > 0 && (
                                        <ul className={`space-y-2 mt-2 ${group.type === 'text' ? '' : 'list-none'}`}>
                                            {group.items.map((item, j) => {
                                                const indentClass = item.level === 1 ? 'ml-4' : item.level === 2 ? 'ml-8' : '';
                                                return (
                                                    <li key={j} className="flex gap-2">
                                                        {/* Custom Bullet for Items based on Level */}
                                                        <span className={`shrink-0 text-slate-400 ${indentClass}`}>
                                                            {item.level === 0 ? '•' : '◦'}
                                                        </span>
                                                        <span className="whitespace-pre-wrap">{item.text}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderFoundationSkills = (text: string | undefined | null) => {
        if (!text) return null;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const tableRows: { skill: string; desc: string }[] = [];
        const otherText: string[] = [];

        lines.forEach(line => {
            // Pattern 1: Table format "Skill | Description"
            if (line.includes('|')) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 2) {
                    const col1 = parts[0].toLowerCase();
                    // Skip header row if it contains generic terms
                    if (col1 === 'skill' || col1 === 'foundation skills' || col1 === 'elements') return;

                    tableRows.push({ skill: parts[0], desc: parts.slice(1).join(' | ') });
                } else {
                    otherText.push(line);
                }
            }
            // Pattern 2: "Skill to: Description" format (Common in some units)
            else if (line.match(/^(Reading|Writing|Oral communication|Numeracy|Teamwork|Planning and organising|Technology|Problem solving|Self-management|Learning)\s+(skills\s+)?to:/i)) {
                const match = line.match(/^(.+?to:)\s*(.*)$/);
                if (match) {
                    tableRows.push({ skill: match[1], desc: match[2] || '' });
                } else {
                    otherText.push(line);
                }
            }
            else {
                otherText.push(line);
            }
        });

        if (tableRows.length === 0 && otherText.length === 0) return null;

        return (
            <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
                    Foundation Skills
                </h4>

                {otherText.length > 0 && (
                    <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-4 pl-3">
                        {otherText.map((t, i) => <p key={i} className="whitespace-pre-wrap">{t}</p>)}
                    </div>
                )}

                {tableRows.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 mx-3">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Skill</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                                {tableRows.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 align-top">{row.skill}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 align-top whitespace-pre-wrap">{row.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderSheet = (config: SheetConfig) => {
        // We only really care about the selected unit in this mode, 
        // effectively ignoring the complex 'allocation' logic needed for the full Excel export.
        const tabUnits = units;

        if (config.name === 'Assessment Conditions') {
            return (
                <div className="h-full">
                    <table className="w-full text-sm border-collapse border border-slate-200 dark:border-slate-800">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 z-10 shadow-sm border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-3 border-r border-slate-200 dark:border-slate-700 w-1/4 text-left font-semibold">Unit</th>
                                <th className="p-3 border-r border-slate-200 dark:border-slate-700 text-left font-semibold">Assessment conditions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {units.map((u, i) => (
                                <React.Fragment key={u.code}>
                                    <tr className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                        <td className="p-3 border-r border-slate-200 dark:border-slate-800 align-top font-medium text-slate-900 dark:text-slate-100">{u.code} {u.title}</td>
                                        <td className="p-3 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 leading-relaxed align-top">
                                            {u.assessmentConditionsHtml ? (
                                                <div
                                                    className="prose prose-sm dark:prose-invert max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: u.assessmentConditionsHtml }}
                                                />
                                            ) : (
                                                <div className="whitespace-pre-wrap">{u.assessmentConditions}</div>
                                            )}
                                        </td>
                                    </tr>
                                    {/* Separator row */}
                                    <tr className="bg-slate-100 dark:bg-slate-800 h-1"><td colSpan={2}></td></tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Standard Mapping Sheet
        // Document-style view (Headings & Lists)
        return (
            <div className="max-w-5xl mx-auto pb-12 p-4">
                {tabUnits.map((u) => {
                    let elCount = 0;
                    return (
                        <div key={u.code} className="space-y-10">

                            {/* Elements & PCs */}
                            <div className="space-y-8">
                                {u.elements.map((el, elIdx) => {
                                    // Clean the title: Strip leading numbers (e.g., "1. Plan..." -> "Plan...")
                                    // and filter out table header artifacts
                                    let elTitle = el.title ? el.title.replace(/^\d+\.?\s+/, '').trim() : '';

                                    if (!elTitle || elTitle.toLowerCase() === 'element' || elTitle.toLowerCase() === 'elements') return null;

                                    return (
                                        <div key={elIdx} className="break-inside-avoid">
                                            {/* Element Title */}
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-l-4 border-blue-500 rounded-r">
                                                {elTitle}
                                            </h3>

                                            {/* PC List - Fixed for Clumped Text */}
                                            <div className="space-y-4 px-2 pl-4">
                                                {el.performanceCriteria.flatMap((pc) => {
                                                    // Fix for clumped PCs (e.g., "1.1.Action...1.2.Action...")
                                                    // Some units have all PCs in one text block. We need to split them.
                                                    // Pattern: Look for "X.Y" or "X.Y." followed by text.

                                                    // If the text contains internal numbering like "1.2.", split it to separate rows.
                                                    // We use a lookahead to keep the number in the split result.
                                                    const chunks = pc.text.split(/(?=\b\d+\.\d+\.?\s)/g);

                                                    if (chunks.length <= 1) return [pc];

                                                    return chunks.map((chunk, i) => {
                                                        const trimmed = chunk.trim();
                                                        // Attempt to extract ID from the chunk
                                                        const match = trimmed.match(/^(\d+\.\d+)(\.?)\s*([\s\S]*)/);
                                                        if (match) {
                                                            return {
                                                                id: match[1],
                                                                text: match[3] || trimmed // If regex fails to capture group 3, fallback
                                                            };
                                                        }

                                                        // Fallback for first chunk if it doesn't match ID pattern but belongs to parent pc.id
                                                        if (i === 0) {
                                                            // If chunk doesn't start with ID, maybe it was stripped? Use original PC id.
                                                            return { id: pc.id, text: trimmed };
                                                        }

                                                        // Orphaned chunk?
                                                        return { id: '', text: trimmed };
                                                    });
                                                }).map((pc, pcIdx) => (
                                                    <div key={`${elIdx}-${pcIdx}`} className="flex gap-4 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group items-start">
                                                        <div className="shrink-0 w-12 pt-0.5 text-right">
                                                            <span className="inline-block text-slate-500 dark:text-slate-400 text-xs font-mono font-bold">
                                                                {pc.id}
                                                            </span>
                                                        </div>
                                                        <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                                            {pc.text.replace(/^[a-z]/, c => c.toUpperCase())}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Evidence Sections */}
                            <div className="flex flex-col gap-8 pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
                                {renderEvidenceSection('Performance Evidence', u.performanceEvidence, u.performanceEvidenceHtml, 'bg-green-500', { prefix: 'P' })}
                                {renderEvidenceSection('Knowledge Evidence', u.knowledgeEvidence, u.knowledgeEvidenceHtml, 'bg-purple-500', { prefix: 'K' })}
                            </div>

                            {/* Foundation Skills (if any) */}
                            {renderFoundationSkills(u.foundationSkills)}

                            {/* Assessment Conditions */}
                            {u.assessmentConditions && (
                                <div className="pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
                                    {renderEvidenceSection("Assessment Conditions", u.assessmentConditions, u.assessmentConditionsHtml, 'bg-orange-50', { prefix: 'AC', style: 'bullet' })}
                                </div>
                            )}

                            {/* Other Dynamic Sections removed as per user request */}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleDownload = () => {
        setLoading(true);
        const targetUnitCode = selectedUnit ? selectedUnit.code : (units.length === 1 ? units[0].code : null);
        const url = targetUnitCode ? `/api/units/export?unit=${targetUnitCode}` : '/api/units/export';
        window.location.href = url;
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <div className={isEmbedded ? "flex flex-col" : "fixed inset-0 bg-white dark:bg-slate-950 z-[60] flex flex-col"}>
            {/* Header */}
            {/* Toolbar */}
            {/* Modal Header (Only when not embedded) */}
            {!isEmbedded && (
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Maritime View</h2>
                        {activeConfig && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                {activeConfig.name}
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content - No Tabs */}
            <div className={`p-4 ${isEmbedded ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-950'}`}>
                <div className="min-h-full bg-white dark:bg-slate-900 rounded shadow-sm border border-slate-200 dark:border-slate-800 relative">
                    {renderSheet(activeConfig)}
                </div>
            </div>
        </div>
    );
}
