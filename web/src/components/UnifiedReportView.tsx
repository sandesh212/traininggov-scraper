'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, ChevronDown, ChevronRight, BookOpen, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { QuestionResult, Unit } from '../types';
import { parseEvidenceHierarchy, EvidenceNode } from '../../src/utils/evidenceHierarchy';

interface UnifiedReportViewProps {
    results: QuestionResult[];
    mappedUnits: Unit[];
    instructions?: string[];
}

export function UnifiedReportView({ results, mappedUnits, instructions }: UnifiedReportViewProps) {
    const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

    const toggleUnit = (code: string) => {
        setExpandedUnits(prev => ({ ...prev, [code]: !prev[code] }));
    };

    const scrollToUnit = (unitCode: string) => {
        setExpandedUnits(prev => ({ ...prev, [unitCode]: true }));
        setTimeout(() => {
            const element = document.getElementById(`unit-ref-${unitCode}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                element.classList.add('ring-2', 'ring-blue-400', 'transition-all', 'duration-500');
                setTimeout(() => element.classList.remove('ring-2', 'ring-blue-400'), 2000);
            }
        }, 100);
    };

    return (
        <div className="space-y-12">
            {/* 1. Assessment Instructions */}
            {instructions && instructions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 rounded-xl border border-amber-200 p-6 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-amber-200 pb-2">
                        <AlertCircle size={16} />
                        Assessment Instructions
                    </h3>
                    <div className="space-y-3 text-sm text-amber-900 leading-relaxed instruction-content">
                        {instructions.map((inst, i) => (
                            <div key={i} dangerouslySetInnerHTML={{ __html: inst }} />
                        ))}
                    </div>
                </motion.div>
            )}

            {/* 2. Findings (Questions & Answers) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Findings & Analysis</h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {results?.length || 0} Questions Analyzed
                    </span>
                </div>

                {results?.map((result, idx) => (
                    <QuestionCard
                        key={`q-${idx}-${result.questionId}`}
                        result={result}
                        idx={idx}
                        onNavigateToUnit={scrollToUnit}
                        mappedUnits={mappedUnits}
                    />
                ))}
            </div>

            {/* 3. Unit Reference Table */}
            <div className="pt-12 border-t-2 border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <BookOpen className="text-blue-600" />
                    Unit Reference Matrix
                </h2>
                <div className="space-y-6">
                    {(mappedUnits || []).map((unit) => (
                        <UnitReferenceCard
                            key={unit.code}
                            unit={unit}
                            isExpanded={expandedUnits[unit.code] || false}
                            toggle={() => toggleUnit(unit.code)}
                            results={results}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function QuestionCard({ result, idx, onNavigateToUnit, mappedUnits }: {
    result: QuestionResult,
    idx: number,
    onNavigateToUnit: (code: string) => void,
    mappedUnits: Unit[]
}) {
    // Helper to render text with [[ANSWER: ...]] in red
    const renderQuestionText = (text: string) => {
        if (!text) return <span className="text-gray-400 italic">No text content</span>;

        // Split by the ANSWER tag
        const parts = text.split(/\[\[ANSWER:\s*([\s\S]*?)\]\]/gi);

        if (parts.length === 1) return text;

        return (
            <div className="space-y-3">
                {parts.map((part, i) => {
                    // Even indices are normal text (Question)
                    // Odd indices are answers (Red Text)
                    if (i % 2 === 1) {
                        return (
                            <div key={i} className="mt-4">
                                <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <span>Answer:</span>
                                    <div className="flex-1 h-px bg-red-200"></div>
                                </div>
                                <div className="pl-4 border-l-3 border-red-300 bg-red-50/30 rounded-r px-3 py-2">
                                    <div className="text-red-700 font-medium whitespace-pre-wrap leading-relaxed">
                                        {part}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    // Filter out empty strings from split
                    if (!part.trim()) return null;

                    return (
                        <div key={i} className="text-gray-900 font-medium whitespace-pre-wrap leading-relaxed">
                            {part}
                        </div>
                    );
                })}
            </div>
        );
    };


    const displayId = result.questionId.includes(' - ')
        ? result.questionId.split(' - ').pop()
        : result.questionId;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`
                bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden
                border-l-4 ${result.isValid ? 'border-l-green-500' : 'border-l-red-500'}
                hover:shadow-md transition-shadow duration-300
            `}
        >
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {displayId}
                        </span>
                        {result.questionSection && (
                            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                {result.questionSection}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`
                            text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1
                            ${result.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                        `}>
                            {result.isValid ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                            {result.isValid ? 'Compliant' : 'Non-Compliant'}
                        </span>
                        <span className="text-xs font-medium text-gray-400">
                            {result.confidence}% Conf.
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="mb-6">
                    {renderQuestionText(result.questionText)}

                    {/* Images */}
                    {result.images && result.images.length > 0 && (
                        <div className="mt-4 space-y-4">
                            {result.images.map((img, i) => (
                                <div key={i} className="border rounded-lg p-3 bg-gray-50 inline-block max-w-full">
                                    <img
                                        src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                                        alt={`Question Image ${i + 1}`}
                                        className="max-w-full h-auto rounded max-h-96 object-contain shadow-sm"
                                    />
                                    {result.imageDescription && i === 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <ImageIcon size={12} />
                                                AI Vision Analysis
                                            </p>
                                            <p className="text-xs text-gray-600 italic leading-relaxed">
                                                {result.imageDescription}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Analysis Footer */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mapping Details</h4>
                        <div className="space-y-3">
                            {result.mappedUnit ? (
                                <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 mt-0.5 min-w-[60px]">Unit:</span>
                                    <button
                                        onClick={() => onNavigateToUnit(result.mappedUnit!)}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline text-left"
                                    >
                                        {result.mappedUnit}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-red-500 italic">No Unit Mapped</div>
                            )}

                            {result.mappedCriteria.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 mt-0.5 min-w-[60px]">Criteria:</span>
                                    <div className="flex flex-wrap gap-1">
                                        {result.mappedCriteria.map(c => (
                                            <span key={c} className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result.mappedKnowledge && result.mappedKnowledge.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 mt-0.5 min-w-[60px]">Knowledge:</span>
                                    <div className="flex flex-col gap-1">
                                        {result.mappedKnowledge.map((k, i) => (
                                            <span key={i} className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 truncate max-w-[250px]" title={k}>
                                                {k.split(':')[0]}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">AI Reasoning</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {result.reasoning}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function UnitReferenceCard({ unit, isExpanded, toggle, results }: {
    unit: Unit,
    isExpanded: boolean,
    toggle: () => void,
    results: QuestionResult[]
}) {
    let keNodes: EvidenceNode[] = [];
    if (unit.knowledgeEvidence) {
        keNodes = parseEvidenceHierarchy(unit.knowledgeEvidence);
    }
    let peNodes: EvidenceNode[] = [];
    if (unit.performanceEvidence) {
        peNodes = parseEvidenceHierarchy(unit.performanceEvidence);
    }

    return (
        <div
            id={`unit-ref-${unit.code}`}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
            <div
                className="bg-gray-50 px-6 py-4 border-b border-gray-200 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
                onClick={toggle}
            >
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm font-mono">{unit.code}</span>
                    {unit.title}
                </h3>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="p-6 space-y-8">
                            {/* Elements */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Performance Criteria</h4>
                                {unit.elements?.map((element, elIdx) => (
                                    <div key={elIdx} className="mb-6 last:mb-0">
                                        <div className="font-semibold text-gray-800 mb-2 text-sm">Element {elIdx + 1}: {element.title}</div>
                                        <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                                            {element.performanceCriteria.map((pc) => {
                                                const mappedCount = results.filter(r => r.mappedUnit === unit.code && r.mappedCriteria.includes(pc.id)).length;
                                                return (
                                                    <div key={pc.id} className="text-sm group">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="font-mono text-xs font-bold text-gray-500 min-w-[30px]">{pc.id}</span>
                                                            <span className="text-gray-600 flex-1">{pc.text}</span>
                                                            {mappedCount > 0 && (
                                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 whitespace-nowrap">
                                                                    {mappedCount} Qs
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Knowledge Evidence */}
                            {keNodes.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4 border-b border-amber-100 pb-2">Knowledge Evidence</h4>
                                    <div className="space-y-2 pl-4 border-l-2 border-amber-100">
                                        {keNodes.map((node, idx) => {
                                            const kId = `K${idx + 1}`;
                                            const mappedCount = results.filter(r => r.mappedUnit === unit.code && r.mappedKnowledge?.some(k => k.startsWith(kId))).length;
                                            return (
                                                <div key={idx} className="text-sm mb-2">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="font-mono text-xs font-bold text-amber-600 min-w-[30px]">{kId}</span>
                                                        <span className="text-gray-600 flex-1">{node.text}</span>
                                                        {mappedCount > 0 && (
                                                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 whitespace-nowrap">
                                                                {mappedCount} Qs
                                                            </span>
                                                        )}
                                                    </div>
                                                    {node.children && (
                                                        <ul className="list-disc pl-8 mt-1 text-xs text-gray-500">
                                                            {node.children.map((c, ci) => <li key={ci}>{c.text}</li>)}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ChevronUp({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m18 15-6-6-6 6" /></svg>;
}
