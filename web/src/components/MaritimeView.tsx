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
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const groups: { title: string; items: string[] }[] = [];
        let currentGroup: { title: string; items: string[] } | null = null;

        lines.forEach(line => {
            // STRICT logic: Only [L1]..[L9] are recognized as nested items (from scraper).
            // All other lines (including manual bullets -, *, •) are treated as new Top Level items (New P-Number).
            const isNested = /^\[L[1-9]\]/.test(line);

            // Clean markers triggers (remove [L0], [L1], and common bullets)
            const cleanLine = line.replace(/^(\[L\d+\]|[•◦\-\*])\s*/, '').trim();
            if (!cleanLine) return;

            if (isNested && currentGroup) {
                currentGroup.items.push(cleanLine);
            } else {
                // Start a new numbered group for any non-nested line
                currentGroup = { title: cleanLine, items: [] };
                groups.push(currentGroup);
            }
        });
        return groups;
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
                                        <td className="p-3 border-r border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-slate-600 dark:text-slate-400 leading-relaxed">{u.assessmentConditions}</td>
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
                                    let elTitle = el.title;
                                    if (elTitle && !elTitle.match(/^\d+\.\d+$/)) {
                                        elCount++;
                                        elTitle = `${elCount}. ${elTitle.replace(/^\d+\.\s*/, '')}`;
                                    } else {
                                        return null;
                                    }

                                    return (
                                        <div key={elIdx} className="break-inside-avoid">
                                            {/* Element Title */}
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 px-4 py-2 bg-slate-50 dark:bg-slate-900 border-l-4 border-blue-500 rounded-r">
                                                {elTitle}
                                            </h3>

                                            {/* PC List */}
                                            <div className="space-y-4 px-2 pl-4">
                                                {el.performanceCriteria.map((pc) => (
                                                    <div key={pc.id} className="flex gap-4 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors group items-start">
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
                                {/* Performance Evidence */}
                                {u.performanceEvidence && (
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                            Performance Evidence
                                        </h4>
                                        <div className="space-y-4 pl-3 border-l border-slate-100 dark:border-slate-800">
                                            {parseEvidence(u.performanceEvidence).map((group, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <div className="shrink-0 w-8 text-right">
                                                        <span className="text-xs font-mono font-bold text-slate-400">{i + 1}.</span>
                                                    </div>
                                                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        <div className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-200">{group.title}</div>
                                                        {group.items.length > 0 && (
                                                            <ul className="mt-2 space-y-2 pl-4 list-[circle] marker:text-slate-300">
                                                                {group.items.map((item, j) => (
                                                                    <li key={j} className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{item}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Knowledge Evidence */}
                                {u.knowledgeEvidence && (
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                                            Knowledge Evidence
                                        </h4>
                                        <div className="space-y-4 pl-3 border-l border-slate-100 dark:border-slate-800">
                                            {parseEvidence(u.knowledgeEvidence).map((group, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <div className="shrink-0 w-8 text-right">
                                                        <span className="text-xs font-mono font-bold text-slate-400">{i + 1}.</span>
                                                    </div>
                                                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        <div className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-200">{group.title}</div>
                                                        {group.items.length > 0 && (
                                                            <ul className="mt-2 space-y-2 pl-4 list-[circle] marker:text-slate-300">
                                                                {group.items.map((item, j) => (
                                                                    <li key={j} className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{item}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Foundation Skills (if any) */}
                            {u.foundationSkills && (
                                <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
                                        Foundation Skills
                                    </h4>
                                    <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed pl-3 border-l border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                                        {u.foundationSkills}
                                    </div>
                                </div>
                            )}

                            {/* Assessment Conditions */}
                            {u.assessmentConditions && (
                                <div className="pt-8 border-t border-slate-200 dark:border-slate-800 mt-8">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                            <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                            Assessment Conditions
                                        </h4>
                                        <div className="space-y-2 pl-3 border-l border-slate-100 dark:border-slate-800">
                                            <ul className="space-y-3 pl-4 list-disc marker:text-slate-400">
                                                {parseEvidence(u.assessmentConditions).map((group, i) => (
                                                    <React.Fragment key={i}>
                                                        {group.title && (
                                                            <li className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                                {group.title}
                                                                {group.items.length > 0 && (
                                                                    <ul className="mt-2 space-y-2 pl-4 list-[circle] marker:text-slate-300">
                                                                        {group.items.map((item, j) => (
                                                                            <li key={j} className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </li>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Other Dynamic Sections */}
                            {u.sections && u.sections.map((section, sIdx) => {
                                const headingLower = section.heading.toLowerCase();
                                const excluded = [
                                    "elements and performance criteria",
                                    "performance evidence",
                                    "knowledge evidence",
                                    "assessment conditions",
                                    "links",
                                    "acknowledgement of country",
                                    "copyright"
                                ];
                                // Check if normalized heading starts with any excluded phrase (e.g. "Application of the Unit")
                                if (excluded.some(ex => headingLower.includes(ex))) return null;

                                // IMPROVEMENT: Do not show headings with no content
                                const hasParagraphs = section.paragraphs && section.paragraphs.length > 0;
                                const hasLists = section.lists && section.lists.length > 0;
                                if (!hasParagraphs && !hasLists) return null;

                                return (
                                    <div key={sIdx} className="pt-8 border-t border-slate-200 dark:border-slate-800 mt-8 break-inside-avoid">
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-1 h-4 bg-slate-400 rounded-full"></span>
                                                {section.heading}
                                            </h4>

                                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed pl-3 border-l border-slate-100 dark:border-slate-800">
                                                {/* Paragraphs */}
                                                {section.paragraphs.map((para, pIdx) => (
                                                    <p key={pIdx} className="whitespace-pre-wrap">{para}</p>
                                                ))}

                                                {/* Lists */}
                                                {section.lists && section.lists.map((item, lIdx) => (
                                                    <div key={lIdx} className="pl-2">
                                                        {/* Simple check if it's a simple list item or nested structure */}
                                                        {/* Note: unitMapper flattens complex structures to nested text objects currently, or simple lists */}
                                                        <div className="whitespace-pre-wrap flex gap-2">
                                                            <span className="text-slate-400">•</span>
                                                            <span>{item.text}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
