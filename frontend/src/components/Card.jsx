import React from 'react';

export function Card({ children, className = '', hover = false, onClick, ...props }) {
  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(event);
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...props}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden transition-all duration-200 ${
        hover ? 'hover:shadow-soft-hover hover:border-slate-300 cursor-pointer transform hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-6 border-b border-slate-100 flex items-center justify-between gap-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', subtitle = null }) {
  return (
    <div>
      <h3 className={`font-bold text-slate-800 text-lg leading-tight ${className}`}>
        {children}
      </h3>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}
