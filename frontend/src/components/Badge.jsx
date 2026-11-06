import React from 'react';

export function Badge({ children, variant = 'default', size = 'md', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
    admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    mentor: 'bg-blue-50 text-blue-700 border-blue-200',
    nominator: 'bg-purple-50 text-purple-700 border-purple-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const appliedVariant = variants[variant] || variants.default;
  const appliedSize = sizes[size] || sizes.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border capitalize ${appliedVariant} ${appliedSize} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {children}
    </span>
  );
}
