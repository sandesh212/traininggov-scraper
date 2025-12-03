import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check, ArrowRight } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    items?: (string | { code: string; url: string })[];
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'info' | 'danger';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    items = [],
    onConfirm,
    onCancel,
    confirmText = 'Continue',
    cancelText = 'Cancel',
    type = 'warning'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                            <p className="text-gray-600 mb-4 leading-relaxed">
                                {message}
                            </p>

                            {items.length > 0 && (
                                <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200 max-h-64 overflow-y-auto">
                                    <ul className="space-y-2">
                                        {items.map((item, idx) => (
                                            <li key={idx} className="text-sm font-mono text-gray-700 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                                {typeof item === 'string' ? (
                                                    item
                                                ) : (
                                                    <span className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold">{item.code}</span>
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 underline text-xs flex items-center gap-1"
                                                        >
                                                            {item.url}
                                                            <ArrowRight size={10} className="-rotate-45" />
                                                        </a>
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center gap-3 mt-6 justify-end">
                                <button
                                    onClick={onCancel}
                                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <X size={18} />
                                    {cancelText}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className={`px-5 py-2 text-white font-bold rounded-lg shadow-md transition-all transform hover:-translate-y-0.5 flex items-center gap-2
                                        ${type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}
                                    `}
                                >
                                    {confirmText}
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
