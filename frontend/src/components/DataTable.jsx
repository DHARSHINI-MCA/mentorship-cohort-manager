import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable table used for every list of people (mentors, trainees, nominees...).
 *
 * columns: [{ key, header, render?(row), className?, headerClassName? }]
 *
 * Pagination:
 *  - client side (default): pass `pageSize`; the table slices `rows` itself.
 *  - server side: pass `pagination={{ page, limit, total, onPageChange, onLimitChange }}`.
 *
 * Selection (optional): selectable + selectedIds + onSelectionChange + isRowSelectable.
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row.id,
  loading = false,
  emptyMessage = 'Nothing to show yet.',
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  isRowSelectable = () => true,
  pageSize = 10,
  pagination = null,
  onRowClick = null,
  rowClassName = null,
}) {
  const serverSide = !!pagination;
  const [clientPage, setClientPage] = useState(1);
  const [clientLimit, setClientLimit] = useState(pageSize);

  const limit = serverSide ? pagination.limit : clientLimit;
  const total = serverSide ? pagination.total : rows.length;
  const page = serverSide ? pagination.page : clientPage;
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (!serverSide && clientPage > pages) setClientPage(pages);
  }, [serverSide, clientPage, pages]);

  const visibleRows = serverSide ? rows : rows.slice((page - 1) * limit, page * limit);
  const selectableRows = visibleRows.filter(isRowSelectable);
  const allVisibleSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(rowKey(row)));

  const toggleAllVisible = () => {
    const visibleIds = selectableRows.map(rowKey);
    if (allVisibleSelected) {
      onSelectionChange(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...visibleIds])]);
    }
  };

  const toggleRow = (row) => {
    const id = rowKey(row);
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]
    );
  };

  const goToPage = (next) => {
    const clamped = Math.min(pages, Math.max(1, next));
    if (serverSide) pagination.onPageChange(clamped);
    else setClientPage(clamped);
  };

  const changeLimit = (next) => {
    if (serverSide) pagination.onLimitChange?.(next);
    else {
      setClientLimit(next);
      setClientPage(1);
    }
  };

  const colCount = columns.length + (selectable ? 1 : 0);
  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastItem = Math.min(total, page * limit);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allVisibleSelected}
                    disabled={selectableRows.length === 0}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${column.headerClassName || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-xs font-semibold text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const id = rowKey(row);
                const canSelect = selectable && isRowSelectable(row);
                const selected = selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`${selected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'} ${
                      onRowClick ? 'cursor-pointer' : ''
                    } transition-colors ${rowClassName ? rowClassName(row) : ''}`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selected}
                          disabled={!canSelect}
                          onChange={() => toggleRow(row)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 align-middle text-slate-700 ${column.className || ''}`}
                      >
                        {column.render ? column.render(row) : row[column.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span>
              {firstItem}–{lastItem} of {total}
            </span>
            <label className="flex items-center gap-1.5">
              <span>Rows</span>
              <select
                value={limit}
                onChange={(event) => changeLimit(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {[10, 25, 50, 100].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700">Page {page} of {pages}</span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pages}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Two-line cell: bold primary text with a muted secondary line (name + email). */
export function PersonCell({ primary, secondary }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-800">{primary}</div>
      {secondary && <div className="truncate text-xs text-slate-500">{secondary}</div>}
    </div>
  );
}
