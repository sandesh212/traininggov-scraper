'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { QuestionResult } from '../types';

interface DetailedReportViewProps {
    results: QuestionResult[];
    instructions?: string[];
    onNavigateToMatrix?: (unitCode: string, criteriaId: string) => void;
}

export function DetailedReportView({ results, instructions, onNavigateToMatrix }: DetailedReportViewProps) {
    if (!results || results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={48} className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-700 mb-2">No questions detected</h2>
                <p className="text-gray-500 text-base max-w-xl mx-auto">No valid questions were found in the assessment file. Please check the file format and ensure that questions are present and clearly formatted. The report has been halted.</p>
            </div>
        );
    }

    // Group results by section
    const groupedResults = results.reduce((acc, result) => {
        const section = result.questionSection || 'General';
        if (!acc[section]) acc[section] = [];
        acc[section].push(result);
        return acc;
    }, {} as Record<string, QuestionResult[]>);

    const sections = Object.entries(groupedResults);
    // If there's only one section and it's "General", we don't need the accordion
    const isSingleGeneral = sections.length === 1 && sections[0][0] === 'General';

    return (
        <div className="space-y-8">
            {/* Instructions Section */}
            {instructions && instructions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 rounded-xl border border-amber-200 p-6 mb-8 shadow-sm"
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

            {isSingleGeneral ? (
                <div className="space-y-4">
                    {sections[0][1].map((result, idx) => (
                        <QuestionCard key={result.questionId} result={result} idx={idx} onNavigateToMatrix={onNavigateToMatrix} />
                    ))}
                </div>
            ) : (
                sections.map(([section, sectionResults]) => (
                    <ReportSection key={section} title={section} results={sectionResults} onNavigateToMatrix={onNavigateToMatrix} />
                ))
            )}
        </div>
    );
}

function ReportSection({ title, results, onNavigateToMatrix }: { title: string, results: QuestionResult[], onNavigateToMatrix?: (u: string, c: string) => void }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="space-y-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-lg font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4 hover:bg-gray-50 rounded px-2 transition-colors group"
            >
                <div className="flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full group-hover:bg-blue-700 transition-colors"></span>
                    {title}
                    <span className="text-sm font-normal text-gray-500 ml-2">({results.length} questions)</span>
                </div>
                {isOpen ? <ChevronDown size={20} className="text-gray-400 group-hover:text-blue-600" /> : <ChevronRight size={20} className="text-gray-400 group-hover:text-blue-600" />}
            </button>

            {isOpen && (
                <div className="space-y-4">
                    {results.map((result, idx) => (
                        <QuestionCard key={result.questionId} result={result} idx={idx} onNavigateToMatrix={onNavigateToMatrix} />
                    ))}
                </div>
            )}
        </div>
    );
}

function QuestionCard({ result, idx, onNavigateToMatrix }: { result: QuestionResult, idx: number, onNavigateToMatrix?: (u: string, c: string) => void }) {
    // Helper to render text with [[ANSWER: ...]] in red
    const renderQuestionText = (text: string) => {
        if (!text) return 'No question text detected';
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
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {result.questionId}
                        </span>
                        <span className={`
                            text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1
                            ${result.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                        `}>
                            {result.isValid ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                            {result.isValid ? 'Compliant' : 'Non-Compliant'}
                        </span>
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        Confidence: <span className="text-gray-900 font-bold">{result.confidence}%</span>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-gray-800 text-base font-medium leading-relaxed whitespace-pre-wrap">
                        {renderQuestionText(result.questionText)}
                    </p>

                    {/* Render Images */}
                    {result.images && result.images.length > 0 && (
                        <div className="mt-4 space-y-4">
                            {result.images.map((img, i) => (
                                <div key={i} className="border rounded-lg p-2 bg-gray-50 inline-block max-w-full">
                                    <img
                                        src={img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`}
                                        alt={`Question Image ${i + 1}`}
                                        className="max-w-full h-auto rounded max-h-96 object-contain"
                                    />
                                    {result.imageDescription && i === 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">
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

                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mapped To</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Unit:</span>
                                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    {result.mappedUnit || 'None'}
                                </span>
                            </div>

                            {/* Criteria Matches */}
                            <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 mt-0.5">Criteria:</span>
                                <TagList
                                    items={result.mappedCriteria}
                                    emptyText="No direct criteria match"
                                    colorClass="bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 hover:border-purple-300"
                                    onTagClick={(c) => result.mappedUnit && onNavigateToMatrix?.(result.mappedUnit, c)}
                                />
                            </div>

                            {/* Knowledge Matches */}
                            {result.mappedKnowledge && result.mappedKnowledge.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 mt-0.5">Knowledge:</span>
                                    <TagList
                                        items={result.mappedKnowledge}
                                        colorClass="bg-amber-50 text-amber-800 border-amber-100 hover:bg-amber-100 hover:border-amber-300"
                                        onTagClick={(k) => {
                                            if (result.mappedUnit) {
                                                const kId = k.split(':')[0].trim();
                                                onNavigateToMatrix?.(result.mappedUnit, kId);
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Analysis</h4>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <ExpandableText text={result.reasoning} />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function TagList({ items, emptyText, colorClass, onTagClick }: { items: string[], emptyText?: string, colorClass: string, onTagClick?: (item: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const limit = 3;

    if (!items || items.length === 0) {
        return <span className="text-xs text-gray-400 italic">{emptyText || 'None'}</span>;
    }

    const displayedItems = expanded ? items : items.slice(0, limit);

    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap gap-1">
                {displayedItems.map((item, i) => (
                    <ClickableTag key={i} text={item} colorClass={colorClass} onClick={() => onTagClick?.(item)} />
                ))}
            </div>
            {items.length > limit && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none bg-blue-50 px-1.5 py-0.5 rounded"
                >
                    {expanded ? 'Show Less' : `+${items.length - limit} more`}
                </button>
            )}
        </div>
    );
}

function ClickableTag({ text, colorClass, onClick }: { text: string, colorClass: string, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                text-xs font-medium px-1.5 py-0.5 rounded border text-left transition-all duration-200 flex items-center gap-1
                ${colorClass}
                truncate max-w-[250px] hover:max-w-[300px] hover:shadow-sm
            `}
            title="Click to view in Matrix"
        >
            {text}
            <ExternalLink size={10} className="opacity-50" />
        </button>
    );
}

function ExpandableText({ text }: { text: string }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const shouldTruncate = text.length > 200;

    if (!shouldTruncate) return <p className="text-sm text-gray-600 leading-relaxed">{text}</p>;

    return (
        <div>
            <p className={`text-sm text-gray-600 leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                {text}
            </p>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 text-xs font-bold mt-2 hover:underline focus:outline-none flex items-center gap-1"
            >
                {isExpanded ? 'Show Less' : 'Read Full Analysis'}
            </button>
        </div>
    );
}
