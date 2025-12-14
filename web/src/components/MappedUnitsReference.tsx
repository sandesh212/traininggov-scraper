import React, { useState } from 'react';
import { Unit } from '@/types'; // Ensure Unit type is imported
import { ChevronDown, ChevronUp, BookOpen, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MappedUnitsReferenceProps {
    units: any[]; // Using any to avoid strict type conflicts if Unit type differs slightly, but ideally strictly typed
}

export function MappedUnitsReference({ units }: MappedUnitsReferenceProps) {
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

    const toggleUnit = (code: string) => {
        const newSet = new Set(expandedUnits);
        if (newSet.has(code)) {
            newSet.delete(code);
        } else {
            newSet.add(code);
        }
        setExpandedUnits(newSet);
    };

    if (!units || units.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="text-purple-600" size={24} />
                    Mapped Units Reference
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Detailed breakdown of all Units of Competency referenced in this analysis.
                </p>
            </div>

            <div className="divide-y divide-gray-100">
                {units.map((unit) => (
                    <div key={unit.code} className="bg-white">
                        <button
                            onClick={() => toggleUnit(unit.code)}
                            className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-mono font-bold text-sm border border-purple-200">
                                    {unit.code}
                                </div>
                                <h3 className="font-semibold text-gray-800 text-sm sm:text-base group-hover:text-purple-700 transition-colors">
                                    {unit.title}
                                </h3>
                            </div>
                            {expandedUnits.has(unit.code) ? (
                                <ChevronUp className="text-gray-400" size={20} />
                            ) : (
                                <ChevronDown className="text-gray-400" size={20} />
                            )}
                        </button>

                        <AnimatePresence>
                            {expandedUnits.has(unit.code) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-gray-50"
                                >
                                    <div className="p-6 space-y-6">
                                        {/* Description */}
                                        {unit.description && (
                                            <div className="text-sm text-gray-600 italic border-l-4 border-gray-300 pl-4 py-1">
                                                {unit.description}
                                            </div>
                                        )}

                                        {/* Elements & PC */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                <Layers size={14} /> Elements & Performance Criteria
                                            </h4>

                                            <div className="grid gap-4">
                                                {unit.elements.map((el: any, idx: number) => (
                                                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                        <h5 className="font-bold text-gray-800 mb-3 text-sm">
                                                            {idx + 1}. {el.title}
                                                        </h5>
                                                        <ul className="space-y-2">
                                                            {el.performanceCriteria.map((pc: any, pcIdx: number) => (
                                                                <li key={pcIdx} className="text-xs sm:text-sm text-gray-600 flex items-start gap-2">
                                                                    <span className="font-mono text-purple-600 font-bold shrink-0 w-8">
                                                                        {pc.id}
                                                                    </span>
                                                                    <span>{pc.text}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Knowledge Evidence */}
                                        {unit.knowledgeEvidence && (
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Knowledge Evidence</h4>
                                                <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                                    {unit.knowledgeEvidence}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </div>
    );
}
