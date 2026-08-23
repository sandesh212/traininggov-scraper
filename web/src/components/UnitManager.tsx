
import React, { useCallback, useEffect, useState } from 'react';
import { Unit } from '../types';
import { Trash2, RotateCcw, Plus, Search, Info, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface UnitSummary {
    code: string;
    title: string;
    elementCount: number;
}

export function UnitManager({ onClose }: { onClose?: () => void }) {
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newUnitCode, setNewUnitCode] = useState('');
    const [adding, setAdding] = useState(false);
    const [addResult, setAddResult] = useState<{ success: boolean; message: string; added?: string[]; failed?: { code: string; reason: string }[] } | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [processingUnit, setProcessingUnit] = useState<string | null>(null);

    const [refreshingAll, setRefreshingAll] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmRefreshAll, setConfirmRefreshAll] = useState(false);

    const fetchUnits = useCallback(async (query: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (query) params.set('search', query);

            const response = await fetch(`/api/units?${params.toString()}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.units) {
                throw new Error(data.error || 'Failed to load units');
            }

            setUnits(data.units);
            setLastUpdated(data.lastUpdated);
        } catch {
            setAddResult({ success: false, message: 'Failed to load units' });
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce user search while loading immediately on the first render.
    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchUnits(searchTerm);
        }, searchTerm ? 500 : 0);
        return () => clearTimeout(timer);
    }, [fetchUnits, searchTerm]);

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
                    void fetchUnits(searchTerm); // Refresh list
                }
            } else {
                setAddResult({ success: false, message: data.error || 'Failed to add unit' });
            }
        } catch {
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
                void fetchUnits(searchTerm);
            } else {
                setAddResult({ success: false, message: 'Failed to delete unit' });
            }
        } catch {
            setAddResult({ success: false, message: 'Failed to delete unit' });
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
                void fetchUnits(searchTerm); // Update timestamp/list
            } else {
                setAddResult({ success: false, message: 'Failed to update unit' });
            }
        } catch {
            setAddResult({ success: false, message: 'Failed to update unit' });
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
                void fetchUnits(searchTerm);
            } else {
                setAddResult({ success: false, message: 'Failed to refresh units' });
            }
        } catch {
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
            void fetchUnits(searchTerm);
            setSelectedUnit(null);
            setAddResult({ success: true, message: 'All units cleared' });
        } catch {
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
                void fetchUnits(searchTerm);
                setAddResult({ success: true, message: 'Units restored' });
            } else {
                setAddResult({ success: false, message: 'Nothing to undo' });
            }
        } catch {
            setAddResult({ success: false, message: 'Failed to restore' });
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (code: string) => {
        // Don't clear if clicking same unit
        if (selectedUnit?.code === code) return;

        setSelectedUnit(null);
        try {
            const res = await fetch(`/api/units/${code}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedUnit(data);
            }
        } catch {
            setAddResult({ success: false, message: 'Failed to load unit details' });
        }
    };

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
                                <span>{units.length} Units Stored</span>
                                {lastUpdated && <span>Updated: {new Date(lastUpdated).toLocaleString()}</span>}
                            </div>

                            {/* Add Unit Form */}
                            <form onSubmit={handleAddUnit} className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Codes (e.g. MARN008, MARN009)"
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

                                <div className="space-y-4">
                                    <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800">Elements & Performance Criteria</h5>
                                    {selectedUnit.elements.map((el, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
                                            <div className="font-medium text-slate-800 dark:text-slate-200 mb-2">{el.title}</div>
                                            <ul className="space-y-1">
                                                {el.performanceCriteria.map((pc, pcIdx) => (
                                                    <li key={pcIdx} className="text-sm text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                                                        <span className="font-mono text-xs text-slate-400 mr-2">{pc.id}</span>
                                                        {pc.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>

                                {selectedUnit.foundationSkills && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Foundation Skills</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs">
                                            {selectedUnit.foundationSkills}
                                        </div>
                                    </div>
                                )}

                                {selectedUnit.knowledgeEvidence && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Knowledge Evidence</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            {selectedUnit.knowledgeEvidence}
                                        </div>
                                    </div>
                                )}

                                {selectedUnit.assessmentConditions && (
                                    <div>
                                        <h5 className="font-semibold text-slate-900 dark:text-white border-b pb-2 border-slate-200 dark:border-slate-800 mb-3">Assessment Conditions</h5>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                            {selectedUnit.assessmentConditions}
                                        </div>
                                    </div>
                                )}
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
