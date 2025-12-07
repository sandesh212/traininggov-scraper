import React, { useState } from 'react';
import { ChevronRight, Award, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface DetailedMapping {
    unitCode: string;
    unitTitle: string;
    elementNumber?: string;
    elementTitle?: string;
    performanceCriteria?: string[];
    performanceCriteriaText?: string[];
    knowledgeEvidence?: string[];
    performanceEvidence?: string[];
    assessmentConditions?: string;
    sourceType: 'element' | 'knowledge' | 'performance' | 'assessment' | 'mixed';
    confidence: number;
}

interface QuestionAnswerPair {
    questionId: string;
    questionText: string;
    answerText: string;
    index: number;
    mappedUnit?: string | null;
    mappedCriteria?: string[];
    mappedKnowledge?: string[];
    detailedMapping?: DetailedMapping;
    section?: string;

    parentQuestionId?: string;
    images?: string[];
    imageDescription?: string;
}

interface QuestionAnswerTableProps {
    pairs: QuestionAnswerPair[];
    instructions?: string[];
}

export function QuestionAnswerTable({ pairs, instructions }: QuestionAnswerTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (questionId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(questionId)) {
            newExpanded.delete(questionId);
        } else {
            newExpanded.add(questionId);
        }
        setExpandedRows(newExpanded);
    };

    if (!pairs || pairs.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>No question-answer pairs found</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
            {/* Instructions Section - Removed to avoid duplication with page header */}

            {/* Question-Answer-Mapping Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <tr>
                            <th className="w-12 px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                #
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Question
                            </th>
                            <th className="w-16 px-2 py-4 text-center">
                                <ChevronRight className="mx-auto text-gray-400" size={20} />
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-red-600 uppercase tracking-wider">
                                Answer
                            </th>
                            <th className="w-16 px-2 py-4 text-center">
                                <ChevronRight className="mx-auto text-gray-400" size={20} />
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-purple-600 uppercase tracking-wider whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <Award size={16} />
                                    Unit Mapping
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {pairs.map((pair, idx) => {
                            const isNewSection = idx === 0 || pair.section !== pairs[idx - 1].section;

                            return (
                                <React.Fragment key={pair.questionId || idx}>
                                    {/* Section Header Row */}
                                    {isNewSection && pair.section && (
                                        <tr className="bg-gray-50 border-y border-gray-200">
                                            <td colSpan={6} className="px-6 py-3 text-left">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-200/50 px-2 py-1 rounded border border-gray-200">
                                                    {pair.section}
                                                </span>
                                            </td>
                                        </tr>
                                    )}

                                    <tr className="hover:bg-blue-50/50 transition-colors">
                                        {/* Index */}
                                        <td className="px-4 py-4 text-sm font-mono font-bold text-gray-400 align-top">
                                            {pair.index || idx + 1}
                                        </td>

                                        {/* Question */}
                                        <td className="px-6 py-4 text-sm text-gray-900 align-top">
                                            <div className={`leading-relaxed whitespace-pre-wrap ${pair.parentQuestionId ? 'pl-8 border-l-2 border-blue-200 ml-2' : ''}`}>
                                                {pair.parentQuestionId && (
                                                    <span className="text-xs font-bold text-blue-400 block mb-1">Sub-question</span>
                                                )}
                                                {pair.questionText}

                                                {/* Images */}
                                                {pair.images && pair.images.length > 0 && (
                                                    <div className="mt-4 space-y-2">
                                                        {pair.images.map((img, i) => (
                                                            <div key={i} className="border rounded p-1 bg-gray-50 inline-block mr-2">
                                                                <img
                                                                    src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`}
                                                                    alt={`Question Image ${i + 1}`}
                                                                    className="max-w-full h-auto max-h-64 rounded"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Image Description */}
                                                {pair.imageDescription && (
                                                    <div className="mt-2 p-3 bg-blue-50 text-xs text-blue-800 rounded border border-blue-100">
                                                        <div className="font-bold mb-1 flex items-center gap-1">
                                                            <span>👁️</span> AI Vision Analysis:
                                                        </div>
                                                        {pair.imageDescription}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Arrow */}
                                        <td className="px-2 py-4 text-center align-top">
                                            <ChevronRight className="text-gray-300" size={16} />
                                        </td>

                                        {/* Answer */}
                                        <td className="px-6 py-4 text-sm text-red-700 bg-red-50/30 align-top">
                                            <div className="leading-relaxed whitespace-pre-wrap font-medium">
                                                {pair.answerText}
                                            </div>
                                        </td>

                                        {/* Arrow */}
                                        <td className="px-2 py-4 text-center align-top">
                                            <ChevronRight className="text-purple-300" size={16} />
                                        </td>

                                        {/* Unit Mapping with Enhanced Details */}
                                        <td className="px-6 py-4 text-sm bg-purple-50/30 align-top">
                                            {pair.mappedUnit ? (
                                                <div className="space-y-3">
                                                    {/* Unit Code - Expandable */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-bold text-purple-700 flex items-center gap-2">
                                                            <Award size={14} className="flex-shrink-0" />
                                                            <span>{pair.mappedUnit}</span>
                                                        </div>
                                                        {pair.detailedMapping && (
                                                            <button
                                                                onClick={() => toggleRow(pair.questionId)}
                                                                className="p-1 hover:bg-purple-100 rounded transition-colors"
                                                                title="Show details"
                                                            >
                                                                {expandedRows.has(pair.questionId) ? (
                                                                    <ChevronUp size={16} className="text-purple-600" />
                                                                ) : (
                                                                    <ChevronDown size={16} className="text-purple-600" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Quick Summary */}
                                                    <div className="text-xs text-gray-600 space-y-1">
                                                        {/* Performance Criteria */}
                                                        {pair.mappedCriteria && pair.mappedCriteria.length > 0 && (
                                                            <div>
                                                                <span className="font-semibold">PC:</span>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {pair.mappedCriteria.map(pc => (
                                                                        <span
                                                                            key={pc}
                                                                            className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200"
                                                                        >
                                                                            {pc}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Knowledge Evidence */}
                                                        {pair.mappedKnowledge && pair.mappedKnowledge.length > 0 && (
                                                            <div>
                                                                <span className="font-semibold">KE:</span>
                                                                <span className="ml-1 text-amber-700">
                                                                    {pair.mappedKnowledge.length} item(s)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Expanded Details */}
                                                    {expandedRows.has(pair.questionId) && pair.detailedMapping && (
                                                        <div className="mt-3 pt-3 border-t border-purple-200 space-y-3 text-xs">
                                                            {/* Unit Title */}
                                                            {pair.detailedMapping.unitTitle && (
                                                                <div>
                                                                    <div className="font-semibold text-gray-700 mb-1">Unit Title:</div>
                                                                    <div className="text-gray-600">{pair.detailedMapping.unitTitle}</div>
                                                                </div>
                                                            )}

                                                            {/* Element */}
                                                            {pair.detailedMapping.elementTitle && (
                                                                <div>
                                                                    <div className="font-semibold text-gray-700 mb-1">
                                                                        Element {pair.detailedMapping.elementNumber}:
                                                                    </div>
                                                                    <div className="text-gray-600">{pair.detailedMapping.elementTitle}</div>
                                                                </div>
                                                            )}

                                                            {/* Performance Criteria Full Text */}
                                                            {pair.detailedMapping.performanceCriteriaText && pair.detailedMapping.performanceCriteriaText.length > 0 && (
                                                                <div>
                                                                    <div className="font-semibold text-gray-700 mb-1">Performance Criteria:</div>
                                                                    <ul className="space-y-1 text-gray-600">
                                                                        {pair.detailedMapping.performanceCriteriaText.map((pcText, i) => (
                                                                            <li key={i} className="pl-3 border-l-2 border-purple-200">
                                                                                <span className="font-semibold text-purple-600">
                                                                                    {pair.detailedMapping!.performanceCriteria![i]}:
                                                                                </span>{' '}
                                                                                {pcText}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Knowledge Evidence */}
                                                            {pair.detailedMapping.knowledgeEvidence && pair.detailedMapping.knowledgeEvidence.length > 0 && (
                                                                <div>
                                                                    <div className="font-semibold text-gray-700 mb-1">Knowledge Evidence:</div>
                                                                    <ul className="space-y-1 text-gray-600">
                                                                        {pair.detailedMapping.knowledgeEvidence.slice(0, 5).map((ke, i) => (
                                                                            <li key={i} className="pl-3 border-l-2 border-amber-200">
                                                                                • {ke}
                                                                            </li>
                                                                        ))}
                                                                        {pair.detailedMapping.knowledgeEvidence.length > 5 && (
                                                                            <li className="text-gray-500 italic pl-3">
                                                                                +{pair.detailedMapping.knowledgeEvidence.length - 5} more items
                                                                            </li>
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Performance Evidence */}
                                                            {pair.detailedMapping.performanceEvidence && pair.detailedMapping.performanceEvidence.length > 0 && (
                                                                <div>
                                                                    <div className="font-semibold text-gray-700 mb-1">Performance Evidence:</div>
                                                                    <ul className="space-y-1 text-gray-600">
                                                                        {pair.detailedMapping.performanceEvidence.slice(0, 3).map((pe, i) => (
                                                                            <li key={i} className="pl-3 border-l-2 border-green-200">
                                                                                • {pe}
                                                                            </li>
                                                                        ))}
                                                                        {pair.detailedMapping.performanceEvidence.length > 3 && (
                                                                            <li className="text-gray-500 italic pl-3">
                                                                                +{pair.detailedMapping.performanceEvidence.length - 3} more items
                                                                            </li>
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Source Type */}
                                                            <div className="pt-2 border-t border-purple-100">
                                                                <span className="font-semibold text-gray-700">Source:</span>{' '}
                                                                <span className="text-gray-600 capitalize">{pair.detailedMapping.sourceType}</span>
                                                                {' • '}
                                                                <span className="font-semibold text-gray-700">Confidence:</span>{' '}
                                                                <span className={`font-semibold ${
                                                                    pair.detailedMapping.confidence >= 0.8 ? 'text-green-600' :
                                                                    pair.detailedMapping.confidence >= 0.6 ? 'text-yellow-600' :
                                                                    'text-red-600'
                                                                }`}>
                                                                    {Math.round(pair.detailedMapping.confidence * 100)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <Info size={12} />
                                                    <span className="italic">No mapping available</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                    <span className="font-bold">{pairs.length}</span> question-answer pairs
                    {instructions && instructions.length > 0 && (
                        <span className="ml-2 text-amber-600">
                            • <span className="font-bold">{instructions.length}</span> instruction(s)
                        </span>
                    )}
                    <span className="ml-2 text-purple-600">
                        • <span className="font-bold">{pairs.filter(p => p.mappedUnit).length}</span> mapped to units
                    </span>
                </p>
            </div>
        </div>
    );
}
