
import React, { useState, useEffect } from 'react';
import { Unit } from '../types';
import { Trash2, RotateCcw, Plus, Search, Info, X, Loader2, CheckCircle, AlertCircle, Upload } from 'lucide-react';

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
    const [addResult, setAddResult] = useState<{ success: boolean; message: string; added?: string[]; failed?: { code: string; reason: string }[] } | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [viewingUnit, setViewingUnit] = useState(false);
    const [processingUnit, setProcessingUnit] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [refreshingAll, setRefreshingAll] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmRefreshAll, setConfirmRefreshAll] = useState(false);

    useEffect(() => {
        fetchUnits();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUnits();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchUnits = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.set('search', searchTerm);

            const res = await fetch(`/api/units?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.units) {
                setUnits(data.units);
                setTotalCount(data.totalCount !== undefined ? data.totalCount : data.units.length);
                setLastUpdated(data.lastUpdated);
            }
        } catch (err) {
            setError('Failed to load units');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setAddResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/units/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setAddResult({ success: true, message: data.message });
                fetchUnits();
            } else {
                setAddResult({ success: false, message: data.error || 'Upload failed' });
            }
        } catch (err) {
            setAddResult({ success: false, message: 'Network error during upload' });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset
        }
    };

    const handleAddUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnitCode.trim()) return;

        setAdding(true);
        setAddResult(null);
        try {
            const res = await fetch('/api/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: newUnitCode.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                const hasAdded = data.added && data.added.length > 0;
                const hasFailed = data.failed && data.failed.length > 0;

                let success = true;
                let message = data.message;

                // If nothing was added but there were failures, mark as failed
                if (hasFailed && !hasAdded) {
                    success = false;
                    message = 'Failed to add units';
                }

                setAddResult({
                    success,
                    message,
                    added: data.added,
                    failed: data.failed
                });

                if (hasAdded) {
                    setNewUnitCode('');
                    fetchUnits(); // Refresh list
                }
            } else {
                setAddResult({ success: false, message: data.error || 'Failed to add unit' });
            }
        } catch (err) {
            setAddResult({ success: false, message: 'Network error' });
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteUnit = async (code: string) => {
        // If not confirmed yet, set state
        if (confirmDelete !== code) {
            setConfirmDelete(code);
            // Auto-clear confirmation after 3s
            setTimeout(() => setConfirmDelete(null), 3000);
            return;
        }

        setProcessingUnit(code);
        setConfirmDelete(null);
        try {
            const res = await fetch(`/api/units/${code}`, { method: 'DELETE' });
            if (res.ok) {
                if (selectedUnit?.code === code) setSelectedUnit(null);
                fetchUnits();
            } else {
                setError('Failed to delete unit');
            }
        } catch (err) {
            setError('Failed to delete unit');
        } finally {
            setProcessingUnit(null);
        }
    };

    const handleRefreshUnit = async (code: string) => {
        setProcessingUnit(code);
        try {
            const res = await fetch(`/api/units/${code}`, { method: 'PUT' });
            if (res.ok) {
                const data = await res.json();
                if (selectedUnit?.code === code) setSelectedUnit(data.unit);
                fetchUnits(); // Update timestamp/list
            } else {
                setError('Failed to update unit');
            }
        } catch (err) {
            setError('Failed to update unit');
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

        setConfirmRefreshAll(false);
        setRefreshingAll(true);
        try {
            const res = await fetch('/api/units/refresh', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                // Show success via addResult or similar toast mechanism if we had one, 
                // for now we can just rely on the list updating or use a temporary success state.
                // Re-using addResult for generic feedback:
                setAddResult({ success: true, message: data.message });
                fetchUnits();
            } else {
                setAddResult({ success: false, message: 'Failed to refresh units' });
            }
        } catch (err) {
            setAddResult({ success: false, message: 'Failed to refresh units' });
        } finally {
            setRefreshingAll(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirmClear) {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
            return;
        }

        setConfirmClear(false);
        setLoading(true);
        try {
            await fetch('/api/units', { method: 'DELETE' });
            fetchUnits();
            setSelectedUnit(null);
            setAddResult({ success: true, message: 'All units cleared' });
        } catch (err) {
            setAddResult({ success: false, message: 'Failed to clear units' });
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/units/restore', { method: 'POST' });
            if (res.ok) {
                fetchUnits();
                setAddResult({ success: true, message: 'Units restored' });
            } else {
                setAddResult({ success: false, message: 'Nothing to undo' });
            }
        } catch (err) {
            setAddResult({ success: false, message: 'Failed to restore' });
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (code: string) => {
        setViewingUnit(true);
        // Don't clear if clicking same unit
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

    // Filtering is now done server-side
    // const filteredUnits = units.filter(u =>
    //     u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    //     u.title.toLowerCase().includes(searchTerm.toLowerCase())
    // );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Unit Management</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Manage your local database of Units of Competency
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left Panel: List & Actions */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 min-w-[300px]">

                        {/* Toolbar */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">

                            {/* Stats & Timestamp */}
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>{totalCount} Units Stored</span>
                                {lastUpdated && <span>Updated: {new Date(lastUpdated).toLocaleString()}</span>}
                            </div>

                            {/* Add Unit Form */}
                            <form onSubmit={handleAddUnit} className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Unit codes (e.g. BSBADM502, HLTAID011)"
                                        className="w-full px-3 py-2 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newUnitCode}
                                        onChange={e => setNewUnitCode(e.target.value.toUpperCase())}
                                    />
                                    {newUnitCode && (
                                        <button
                                            type="button"
                                            onClick={() => setNewUnitCode('')}
                                            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={adding || !newUnitCode}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Add
                                </button>
                            </form>

                            {/* Upload Button */}
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleUploadFile}
                                    className="hidden"
                                    accept=".json,.jsonl,.txt"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Upload Local File (JSON/JSONL)
                                </button>
                            </div>

                            {/* Inline Notification Area */}
                            {addResult && (
                                <div className={`text-xs p-2 rounded border ${addResult.success ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                                    <div className="flex items-center gap-2 font-medium">
                                        {addResult.success ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {addResult.message}
                                    </div>
                                    {addResult.failed && addResult.failed.length > 0 && (
                                        <div className="mt-1 pl-5 space-y-0.5 opacity-90">
                                            {addResult.failed.map((f, i) => (
                                                <div key={i}>• {f.code}: {f.reason}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search units & content..."
                                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Global Actions */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleRefreshAll}
                                    disabled={refreshingAll}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${confirmRefreshAll ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'}`}
                                >
                                    {refreshingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                    {confirmRefreshAll ? 'Confirm?' : 'Refresh All'}
                                </button>
                                <button
                                    onClick={handleClearAll}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors ${confirmClear ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'}`}
                                >
                                    <Trash2 className="w-3 h-3" />
                                    {confirmClear ? 'Confirm?' : 'Clear All'}
                                </button>
                            </div>
                            <button
                                onClick={handleUndo}
                                className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" /> Undo Delete
                            </button>
                        </div>

                        {/* Unit List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loading && units.length === 0 ? (
                                <div className="flex justify-center p-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : units.length === 0 ? (
                                <div className="text-center p-8 text-slate-400 text-sm">No units found.</div>
                            ) : (
                                units.map(unit => (
                                    <div
                                        key={unit.code}
                                        onClick={() => handleViewDetails(unit.code)}
                                        className={`p-3 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${selectedUnit?.code === unit.code ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{unit.code}</span>
                                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{unit.elementCount} Elements</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{unit.title}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Details View */}
                    <div className="flex-[1.5] bg-slate-50 dark:bg-slate-950/50 overflow-y-auto p-6">
                        {selectedUnit ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedUnit.code}</h3>
                                        <h4 className="text-lg text-slate-700 dark:text-slate-300 mt-1">{selectedUnit.title}</h4>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRefreshUnit(selectedUnit.code)}
                                            disabled={processingUnit === selectedUnit.code}
                                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Update from training.gov.au"
                                        >
                                            {processingUnit === selectedUnit.code ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUnit(selectedUnit.code)}
                                            disabled={processingUnit === selectedUnit.code}
                                            className={`p-2 rounded-lg transition-colors ${confirmDelete === selectedUnit.code ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                            title="Delete Unit"
                                        >
                                            {processingUnit === selectedUnit.code ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmDelete === selectedUnit.code ? <span className="text-xs font-bold px-1">Confirm?</span> : <Trash2 className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {selectedUnit.modificationHistory && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Modification History</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs">
                                            {selectedUnit.modificationHistory}
                                        </div>
                                    </div>
                                )}

                                {selectedUnit.application && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Application</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            {selectedUnit.application}
                                        </div>
                                    </div>
                                )}

                                {selectedUnit.unitSector && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Unit Sector</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            {selectedUnit.unitSector}
                                        </div>
                                    </div>
                                )}

                                {/* Elements & Performance Criteria - Unified Table */}
                                <div className="space-y-3">
                                    <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800">Elements & Performance Criteria</h5>
                                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-2 w-28">Criteria</th>
                                                    <th className="px-4 py-2">Performance Criteria</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {selectedUnit.elements.map((el, elIdx) => (
                                                    <React.Fragment key={elIdx}>
                                                        {/* Element Title Row */}
                                                        <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                                                            <td colSpan={2} className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">
                                                                {el.title}
                                                            </td>
                                                        </tr>
                                                        {/* PC Rows */}
                                                        {el.performanceCriteria.map((pc, pcIdx) => {
                                                            let cleanText = pc.text.trim();
                                                            // Aggressively strip ID if the text starts with it (e.g. "1.1" in "1.1 Nature...")
                                                            if (cleanText.startsWith(pc.id)) {
                                                                cleanText = cleanText.substring(pc.id.length).trim();
                                                            }
                                                            // Also cleanup common leading separators users might have put in text column
                                                            // e.g. "1.1. Nature" -> "Nature", or just "Nature"
                                                            cleanText = cleanText.replace(/^[\.\-\:\)\s]+/, '');

                                                            return (
                                                                <tr key={`${elIdx}-${pcIdx}`} className="border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                    <td className="px-4 py-2 font-mono text-xs text-slate-500 align-top border-r border-slate-100 dark:border-slate-800/50">
                                                                        {pc.id}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                                                                        {cleanText}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Helper for rendering evidence strings as tables */}
                                {(() => {
                                    const renderEvidenceTable = (title: string, content?: string) => {
                                        if (!content) return null;

                                        // Split by newline. We could also try splitting by strict bullet patterns if text is clumped,
                                        // but usually newlines are the reliable delimiter.
                                        const lines = content.split('\n').filter(line => line.trim());

                                        return (
                                            <div>
                                                <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">{title}</h5>
                                                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                                                            <tr>
                                                                <th className="px-4 py-2 w-28">ID</th>
                                                                <th className="px-4 py-2">Evidence</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {lines.map((line, idx) => {
                                                                let id = '';
                                                                let text = line.trim();

                                                                // Capture first "word" token as probable ID. Allow it to be mashed with text (no space required in regex, though we prefer it).
                                                                // e.g. "1.1Nature" -> id="1.1", text="Nature"
                                                                const match = line.match(/^\s*([^\s]{1,15})\s*(.*)$/);

                                                                let candidateId = match ? match[1] : '';
                                                                let remainder = match ? match[2] : line;

                                                                const looksLikeId = candidateId && (
                                                                    /^[\d\.\-\•\)\(\*\>]+$/.test(candidateId) || // 1.1, -, •
                                                                    /^([A-Z]{1,2}|KE|PE|AC|PC)[\d\.]*$/i.test(candidateId) || // P1, K12, KE1.0
                                                                    (candidateId.length < 6 && /[\d]/.test(candidateId)) // Short & has digit
                                                                );

                                                                if (looksLikeId) {
                                                                    id = candidateId;
                                                                    text = remainder;
                                                                } else {
                                                                    // If no separated ID found, check if the line ITSELF starts with a bullet pattern that wasn't separated
                                                                    // e.g. "Values of X" (Values looks like ID? No.)
                                                                    // But if user wants to strip bullets that are embedded:
                                                                    const embeddedBullet = line.match(/^(\s*[\•\-\u2022]\s+)(.*)/);
                                                                    if (embeddedBullet) {
                                                                        id = "•";
                                                                        text = embeddedBullet[2];
                                                                    }
                                                                }

                                                                // Final polish: Strip repeating ID or leading punctuation from text
                                                                if (id && text.startsWith(id)) {
                                                                    text = text.substring(id.length).trim();
                                                                }
                                                                text = text.replace(/^[\.\-\:\)\s]+/, '');

                                                                // If we found an ID, render as split row. 
                                                                // If text is effectively empty but id exists (rare), behave carefully.
                                                                if (id) {
                                                                    return (
                                                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                                            <td className="px-4 py-2 font-mono text-xs text-slate-500 align-top whitespace-nowrap">{id}</td>
                                                                            <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{text}</td>
                                                                        </tr>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <tr key={idx} className="bg-slate-50/50 dark:bg-slate-800/30">
                                                                            <td colSpan={2} className="px-4 py-2 text-slate-800 dark:text-slate-200 font-medium">
                                                                                {line}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <>
                                            {renderEvidenceTable('Performance Evidence', selectedUnit.performanceEvidence)}
                                            {renderEvidenceTable('Knowledge Evidence', selectedUnit.knowledgeEvidence)}
                                            {renderEvidenceTable('Assessment Conditions', selectedUnit.assessmentConditions)}
                                        </>
                                    );
                                })()}

                                {/* Dynamic Sections (Any other sections not explicitly handled) */}
                                {selectedUnit.dynamicSections?.map((section, idx) => {
                                    const standardSections = [
                                        'Modification History',
                                        'Application',
                                        'Unit Sector',
                                        'Elements and Performance Criteria',
                                        'Foundation Skills',
                                        'Knowledge Evidence',
                                        'Performance Evidence',
                                        'Assessment Conditions'
                                    ];

                                    // Skip if it's a standard section we already showed
                                    if (standardSections.some(s => section.title.toLowerCase().includes(s.toLowerCase()))) {
                                        return null;
                                    }

                                    return (
                                        <div key={idx}>
                                            <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">{section.title}</h5>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                                {section.content}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                    <Info className="w-8 h-8 text-slate-300" />
                                </div>
                                <p>Select a unit to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
