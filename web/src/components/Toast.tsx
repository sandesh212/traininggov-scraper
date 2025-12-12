'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastProps {
    message: string;
    type: ToastType;
    isVisible: boolean;
    onClose: () => void;
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
    useEffect(() => {
        if (isVisible && type !== 'loading') { // Don't auto-dismiss loading state
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, type, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    className={`
                        fixed bottom-6 left-6 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border
                        ${type === 'success' ? 'bg-white border-green-200 text-green-800' : ''}
                        ${type === 'error' ? 'bg-white border-red-200 text-red-800' : ''}
                        ${type === 'info' ? 'bg-white border-blue-200 text-blue-800' : ''}
                        ${type === 'loading' ? 'bg-white border-blue-200 text-blue-800' : ''}
                    `}
                >
                    <div className={`
                        p-2 rounded-full
                        ${type === 'success' ? 'bg-green-100 text-green-600' : ''}
                        ${type === 'error' ? 'bg-red-100 text-red-600' : ''}
                        ${type === 'info' ? 'bg-blue-100 text-blue-600' : ''}
                        ${type === 'loading' ? 'bg-blue-50 text-blue-600' : ''}
                    `}>
                        {type === 'success' && <CheckCircle size={20} />}
                        {type === 'error' && <AlertCircle size={20} />}
                        {type === 'info' && <AlertCircle size={20} />}
                        {type === 'loading' && (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        )}
                    </div>

                    <div className="flex-1 mr-4">
                        <p className="font-semibold text-sm capitalize">
                            {type === 'loading' ? 'Processing...' : type}
                        </p>
                        <p className="text-sm opacity-90">{message}</p>
                    </div>

                    {type !== 'loading' && (
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
