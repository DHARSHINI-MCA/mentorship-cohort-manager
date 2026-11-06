import React from 'react';

export function ProgressBar({ percent = 0, size = 'md', showLabel = true, className = '' }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const getBarColor = (p) => {
    if (p >= 100) return 'bg-emerald-500';
    if (p >= 60) return 'bg-blue-500';
    if (p >= 30) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
          <span>Progress</span>
          <span className="text-slate-800 font-bold">{clamped}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heights[size] || heights.md}`}>
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${getBarColor(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
