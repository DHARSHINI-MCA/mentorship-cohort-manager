import React from 'react';

export function SkeletonCard({ count = 3, className = '' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-soft animate-pulse ${className}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="h-5 bg-slate-200 rounded-lg w-1/3"></div>
            <div className="h-5 bg-slate-200 rounded-full w-16"></div>
          </div>
          <div className="space-y-2.5 mb-6">
            <div className="h-3.5 bg-slate-100 rounded w-full"></div>
            <div className="h-3.5 bg-slate-100 rounded w-4/5"></div>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-8 bg-slate-200 rounded-lg w-20"></div>
          </div>
        </div>
      ))}
    </>
  );
}
