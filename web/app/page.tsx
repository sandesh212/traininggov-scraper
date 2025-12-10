'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Sparkles, Award, TrendingUp, List, Download, LayoutGrid, RefreshCw, FileSpreadsheet, X, ArrowLeft, RotateCcw, Database } from 'lucide-react';
import { Toast, ToastType } from '@/components/Toast';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ReportData } from '@/types';
import { generateExcelReport, generateUnitDataExcel } from '@/utils/excelExport';

const QuestionAnswerTable = dynamic(() => import('@/components/QuestionAnswerTable').then(mod => mod.QuestionAnswerTable), { ssr: false });
const UnitManager = dynamic(() => import('@/components/UnitManager').then(mod => mod.UnitManager), { ssr: false });

export default function Home() {
    const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
    const [unitsFile, setUnitsFile] = useState<File | null>(null);
    const [unitCount, setUnitCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ReportData | null>(null);
    const [showUnitManager, setShowUnitManager] = useState(false);
    const [showInvalidModal, setShowInvalidModal] = useState(false); // New state
    const [invalidUnitsList, setInvalidUnitsList] = useState<{ code: string; url: string; reason?: string }[]>([]); // Updated with reason
    const [saveToDatabase, setSaveToDatabase] = useState(true); // Default: save to database

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'info',
        isVisible: false
    });

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type, isVisible: true });
    };

    const [loadingMessage, setLoadingMessage] = useState('Initializing...');

    // Fetch unit count on mount and when manager closes
    useEffect(() => {
        fetchUnitCount();
    }, [showUnitManager]);

    const fetchUnitCount = async () => {
        try {
            const res = await fetch('/api/units', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setUnitCount(data.count || 0);
            }
        } catch (e) {
            console.error('Failed to fetch unit count', e);
        }
    };

    useEffect(() => {
        if (!loading) return;
        const messages = [
            'Reading Document Structure...',
            'Detecting Units of Competency...',
            'Fetching Live Data from training.gov.au...',
            'Vectorizing Knowledge Base...',
            'Analyzing Questions against Criteria...',
            'Finalizing Compliance Matrix...'
        ];
        let i = 0;
        setLoadingMessage(messages[0]);
        const interval = setInterval(() => {
            i++;
            if (i < messages.length) {
                setLoadingMessage(messages[i]);
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [loading]);

    const handleAnalyze = async (ignoreInvalid = false) => {
        if (!assessmentFile) return;

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('assessmentFile', assessmentFile);
            if (unitsFile) {
                formData.append('unitsFile', unitsFile);
            }
            if (ignoreInvalid) {
                formData.append('ignoreInvalid', 'true');
            }
            formData.append('saveToDatabase', saveToDatabase.toString());

            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            // Check for invalid units warning (status 200 but has invalidUnits)
            /* 
            // DISABLED BY USER REQUEST: Stop checking valid/invalid units
            if (data.invalidUnits && data.invalidUnits.length > 0) {
                setInvalidUnitsList(data.invalidUnits);
                setShowInvalidModal(true);
                setLoading(false); // Pause loading state while user decides
                return;
            }
            */

            setReport(data);
            showToast('Analysis complete! Report generated successfully.', 'success');
        } catch (err) {
            showToast((err as Error).message, 'error');
        } finally {
            if (!ignoreInvalid && !showInvalidModal) {
                setLoading(false);
            }
        }
    };

    const handleConfirmInvalid = () => {
        setShowInvalidModal(false);
        handleAnalyze(true);
    };

    const handleCancelInvalid = () => {
        setShowInvalidModal(false);
        setLoading(false);
    };

    const downloadReport = () => {
        if (!report) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "compliance_report.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('Report JSON downloaded.', 'info');
    };

    const resetAnalysis = () => {
        setReport(null);
        setAssessmentFile(null);
        setUnitsFile(null); // Reset units file
    };

    // Determine if analyze button should be enabled
    const canAnalyze = unitCount > 0
        ? !!assessmentFile
        : !!assessmentFile && !!unitsFile;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
            />

            <ConfirmationModal
                isOpen={showInvalidModal}
                title="Invalid Units Detected"
                message="The following units from your list could not be verified on training.gov.au. They may be invalid codes, superseded, or the server is unreachable."
                items={invalidUnitsList}
                confirmText="Continue Without Them"
                cancelText="Stop & Fix File"
                onConfirm={handleConfirmInvalid}
                onCancel={handleCancelInvalid}
                type="warning"
            />

            {/* Unit Manager Modal */}
            <AnimatePresence>
                {showUnitManager && (
                    <UnitManager onClose={() => setShowUnitManager(false)} />
                )}
            </AnimatePresence>

            {/* Professional Header */}
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <motion.div
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.5 }}
                            className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-sm"
                        >
                            <Sparkles size={14} className="text-white sm:w-4 sm:h-4" />
                        </motion.div>
                        <div>
                            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-gray-900 whitespace-nowrap">
                                The Validator by SMT
                            </h1>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            onClick={() => setShowUnitManager(true)}
                            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors border border-gray-200"
                        >
                            <Database size={12} className="sm:w-3.5 sm:h-3.5" />
                            <span className="hidden xs:inline sm:inline">Manage Units</span>
                            <span className="inline xs:hidden sm:hidden">Units</span>
                        </button>
                        <div className="hidden sm:flex text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 whitespace-nowrap">
                            v2.3.0 • Local AI
                        </div>
                    </div>
                </div>
            </motion.header>

            <main className="max-w-7xl mx-auto px-6 py-8">

                <AnimatePresence mode="wait">
                    {loading ? (
                        /* Loading View */
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[60vh]"
                        >
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                <Loader2 className="animate-spin text-blue-600 relative z-10" size={64} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Assessment</h3>
                            <p className="text-gray-500 text-lg mb-8 max-w-md text-center">{loadingMessage}</p>

                            <div className="w-full max-w-md bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                                <motion.div
                                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full"
                                    initial={{ width: "5%" }}
                                    animate={{ width: "95%" }}
                                    transition={{ duration: 15, ease: "easeInOut" }}
                                />
                            </div>
                        </motion.div>
                    ) : !report ? (
                        <motion.div
                            key="upload-section"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="max-w-3xl mx-auto mt-12"
                        >
                            <div className="text-center mb-12">
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight"
                                >
                                    Validate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Assessment Tool</span>
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed"
                                >
                                    Upload your DOCX file. Our local AI will map every question to the <span className="font-semibold text-blue-600">{unitCount > 0 ? `${unitCount} units` : 'units'}</span> in your database and generate a professional compliance matrix instantly.
                                </motion.p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Step 1: Units Scope (Optional) */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className={`
                                        group relative p-8 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white shadow-sm hover:shadow-md
                                        ${unitsFile
                                            ? 'border-purple-500 bg-purple-50/30'
                                            : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50/30'}
                                    `}
                                >
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onClick={(e) => (e.currentTarget.value = '')}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 5 * 1024 * 1024) {
                                                    showToast('Units file is too large (max 5MB)', 'error');
                                                    return;
                                                }
                                                if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                                                    showToast('Only .xlsx or .xls files are supported for units list', 'error');
                                                    return;
                                                }
                                                setUnitsFile(file);
                                                showToast('Units file selected successfully', 'success');
                                            }
                                        }}
                                    />
                                    <div className="flex flex-col items-center pointer-events-none">
                                        <div className={`
                                            w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors
                                            ${unitsFile ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600'}
                                        `}>
                                            <List size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold mb-1 text-gray-900">
                                            {unitsFile ? 'Units List Selected' : unitCount > 0 ? '1. Upload Units List (Optional)' : '1. Upload Units List (Required)'}
                                        </h3>
                                        <p className="text-gray-500 text-sm text-center">
                                            {unitsFile ? unitsFile.name : 'Limit scope to specific units (.xlsx)'}
                                        </p>
                                    </div>
                                    {unitsFile && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUnitsFile(null);
                                            }}
                                            className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors z-20"
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </motion.div>

                                {/* Step 2: Assessment File */}
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className={`
                                        group relative p-8 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white shadow-sm hover:shadow-xl
                                        ${assessmentFile
                                            ? 'border-blue-500 bg-blue-50/30'
                                            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/30'}
                                    `}
                                >
                                    <input
                                        id="assessment-input"
                                        type="file"
                                        accept=".docx"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onClick={(e) => (e.currentTarget.value = '')}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 10 * 1024 * 1024) {
                                                    showToast('File is too large (max 10MB)', 'error');
                                                    return;
                                                }
                                                if (!file.name.endsWith('.docx')) {
                                                    showToast('Only .docx files are supported', 'error');
                                                    return;
                                                }
                                                setAssessmentFile(file);
                                                showToast('Assessment file selected successfully', 'success');
                                            }
                                        }}
                                    />
                                    <div className="flex flex-col items-center pointer-events-none">
                                        <div className={`
                                            w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors
                                            ${assessmentFile ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}
                                        `}>
                                            {assessmentFile ? <CheckCircle size={32} /> : <Upload size={32} />}
                                        </div>
                                        <h3 className="text-lg font-bold mb-1 text-gray-900">
                                            {assessmentFile ? 'Assessment Selected' : '2. Upload Assessment'}
                                        </h3>
                                        <p className="text-gray-500 text-sm text-center">
                                            {assessmentFile ? assessmentFile.name : 'The DOCX file to analyze'}
                                        </p>
                                    </div>
                                    {assessmentFile && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAssessmentFile(null);
                                            }}
                                            className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors z-20"
                                            title="Remove file"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </motion.div>
                            </div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="mt-10 space-y-6"
                            >
                                {/* Save to Database Toggle */}
                                <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-dashed border-blue-200 rounded-2xl">
                                    <input
                                        type="checkbox"
                                        id="saveToDatabase"
                                        checked={saveToDatabase}
                                        onChange={(e) => setSaveToDatabase(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label
                                        htmlFor="saveToDatabase"
                                        className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                                    >
                                        <span className="block text-base font-semibold text-gray-900">💾 Save validated units to database</span>
                                        <span className="block text-xs text-gray-600 mt-1">
                                            {saveToDatabase
                                                ? "Units will be added/updated in the database for future use"
                                                : "One-time validation only (units won't be saved)"}
                                        </span>
                                    </label>
                                </div>

                                {/* Analyze Button */}
                                <div className="text-center">
                                    <button
                                        onClick={() => handleAnalyze(false)}
                                        disabled={!canAnalyze || loading}
                                        className={`
                                            px-12 py-5 rounded-2xl text-xl font-bold shadow-xl transition-all transform hover:-translate-y-1 active:scale-95
                                            ${!canAnalyze || loading
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-blue-500/30'}
                                        `}
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-3">
                                                <Loader2 className="animate-spin" size={24} />
                                                <div className="flex flex-col items-start text-left">
                                                    <span className="text-lg">Processing...</span>
                                                    <span className="text-xs font-normal opacity-90">{loadingMessage}</span>
                                                </div>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-3">
                                                Run Compliance Analysis
                                            </span>
                                        )}
                                    </button>
                                    {(!(unitCount > 0) && !unitsFile) && (
                                        <p className="mt-4 text-sm text-red-600 font-medium">
                                            Units list is required if no unit data is present.
                                        </p>
                                    )}
                                    {unitsFile && (
                                        <p className="mt-4 text-sm text-purple-600 font-medium animate-pulse">
                                            Scoped to units from {unitsFile.name}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    ) : ( /* Report Dashboard */
                        <motion.div
                            key="report-dashboard"
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="space-y-8"
                        >
                            {/* Report Header */}
                            <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Compliance Report</h2>
                                    <p className="text-gray-500 text-xs sm:text-sm mt-1">
                                        Analyzed <span className="font-medium text-gray-900">{report.questionsCount} questions</span> against <span className="font-medium text-gray-900">{report.totalUnitsInDatabase} units</span>.
                                    </p>
                                    {/* Database Stats - Real-time Update Tracking */}
                                    {report.databaseStats && (report.databaseStats.added > 0 || report.databaseStats.modified > 0 || report.databaseStats.deleted > 0) && (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-600">📊 Database Updates:</span>
                                            {report.databaseStats.added > 0 && (
                                                <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200">
                                                    ✓ Added: {report.databaseStats.added}
                                                </span>
                                            )}
                                            {report.databaseStats.modified > 0 && (
                                                <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200">
                                                    ↻ Modified: {report.databaseStats.modified}
                                                </span>
                                            )}
                                            {report.databaseStats.deleted > 0 && (
                                                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200">
                                                    ✗ Deleted: {report.databaseStats.deleted}
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-500">
                                                (Total: {report.databaseStats.total})
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setReport(null)}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden xs:inline">Back to Upload</span>
                                        <span className="inline xs:hidden">Back</span>
                                    </button>
                                    <button
                                        onClick={() => handleAnalyze(false)}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <RefreshCw size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Re-run Analysis</span>
                                        <span className="inline sm:hidden">Re-run</span>
                                    </button>
                                    <button
                                        onClick={() => generateExcelReport(report)}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <FileSpreadsheet size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Export Excel</span>
                                        <span className="inline sm:hidden">Excel</span>
                                    </button>
                                    <button
                                        onClick={downloadReport}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <Download size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Export JSON</span>
                                        <span className="inline sm:hidden">JSON</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.location.href = '/api/units/export';
                                        }}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <FileSpreadsheet size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Export All Units</span>
                                        <span className="inline sm:hidden">Units</span>
                                    </button>
                                    <button
                                        onClick={resetAnalysis}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                    >
                                        <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden xs:inline">Reset</span>
                                    </button>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatsCard
                                    icon={<FileText size={24} />}
                                    label="Questions"
                                    value={report.questionsCount}
                                    color="blue"
                                    delay={0.1}
                                />
                                <StatsCard
                                    icon={<Award size={24} />}
                                    label="Mapped Units"
                                    value={report.mappedUnits?.length || 0}
                                    color="purple"
                                    delay={0.2}
                                />
                                <StatsCard
                                    icon={<TrendingUp size={24} />}
                                    label="Compliance"
                                    value={`${Math.round(((report.results?.filter(r => r.isValid).length || 0) / (report.questionsCount || 1)) * 100)}%`}
                                    color="green"
                                    delay={0.3}
                                />
                            </div>

                            {/* Simplified View - Q&A Table Only */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                            >
                                {/* Document Title & Instructions */}
                                <div className="p-6 border-b border-gray-200 bg-white">
                                    <h1 className="text-3xl font-extrabold text-red-600 mb-6 text-center leading-tight">
                                        {report.title || 'Assessment Document'}
                                    </h1>

                                    {report.instructions && report.instructions.length > 0 && (
                                        <div className="mt-8 border-2 border-black rounded-sm overflow-hidden">
                                            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] divide-y md:divide-y-0 md:divide-x-2 divide-black">
                                                {/* Left Column - Header */}
                                                <div className="bg-white p-4 font-bold text-black text-sm flex items-start">
                                                    Instructions
                                                </div>
                                                {/* Right Column - Content */}
                                                <div className="bg-white p-4">
                                                    <ul className="list-disc pl-5 space-y-2">
                                                        {report.instructions.map((inst: string, i: number) => (
                                                            <li key={i} className="text-sm text-black leading-relaxed">{inst}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-gray-50 min-h-[500px]">
                                    <QuestionAnswerTable
                                        instructions={report.instructions}
                                        pairs={(report.redTextAnswers || []).map((answer: any, idx: number) => {
                                            // Find corresponding validation result for this question
                                            const result = report.results?.find((r: any) => r.questionId === answer.questionId);

                                            return {
                                                questionId: answer.questionId || `Q${idx + 1}`,
                                                questionText: answer.questionText || report.results?.[idx]?.questionText || 'N/A',
                                                answerText: answer.text || '',
                                                index: idx + 1,
                                                mappedUnit: result?.mappedUnit,
                                                mappedCriteria: result?.mappedCriteria || [],
                                                mappedKnowledge: result?.mappedKnowledge || [],
                                                detailedMapping: result?.detailedMapping,
                                                section: answer.section || result?.questionSection || 'General',
                                                parentQuestionId: result?.parentQuestionId,
                                                images: result?.images,
                                                imageDescription: result?.imageDescription
                                            };
                                        })}
                                    />
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

function StatsCard({ icon, label, value, color, delay, onClick }: { icon: React.ReactNode, label: string, value: string | number, color: 'blue' | 'purple' | 'green', delay: number, onClick?: () => void }) {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        purple: 'bg-purple-100 text-purple-600',
        green: 'bg-green-100 text-green-600'
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.4 }}
            whileHover={{ y: -5 }}
            onClick={onClick}
            className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg transition-all ${onClick ? 'cursor-pointer hover:border-blue-300' : ''}`}
        >
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-4xl font-extrabold text-gray-900 mt-2">{value}</div>
        </motion.div>
    );
}
