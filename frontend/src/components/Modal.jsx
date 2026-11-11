import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', fullScreen = false }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Container */}
      <div className={`flex min-h-full items-center justify-center ${fullScreen ? 'p-2 sm:p-3' : 'p-4'}`}>
        <div
          className={`relative flex w-full flex-col bg-white border border-slate-200/90 shadow-2xl overflow-hidden transform transition-all ${fullScreen ? 'h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] max-w-none rounded-xl' : `${maxWidth} rounded-2xl`}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Body */}
          <div className={fullScreen ? 'min-h-0 flex-1 overflow-y-auto p-5 sm:p-6' : 'max-h-[80vh] overflow-y-auto p-6'}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
