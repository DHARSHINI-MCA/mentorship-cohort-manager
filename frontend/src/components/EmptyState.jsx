import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = "No items found",
  description = "Get started by creating your first record.",
  action = null,
  className = ""
}) {
  return (
    <div className={`col-span-full bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center shadow-soft flex flex-col items-center justify-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-bold text-slate-800 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}
