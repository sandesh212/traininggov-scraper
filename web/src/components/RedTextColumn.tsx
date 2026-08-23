import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { QuestionResult } from '../types';

interface RedTextColumnProps {
    segments: string[];
    results: Array<Pick<QuestionResult, 'questionId' | 'questionText' | 'questionSection'>>;
}

interface GroupedAnswer {
    index: number;
    text: string;
    questionId?: string;
    questionNumber?: string;
    questionText?: string;
}

interface AnswerSection {
    sectionName: string;
    answers: GroupedAnswer[];
}

export function RedTextColumn({ segments, results }: RedTextColumnProps) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    if (!segments || segments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={48} className="text-gray-300 mb-4" />
                <h2 className="text-xl font-bold text-gray-700 mb-2">No Red Text Found</h2>
                <p className="text-gray-500">We couldn&apos;t extract any text with red color formatting from the document.</p>
            </div>
        );
    }

    const [headerSegment, ...bodySegments] = segments;

    // Group answers by section
    const groupAnswersBySection = (): AnswerSection[] => {
        const sections: Record<string, GroupedAnswer[]> = {};

        bodySegments.forEach((segment, idx) => {
            // Try to match this answer with a question from results
            let matchedSection = 'Other';
            let questionNumber = `${idx + 1}`;
            let questionText = '';

            // Find which question contains this answer
            for (const result of results) {
                if (result.questionText && result.questionText.includes(segment)) {
                    matchedSection = result.questionSection || 'General';
                    // Extract question number from questionId (e.g., "Part 1 - Q2" -> "Q2")
                    const idParts = result.questionId.split(' - ');
                    questionNumber = idParts.length > 1 ? idParts[1] : result.questionId;

                    // Extract ONLY the question part - remove answers
                    let cleanText = result.questionText;

                    // Step 1: Remove all [[ANSWER: text ]] tags
                    cleanText = cleanText.replace(/\[\[ANSWER:\s*[\s\S]*?\]\]/gi, '');

                    // Step 2: Remove the actual answer text (segment)
                    // Normalize both for comparison (remove ALL whitespace and punctuation)
                    const fullyNormalizedClean = cleanText.toLowerCase().replace(/[\s\W_]+/g, '');
                    const fullyNormalizedSegment = segment.toLowerCase().replace(/[\s\W_]+/g, '');

                    if (fullyNormalizedClean.includes(fullyNormalizedSegment)) {
                        // Find where the answer starts in the normalized text
                        const answerStartIndex = fullyNormalizedClean.indexOf(fullyNormalizedSegment);

                        // Now map this back to the original text position
                        // Count characters in original text until we reach the normalized position
                        let charCount = 0;
                        let originalIndex = 0;

                        for (let i = 0; i < cleanText.length && charCount < answerStartIndex; i++) {
                            const char = cleanText[i];
                            // Only count alphanumeric characters (same as normalization)
                            if (char.match(/[a-z0-9]/i)) {
                                charCount++;
                            }
                            originalIndex = i + 1;
                        }

                        // Take only the text before the answer
                        cleanText = cleanText.substring(0, originalIndex);
                    }

                    // Trim whitespace and normalize
                    cleanText = cleanText
                        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
                        .replace(/[ \t]+/g, ' ') // Normalize spaces
                        .trim();

                    questionText = cleanText;
                    break;
                }
            }

            if (!sections[matchedSection]) {
                sections[matchedSection] = [];
            }

            sections[matchedSection].push({
                index: idx + 1,
                text: segment,
                questionNumber,
                questionText
            });
        });

        return Object.entries(sections)
            .map(([sectionName, answers]) => ({
                sectionName,
                answers
            }))
            .sort((a, b) => {
                // Sort sections by their typical order
                const order = ['Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5', 'Part 6', 'Part 7'];
                const aIdx = order.findIndex(o => a.sectionName.includes(o));
                const bIdx = order.findIndex(o => b.sectionName.includes(o));
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return a.sectionName.localeCompare(b.sectionName);
            });
    };

    const sections = groupAnswersBySection();

    const toggleSection = (sectionName: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionName]: !prev[sectionName]
        }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2">
                    <FileText size={20} />
                    Extracted Red Text Answers
                </h3>
                <p className="text-red-700 text-sm mb-4">
                    Answers extracted from red text in the document, organized by section with question references.
                </p>

                {/* Header Segment Display */}
                <div className="bg-white/50 rounded-lg p-4 border border-red-100">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-1">
                        Document Header / Title
                    </span>
                    <div className="text-lg font-bold text-red-900 whitespace-pre-wrap">
                        {headerSegment}
                    </div>
                </div>
            </div>

            {/* Grouped Answers by Section */}
            <div className="space-y-4">
                {sections.map((section) => {
                    const isExpanded = expandedSections[section.sectionName] !== false; // Default to expanded

                    return (
                        <div key={section.sectionName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.sectionName)}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-white hover:from-red-100 hover:to-red-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                        <ChevronDown size={20} className="text-red-600" />
                                    ) : (
                                        <ChevronRight size={20} className="text-red-600" />
                                    )}
                                    <h4 className="text-lg font-bold text-gray-900">{section.sectionName}</h4>
                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        {section.answers.length} {section.answers.length === 1 ? 'answer' : 'answers'}
                                    </span>
                                </div>
                            </button>

                            {/* Answers List */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="border-t border-gray-200"
                                    >
                                        <div className="p-4 space-y-3">
                                            {section.answers.map((answer) => (
                                                <div
                                                    key={answer.index}
                                                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-red-200 transition-all shadow-sm hover:shadow-md"
                                                >
                                                    {/* Question Number Badge */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="font-mono text-xs font-bold text-gray-400 select-none">
                                                            #{answer.index}
                                                        </span>
                                                        {answer.questionNumber && (
                                                            <span className="font-mono text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                                                                {answer.questionNumber}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Question Text */}
                                                    {answer.questionText && (
                                                        <div className="mb-3 pb-3 border-b border-gray-200">
                                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                                Question:
                                                            </div>
                                                            <div className="text-sm text-gray-700 leading-relaxed">
                                                                {answer.questionText}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Answer Text */}
                                                    <div>
                                                        <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                            <span>Answer:</span>
                                                            <div className="flex-1 h-px bg-red-200"></div>
                                                        </div>
                                                        <div className="text-red-700 font-medium leading-relaxed whitespace-pre-wrap bg-red-50/50 rounded p-3 border-l-3 border-red-300">
                                                            {answer.text}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
