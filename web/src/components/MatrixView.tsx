import React, { useState, useEffect, useCallback } from 'react';
import { parseEvidenceHierarchy, EvidenceNode } from '../../src/utils/evidenceHierarchy';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Unit, QuestionResult } from '../types';

interface MatrixViewProps {
    mappedUnits: Unit[];
    results: QuestionResult[];
    initialScrollTarget?: { unitCode: string, criteriaId: string } | null;
}

interface MatrixQuestion {
    id: string;
    text: string;
    section: string;
    mappedTo: {
        unit: string | null;
        criteria: string[];
        knowledge: string[];
    };
}

export function MatrixView({ mappedUnits, results, initialScrollTarget }: MatrixViewProps) {
    // Gather all unique questions from results with section info
    const allQuestions: MatrixQuestion[] = (results || [])
        .map(r => ({
            id: r.questionId,
            text: r.questionText,
            section: r.questionSection || 'General',
            mappedTo: { unit: r.mappedUnit, criteria: r.mappedCriteria, knowledge: r.mappedKnowledge }
        }))
        .filter((q, idx, arr) => arr.findIndex(x => x.id === q.id) === idx);

    // Group questions by section
    const groupedQuestions = allQuestions.reduce((acc, q) => {
        if (!acc[q.section]) acc[q.section] = [];
        acc[q.section].push(q);
        return acc;
    }, {} as Record<string, typeof allQuestions>);

    const sections = Object.keys(groupedQuestions);
    const isSingleGeneral = sections.length === 1 && sections[0] === 'General';

    const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
        sections.reduce((acc, s) => ({ ...acc, [s]: true }), {})
    );
    const [showQuestions, setShowQuestions] = useState(true);

    const toggleUnit = (code: string) => {
        setExpandedUnits(prev => ({ ...prev, [code]: !prev[code] }));
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const scrollToMapping = useCallback((unitCode: string, id: string) => {
        setExpandedUnits((previous) => {
            if (previous[unitCode]) return previous;
            return { ...previous, [unitCode]: true };
        });

        // Wait for the accordion expansion before scrolling to the target criterion.
        setTimeout(() => {
            const elementId = `${unitCode}-${id}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('bg-yellow-100', 'transition-colors', 'duration-500');
                setTimeout(() => element.classList.remove('bg-yellow-100'), 2000);
            } else {
                console.warn(`Element not found: ${elementId}`);
            }
        }, 300);
    }, []);

    // Handle initial scroll target from props
    useEffect(() => {
        if (initialScrollTarget) {
            // Small delay to ensure render
            setTimeout(() => {
                scrollToMapping(initialScrollTarget.unitCode, initialScrollTarget.criteriaId);
            }, 500);
        }
    }, [initialScrollTarget, scrollToMapping]);

    const scrollToQuestion = (questionId: string) => {
        const question = allQuestions.find(q => q.id === questionId);
        if (!question) return;

        // 1. Ensure "All Questions" is visible
        if (!showQuestions) setShowQuestions(true);

        // 2. Ensure the section is expanded
        if (!expandedSections[question.section]) {
            setExpandedSections(prev => ({ ...prev, [question.section]: true }));
        }

        // 3. Scroll to the question row
        setTimeout(() => {
            const elementId = `question-row-${questionId}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight
                element.classList.add('bg-blue-100', 'transition-colors', 'duration-500');
                setTimeout(() => element.classList.remove('bg-blue-100'), 2000);
            }
        }, 300);
    };

    return (
        <div className="space-y-12">
            {/* All Questions Section */}
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div
                    className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setShowQuestions(!showQuestions)}
                >
                    <h2 className="text-xl font-bold text-gray-900">
                        {mappedUnits.length === 1
                            ? `${mappedUnits[0]?.code} ${mappedUnits[0]?.title}`
                            : `${mappedUnits.length} Units Mapped`}
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{allQuestions.length} Questions</span>
                        {showQuestions ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    </div>
                </div>

                <AnimatePresence>
                    {showQuestions && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="p-6"
                        >
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">All Fetched Questions</h3>

                            {isSingleGeneral ? (
                                <QuestionList
                                    questions={groupedQuestions['General']}
                                    scrollToMapping={scrollToMapping}
                                    mappedUnits={mappedUnits}
                                />
                            ) : (
                                <div className="space-y-4">
                                    {sections.map(section => (
                                        <div key={section} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => toggleSection(section)}
                                                className="w-full flex items-center justify-between bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-700">{section}</span>
                                                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                                        {groupedQuestions[section].length} questions
                                                    </span>
                                                </div>
                                                {expandedSections[section] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                            </button>

                                            <AnimatePresence>
                                                {expandedSections[section] && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="border-t border-gray-200"
                                                    >
                                                        <div className="p-4">
                                                            <QuestionList
                                                                questions={groupedQuestions[section]}
                                                                scrollToMapping={scrollToMapping}
                                                                mappedUnits={mappedUnits}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Matrix for each unit */}
            {mappedUnits.map((unit, unitIdx) => {
                let keNodes: EvidenceNode[] = [];
                if (unit.knowledgeEvidence) {
                    keNodes = parseEvidenceHierarchy(unit.knowledgeEvidence);
                }
                let peNodes: EvidenceNode[] = [];
                if (unit.performanceEvidence) {
                    peNodes = parseEvidenceHierarchy(unit.performanceEvidence);
                }

                const isExpanded = expandedUnits[unit.code] || false;

                return (
                    <motion.div
                        key={unit.code}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: unitIdx * 0.1 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-300"
                    >
                        <div
                            className="bg-gray-50 px-6 py-4 border-b border-gray-200 sticky top-0 z-10 cursor-pointer flex justify-between items-center hover:bg-gray-100 transition-colors"
                            onClick={() => toggleUnit(unit.code)}
                        >
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm">{unit.code}</span>
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
                                    <div className="p-6">
                                        {/* Elements and Performance Criteria */}
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Elements & Performance Criteria</h3>
                                        {unit.elements?.map((element, elIdx) => (
                                            <div key={`el-group-${elIdx}`} className="mb-6">
                                                <div className="font-semibold text-blue-900 text-lg mb-2">Element {elIdx + 1}: <span className="font-normal">{element.title}</span></div>
                                                <ol className="pl-6 space-y-1">
                                                    {element.performanceCriteria.map((pc, pcIdx) => {
                                                        const mappedQuestions = results.filter(r =>
                                                            r.mappedUnit === unit.code && r.mappedCriteria.includes(pc.id)
                                                        );
                                                        return (
                                                            <li
                                                                key={pc.id}
                                                                id={`${unit.code}-${pc.id}`}
                                                                className="mb-2 flex items-baseline p-1 rounded"
                                                            >
                                                                <span className="font-mono text-xs font-bold text-gray-700 mr-2 min-w-[40px]">{elIdx + 1}.{pcIdx + 1}</span>
                                                                <span className="text-gray-800 flex-1">{pc.text}</span>
                                                                {mappedQuestions.length > 0 && (
                                                                    <div className="ml-4 flex flex-wrap gap-1">
                                                                        {mappedQuestions.map(q => (
                                                                            <button
                                                                                key={q.questionId}
                                                                                onClick={() => scrollToQuestion(q.questionId)}
                                                                                className="text-xs text-green-700 font-semibold hover:text-green-900 hover:underline bg-green-50 px-1 rounded border border-green-100"
                                                                                title="Scroll to question"
                                                                            >
                                                                                {q.questionId}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ol>
                                            </div>
                                        ))}

                                        {/* Knowledge Evidence */}
                                        <h3 className="text-xl font-bold text-amber-800 mb-2 mt-8">Knowledge Evidence</h3>
                                        <ol className="pl-6 space-y-1">
                                            {keNodes.map((node, idx) => {
                                                const kId = `K${idx + 1}`;
                                                const mappedQuestions = results.filter(r =>
                                                    r.mappedUnit === unit.code &&
                                                    r.mappedKnowledge?.some(mk => mk.startsWith(`${kId}:`))
                                                );
                                                return (
                                                    <li
                                                        key={`ke-root-${idx}`}
                                                        id={`${unit.code}-${kId}`}
                                                        className="mb-2 flex flex-col p-1 rounded"
                                                    >
                                                        <div className="flex items-baseline">
                                                            <span className="font-mono text-xs font-bold text-amber-700 mr-2 min-w-[40px]">{kId}</span>
                                                            <span className="text-gray-800 flex-1">{node.text}</span>
                                                            {mappedQuestions.length > 0 && (
                                                                <div className="ml-4 flex flex-wrap gap-1">
                                                                    {mappedQuestions.map(q => (
                                                                        <button
                                                                            key={q.questionId}
                                                                            onClick={() => scrollToQuestion(q.questionId)}
                                                                            className="text-xs text-green-700 font-semibold hover:text-green-900 hover:underline bg-green-50 px-1 rounded border border-green-100"
                                                                            title="Scroll to question"
                                                                        >
                                                                            {q.questionId}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Nested children if any */}
                                                        {node.children && node.children.length > 0 && (
                                                            <ul className="list-disc pl-14 mt-1 text-xs text-gray-600 w-full">
                                                                {node.children.map((child, cidx) => (
                                                                    <li key={cidx} className="mb-1">
                                                                        <span>{child.text}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ol>

                                        {/* Performance Evidence */}
                                        <h3 className="text-xl font-bold text-green-800 mb-2 mt-8">Performance Evidence</h3>
                                        <ol className="pl-6 space-y-1">
                                            {peNodes.map((node, idx) => {
                                                const peId = `PE${idx + 1}`;
                                                const mappedQuestions = results.filter(r =>
                                                    r.mappedUnit === unit.code &&
                                                    r.mappedPerformanceEvidence?.some(mpe => mpe.startsWith(`${peId}:`))
                                                );
                                                return (
                                                    <li
                                                        key={`pe-root-${idx}`}
                                                        id={`${unit.code}-${peId}`}
                                                        className="mb-2 flex flex-col p-1 rounded"
                                                    >
                                                        <div className="flex items-baseline">
                                                            <span className="font-mono text-xs font-bold text-green-700 mr-2 min-w-[40px]">{peId}</span>
                                                            <span className="text-gray-800 flex-1">{node.text}</span>
                                                            {mappedQuestions.length > 0 && (
                                                                <div className="ml-4 flex flex-wrap gap-1">
                                                                    {mappedQuestions.map(q => (
                                                                        <button
                                                                            key={q.questionId}
                                                                            onClick={() => scrollToQuestion(q.questionId)}
                                                                            className="text-xs text-green-700 font-semibold hover:text-green-900 hover:underline bg-green-50 px-1 rounded border border-green-100"
                                                                            title="Scroll to question"
                                                                        >
                                                                            {q.questionId}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Nested children if any */}
                                                        {node.children && node.children.length > 0 && (
                                                            <ul className="list-disc pl-14 mt-1 text-xs text-gray-600 w-full">
                                                                {node.children.map((child, cidx) => (
                                                                    <li key={cidx} className="mb-1">
                                                                        <span>{child.text}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ol>

                                        {/* Assessment Conditions */}
                                        {unit.assessmentConditions && (
                                            <div className="mt-8">
                                                <h3 className="text-xl font-bold text-blue-800 mb-2">Assessment Conditions</h3>
                                                <ul className="list-disc pl-6 space-y-1 bg-blue-50 p-4 rounded border border-blue-100">
                                                    {unit.assessmentConditions.split(/\n+/).map(l => l.trim()).filter(Boolean).map((line, idx) => (
                                                        <li key={idx} className="text-xs text-gray-700">{line}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}

function QuestionList({ questions, scrollToMapping, mappedUnits }: {
    questions: MatrixQuestion[];
    scrollToMapping: (unit: string, id: string) => void;
    mappedUnits: Unit[];
}) {
    // Helper to render text with [[ANSWER: ...]] in red
    const renderQuestionText = (text: string) => {
        if (!text) return '';
        const parts = text.split(/\[\[ANSWER:\s*(.*?)\]\]/gi);
        if (parts.length === 1) return text;

        return (
            <span>
                {parts.map((part, i) => {
                    // Even indices are normal text, Odd indices are answers
                    if (i % 2 === 1) {
                        return <span key={i} className="text-red-600 font-medium ml-1 block mt-1">{part}</span>;
                    }
                    return <span key={i}>{part}</span>;
                })}
            </span>
        );
    };

    return (
        <ol className="list-decimal pl-6 space-y-2">
            {questions.map((q) => (
                <li key={q.id} id={`question-row-${q.id}`} className="text-sm text-gray-800 p-1 rounded">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded mr-2">{q.id}</span>
                    {renderQuestionText(q.text)}
                    {(q.mappedTo.unit || q.mappedTo.criteria.length > 0 || q.mappedTo.knowledge.length > 0) && (
                        <div className="text-xs text-gray-500 mt-2 ml-8 space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Mapped to:</span>
                                {q.mappedTo.unit && (
                                    <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                        {q.mappedTo.unit}
                                    </span>
                                )}
                            </div>

                            {/* Criteria with Text */}
                            {q.mappedTo.criteria.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1 rounded">Criteria:</span>
                                    {q.mappedTo.criteria.map((c: string) => {
                                        // Find text
                                        const unit = mappedUnits.find(u => u.code === q.mappedTo.unit);
                                        let text = '';
                                        if (unit) {
                                            for (const el of unit.elements || []) {
                                                const pc = el.performanceCriteria.find(p => p.id === c);
                                                if (pc) { text = pc.text; break; }
                                            }
                                        }
                                        return (
                                            <button
                                                key={c}
                                                onClick={() => q.mappedTo.unit && scrollToMapping(q.mappedTo.unit, c)}
                                                className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 hover:bg-purple-100 hover:border-purple-300 hover:text-purple-900 transition-colors text-left"
                                                title={`Go to ${c}: ${text}`}
                                            >
                                                <span className="font-bold">{c}</span>
                                                {text && <span className="text-gray-500 ml-1 group-hover:text-purple-700">- {text.length > 50 ? text.substring(0, 50) + '...' : text}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Knowledge with Text */}
                            {q.mappedTo.knowledge.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 rounded">Knowledge:</span>
                                    {q.mappedTo.knowledge.map((k: string, kIdx: number) => {
                                        // Extract ID (e.g., "K12") from "K12: text..."
                                        const kId = k.split(':')[0].trim();
                                        return (
                                            <button
                                                key={kIdx}
                                                onClick={() => q.mappedTo.unit && scrollToMapping(q.mappedTo.unit, kId)}
                                                className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-900 transition-colors text-left"
                                                title={`Go to ${kId}`}
                                            >
                                                {k.length > 60 ? k.substring(0, 60) + '...' : k}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </li>
            ))}
        </ol>
    );
}
