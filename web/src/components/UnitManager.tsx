import React, { useState, useEffect } from 'react';
import { Unit } from '../types';
import { Trash2, RotateCcw, RefreshCw, Plus, Search, Info, X, Loader2, CheckCircle, AlertCircle, Upload, Table, LayoutGrid, ChevronRight, ChevronDown, Filter, Download, PanelLeft } from 'lucide-react';
import { MaritimeView } from './MaritimeView';
import { SHEET_CONFIGS } from '../config/maritimeConfig';

interface UnitSummary {
    code: string;
    title: string;
    elementCount: number;
}

export function UnitManager({ onClose }: { onClose?: () => void }) {
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newUnitCode, setNewUnitCode] = useState('');
    const [adding, setAdding] = useState(false);

    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [viewingUnit, setViewingUnit] = useState(false);
    const [processingUnit, setProcessingUnit] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [headerMessage, setHeaderMessage] = useState<{ type: 'success' | 'error' | 'loading'; text: string } | null>(null);
    const [showMaritimeView, setShowMaritimeView] = useState(false);
    const analysisFileInputRef = React.useRef<HTMLInputElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [refreshingAll, setRefreshingAll] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmRefreshAll, setConfirmRefreshAll] = useState(false);

    // Sidebar toggle state
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // New grouping states
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [searchScope, setSearchScope] = useState<string>('all');

    useEffect(() => {
        fetchUnits();
    }, [searchScope]);

    // Polling effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (uploading || processingUnit || refreshingAll) {
            interval = setInterval(() => {
                fetchUnits(true); // Silent fetch
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [uploading, processingUnit, refreshingAll]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUnits();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchUnits = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.set('search', searchTerm);
            if (searchScope !== 'all') params.set('scope', searchScope);

            const res = await fetch(`/api/units?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.units) {
                setUnits(data.units);
                setTotalCount(data.totalCount !== undefined ? data.totalCount : data.units.length);
                setLastUpdated(data.lastUpdated);
            }
        } catch (err) {
            if (!silent) setError('Failed to load units');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const isScrapeFile = file.name.match(/\.(xlsx|xls|txt|csv)$/i);
            const endpoint = isScrapeFile ? '/api/units/scrape-from-file' : '/api/units/upload';

            setHeaderMessage({ type: 'loading', text: isScrapeFile ? 'Scraping started...' : 'Uploading...' });

            const res = await fetch(endpoint, { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                setHeaderMessage({ type: 'success', text: data.message || 'Success' });
                fetchUnits();
                setTimeout(() => setHeaderMessage(null), 5000);
            } else {
                setHeaderMessage({ type: 'error', text: data.error || 'Upload failed' });
                setTimeout(() => setHeaderMessage(null), 5000);
            }
        } catch (err) {
            setHeaderMessage({ type: 'error', text: 'Network error during upload' });
            setTimeout(() => setHeaderMessage(null), 5000);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitCode.trim()) return;

        const codeToCheck = newUnitCode.trim().toUpperCase();
        const existingUnit = units.find(u => u.code === codeToCheck);
        if (existingUnit) {
            handleViewDetails(existingUnit.code);
            setNewUnitCode('');
            return;
        }

        setAdding(true);
        setHeaderMessage({ type: 'loading', text: 'Adding unit...' });
        try {
            const res = await fetch('/api/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeToCheck })
            });
            const data = await res.json();
            if (res.ok) {
                setHeaderMessage({ type: 'success', text: data.message || 'Unit Added' });
                fetchUnits();
                setNewUnitCode('');
                setTimeout(() => setHeaderMessage(null), 5000);
            } else {
                setHeaderMessage({ type: 'error', text: data.error || 'Failed to add' });
                setTimeout(() => setHeaderMessage(null), 5000);
            }
        } catch (err) {
            setHeaderMessage({ type: 'error', text: 'Network error' });
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteUnit = async (code: string) => {
        if (confirmDelete !== code) {
            setConfirmDelete(code);
            setTimeout(() => setConfirmDelete(null), 3000);
            return;
        }
        setProcessingUnit(code);
        try {
            const res = await fetch(`/api/units/${code}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedUnit?.code === code) setSelectedUnit(null);
                fetchUnits();
            }
        } finally {
            setProcessingUnit(null);
            setConfirmDelete(null);
        }
    };

    const handleRefreshUnit = async (code: string) => {
        setProcessingUnit(code);
        try {
            const res = await fetch(`/api/units/${code}`, { method: 'PUT' });
            if (res.ok) {
                const data = await res.json();
                if (selectedUnit?.code === code) setSelectedUnit(data.unit);
                fetchUnits();
            }
        } finally {
            setProcessingUnit(null);
        }
    };

    const handleRefreshAll = async () => {
        if (!confirmRefreshAll) {
            setConfirmRefreshAll(true);
            setTimeout(() => setConfirmRefreshAll(false), 3000);
            return;
        }
        setRefreshingAll(true);
        setHeaderMessage({ type: 'loading', text: 'Refreshing all...' });
        try {
            await fetch('/api/units/refresh', { method: 'POST' });
            setHeaderMessage({ type: 'success', text: 'Refresh complete' });
            fetchUnits();
        } finally {
            setRefreshingAll(false);
            setTimeout(() => setHeaderMessage(null), 3000);
        }
    };

    const handleClearAll = async () => {
        if (!confirmClear) {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
            return;
        }
        setLoading(true);
        try {
            await fetch('/api/units', { method: 'DELETE' });
            fetchUnits();
            setSelectedUnit(null);
            setHeaderMessage({ type: 'success', text: 'Cleared all units' });
        } finally {
            setLoading(false);
            setTimeout(() => setHeaderMessage(null), 3000);
        }
    };

    const handleViewDetails = async (code: string) => {
        setViewingUnit(true);
        if (selectedUnit?.code === code) return;
        setSelectedUnit(null);
        try {
            const res = await fetch(`/api/units/${code}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedUnit(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Group units logic
    const groupedUnits = React.useMemo(() => {
        const sorted = [...units].sort((a, b) =>
            a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' })
        );
        return { 'All Units': sorted };
    }, [units]);

    const toggleCategory = (cat: string) => {
        const next = new Set(expandedCategories);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        setExpandedCategories(next);
    };

    // Initialize expanded
    useEffect(() => {
        if (units.length > 0 && expandedCategories.size === 0) {
            setExpandedCategories(new Set(Object.keys(groupedUnits)));
        }
    }, [units.length, groupedUnits]);

    const handleAnalyzeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Prompt for unit list? For now just use DB units if available
        // Or we could have a multi-file selection. 
        // For simplicity: Single file upload triggers analysis using existing DB units.

        setUploading(true);
        setHeaderMessage({ type: 'loading', text: 'Analyzing...' });

        const formData = new FormData();
        formData.append('assessmentFile', file);
        // We assume units are already loaded in DB or user can upload matched units file separately if needed.
        // If we need simultaneous upload, we'd need a modal.
        // Passing 'saveToDatabase=false' for pure analysis?
        formData.append('saveToDatabase', 'true');

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setHeaderMessage({ type: 'success', text: 'Analysis Complete' });
                // We need to SHOW the results. 
                // Either separate view or modal?
                // For now, let's console log and maybe alert user?
                // Ideally, we switch to a "Analysis Result View".
                console.log('Analysis Result:', data);
                // Trigger a download of the report automatically?
                // or Save it to state to display?

                // Let's create a Blob and download it as JSON report for now to prove it works
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Analysis_Report_${file.name}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => setHeaderMessage(null), 5000);
            } else {
                setHeaderMessage({ type: 'error', text: data.error || 'Analysis failed' });
                setTimeout(() => setHeaderMessage(null), 5000);
            }
        } catch (err) {
            setHeaderMessage({ type: 'error', text: 'Network error during analysis' });
            setTimeout(() => setHeaderMessage(null), 5000);
        } finally {
            setUploading(false);
            if (analysisFileInputRef.current) analysisFileInputRef.current.value = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 md:p-4">
            <div className="bg-white dark:bg-slate-900 w-full h-full md:w-[95vw] md:h-[90vh] md:max-w-[1800px] md:rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                {/* Header: Centered Title, Global Actions on Right */}
                <div className="h-16 px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0 relative gap-4">

                    {/* Left: Toggle & Stats */}
                    <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 w-1/3 min-w-0 flex-1">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`p-2 rounded-lg transition-colors ${!isSidebarOpen ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500'}`}
                            title={isSidebarOpen ? "Collapse List" : "Expand List"}
                        >
                            <PanelLeft className="w-5 h-5" />
                        </button>

                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

                        <span className="font-medium bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {totalCount} Units
                        </span>
                        {lastUpdated && <span className="truncate">Updated {new Date(lastUpdated).toLocaleDateString()} {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>

                    {/* Center: Title (Flex item, not absolute) */}
                    <div className="text-center flex-shrink-0">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">The Validator by SMT</h2>
                    </div>

                    {/* Right: Global Actions */}
                    <div className="flex items-center gap-2 w-1/3 justify-end flex-1 min-w-0">

                        <div className="flex items-center gap-1 mr-4 border-r border-slate-300 dark:border-slate-700 pr-4 shrink-0">
                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleUploadFile}
                                className="hidden"
                                accept=".json,.jsonl,.txt,.xlsx,.xls"
                            />
                            {/* Analysis File Input */}
                            <input
                                type="file"
                                ref={analysisFileInputRef}
                                onChange={handleAnalyzeUpload}
                                className="hidden"
                                accept=".docx"
                            />

                            {/* Dynamic Upload/Status Button */}
                            {headerMessage ? (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold animate-in fade-in zoom-in-95 transition-all
                                    ${headerMessage.type === 'loading' ? 'bg-blue-100 text-blue-700' :
                                        headerMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                                            'bg-red-100 text-red-700'}`}>
                                    {headerMessage.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                                    {headerMessage.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
                                    {headerMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                                    <span className="whitespace-nowrap">{headerMessage.text}</span>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                                        title="Upload / Scrape File"
                                    >
                                        <Upload className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => analysisFileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="p-2 ml-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors flex items-center gap-1"
                                        title="Analyze Assessment (DOCX)"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="text-xs font-bold">Analyze</span>
                                    </button>
                                </>
                            )}

                            {units.length > 0 && (
                                <>
                                    <button
                                        onClick={handleRefreshAll}
                                        disabled={refreshingAll}
                                        className={`p-2 rounded-lg transition-colors ${confirmRefreshAll ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                        title="Refresh All"
                                    >
                                        {refreshingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                    </button>

                                    <button
                                        onClick={handleClearAll}
                                        className={`p-2 rounded-lg transition-colors ${confirmClear ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                        title="Clear All"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>

                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
                            <X className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 flex flex-col md:flex-row relative transition-all">

                    {/* Left Panel: Sidebar */}
                    <div className={`${(selectedUnit && viewingUnit) ? 'hidden md:flex' : 'flex'} w-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 md:flex-none transition-all duration-300 ease-in-out
                        ${isSidebarOpen ? 'md:w-[320px] opacity-100' : 'md:w-0 md:border-r-0 opacity-100 md:opacity-0 overflow-hidden'}`}>

                        {/* Fixed Width Inner Container to prevent layout squishing during transition */}
                        <div className="w-full md:w-[320px] h-full flex flex-col">

                            {/* Top: Search & Filter */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                                {/* Search Bar */}
                                <div className="relative group flex items-center border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm transition-shadow">
                                    <div className="pl-3 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search units..."
                                        className="flex-1 w-full min-w-0 bg-transparent border-none text-sm px-2 py-2.5 focus:ring-0 outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100 font-medium"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoComplete="off"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="px-2 text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Filters Row */}
                                <div className="flex gap-2">
                                    {/* Scope */}
                                    <div className="relative flex-1">
                                        <select
                                            value={searchScope}
                                            onChange={e => setSearchScope(e.target.value)}
                                            className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer outline-none hover:border-slate-400 focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="all">Check All Fields</option>
                                            <option value="code">Check Code</option>
                                            <option value="title">Check Title</option>
                                            <option value="content">Check Content</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                    </div>

                                    {/* Category */}
                                    <div className="relative w-1/3 min-w-[100px]" title="Filter Categories">
                                        <select
                                            value={categoryFilter}
                                            onChange={e => setCategoryFilter(e.target.value)}
                                            className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                        >
                                            <option value="ALL">All Tags</option>
                                            {Object.keys(groupedUnits).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className={`w-full h-full flex items-center justify-between px-3 py-1.5 rounded-lg border transition-colors ${categoryFilter !== 'ALL' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600'}`}>
                                            <span className="text-xs font-medium truncate">{categoryFilter === 'ALL' ? 'Tags' : categoryFilter}</span>
                                            <Filter className="w-3 h-3 opacity-50 ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle: Unit List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loading && units.length === 0 ? (
                                    <div className="flex justify-center p-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                ) : units.length === 0 ? (
                                    <div className="text-center p-8 text-slate-400 text-sm">No units found.</div>
                                ) : (
                                    Object.entries(groupedUnits).map(([category, categoryUnits]) => {
                                        if (categoryFilter !== 'ALL' && category !== categoryFilter) return null;
                                        if (categoryUnits.length === 0) return null;

                                        const isExpanded = expandedCategories.has(category) || categoryFilter !== 'ALL' || Object.keys(groupedUnits).length === 1;

                                        return (
                                            <div key={category} className="mb-3">
                                                {categoryFilter === 'ALL' && Object.keys(groupedUnits).length > 1 && (
                                                    <button
                                                        onClick={() => toggleCategory(category)}
                                                        className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                            {category}
                                                        </span>
                                                    </button>
                                                )}

                                                {isExpanded && (
                                                    <div className="space-y-1 mt-1">
                                                        {categoryUnits.map(unit => (
                                                            <div
                                                                key={unit.code}
                                                                onClick={() => handleViewDetails(unit.code)}
                                                                className={`px-3 py-3 rounded-lg cursor-pointer transition-all border ${selectedUnit?.code === unit.code ? 'bg-blue-50 border-blue-200 shadow-sm z-10' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'} dark:bg-slate-900/50 dark:hover:bg-slate-800`}
                                                            >
                                                                <div className="flex justify-between items-start mb-0.5">
                                                                    <span className={`font-bold text-sm leading-none ${selectedUnit?.code === unit.code ? 'text-blue-700' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                        {unit.code}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                                                                    {unit.title}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Bottom: Add Unit Section (Distinct Footer) */}
                            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <form onSubmit={handleAddUnit} className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Add Unit Code..."
                                            className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={newUnitCode}
                                            onChange={e => setNewUnitCode(e.target.value.toUpperCase())}
                                        />
                                        {newUnitCode && (
                                            <button
                                                type="button"
                                                onClick={() => setNewUnitCode('')}
                                                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={adding || !newUnitCode}
                                        className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center disabled:opacity-50"
                                    >
                                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Details View */}
                    <div className={`${(selectedUnit && viewingUnit) ? 'flex' : 'hidden md:flex'} flex-1 bg-white dark:bg-slate-950 p-0 flex-col min-h-0 overflow-hidden w-full relative z-10`}>
                        {selectedUnit ? (
                            <>
                                {/* Mobile Back Button */}
                                <div className="md:hidden p-2 border-b border-slate-200 flex items-center bg-white z-20">
                                    <button
                                        onClick={() => { setViewingUnit(false); setSelectedUnit(null); }}
                                        className="flex items-center gap-2 text-sm font-medium text-slate-600 px-2 py-1"
                                    >
                                        <ChevronDown className="w-4 h-4 rotate-90" /> Back to List
                                    </button>
                                </div>

                                {/* Unit Header Actions */}
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-start gap-4 shrink-0 z-10 relative">
                                    <div className="flex flex-col lg:flex-row lg:items-baseline gap-2 lg:gap-4 flex-1 min-w-0">
                                        {/* Code & Tag */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                                {selectedUnit.code}
                                            </span>
                                            {SHEET_CONFIGS.find(cfg => (cfg.filterPrefixes || []).some(prefix => selectedUnit?.code.startsWith(prefix))) && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100 self-center">
                                                    {SHEET_CONFIGS.find(cfg => (cfg.filterPrefixes || []).some(prefix => selectedUnit?.code.startsWith(prefix)))?.name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h1 className={`font-medium text-slate-700 dark:text-slate-200 leading-snug ${selectedUnit.title.length > 50 ? 'text-base' : 'text-lg'}`}>
                                                {selectedUnit.title}
                                            </h1>
                                            <a href={`https://training.gov.au/Training/Details/${selectedUnit.code}`} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-blue-500 transition-colors shrink-0 self-center">
                                                <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">↗</div>
                                            </a>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => window.location.href = `/api/units/export?unit=${selectedUnit.code}`}
                                            className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                            title="Download Excel"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRefreshUnit(selectedUnit.code)}
                                            disabled={processingUnit === selectedUnit.code}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            {processingUnit === selectedUnit.code ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUnit(selectedUnit.code)}
                                            disabled={processingUnit === selectedUnit.code}
                                            className={`p-2 rounded-lg transition-colors ${confirmDelete === selectedUnit.code ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Scrollable Maritime Format View */}
                                <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 scroll-smooth">
                                    <div className="min-h-full pb-20">
                                        <MaritimeView
                                            isEmbedded={true}
                                            selectedUnit={selectedUnit}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                                <Search className="w-12 h-12 opacity-20" />
                                <p>Select a unit to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
