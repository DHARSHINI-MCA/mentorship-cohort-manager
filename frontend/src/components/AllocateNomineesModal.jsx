import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal } from './Modal';
import { DataTable, PersonCell } from './DataTable';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

/**
 * Admin picks mentors/trainees from the nomination pool (people nominated but
 * not yet in any cohort) and adds them to this cohort.
 */
export function AllocateNomineesModal({ isOpen, onClose, kind, cohortId, cohortName }) {
  const label = kind === 'mentor' ? 'Mentors' : 'Trainees';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setPage(1);
      setSelectedIds([]);
    }
  }, [isOpen, kind]);

  useEffect(() => setPage(1), [debouncedSearch, limit]);

  const { data, isLoading } = useQuery({
    queryKey: ['nomineePool', kind, 'unallocated', debouncedSearch, page, limit],
    queryFn: async () => {
      const res = await api.get(`/nominations/${kind}s`, {
        params: { allocation: 'unallocated', search: debouncedSearch || undefined, page, limit },
      });
      return res.data;
    },
    enabled: isOpen,
    placeholderData: (previous) => previous,
  });

  const allocateMutation = useMutation({
    mutationFn: async () => (await api.post(`/cohorts/${cohortId}/${kind}s/allocate`, { ids: selectedIds })).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortMentors', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortTrainees', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['nomineePool'] });
      queryClient.invalidateQueries({ queryKey: ['adminNominees'] });
      showToast(`${result.allocated} ${kind}${result.allocated === 1 ? '' : 's'} added to ${cohortName}`);
      if (result.skipped?.length) {
        showToast(`${result.skipped.length} skipped (already in a cohort)`, 'warning');
      }
      onClose();
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to add to cohort', 'error'),
  });

  const columns = [
    { key: 'name', header: label.slice(0, -1), render: (row) => <PersonCell primary={row.name} secondary={row.email} /> },
    { key: 'employeeId', header: 'Employee ID', render: (row) => <span className="font-mono text-xs">{row.employeeId || '—'}</span> },
    { key: 'location', header: 'Location', render: (row) => row.location || '—' },
    { key: 'timezone', header: 'Time zone', render: (row) => <span className="text-xs text-slate-500">{row.timezone || '—'}</span> },
    { key: 'nominatorName', header: 'Nominated by' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add ${label} to ${cohortName}`} maxWidth="max-w-5xl">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          These people were nominated but are not in any cohort yet. Select the ones to add to this cohort.
        </p>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, employee ID or location…"
            className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={isLoading}
          emptyMessage={`No unallocated ${kind}s. Ask nominators to nominate more, or add one on the Nominations page.`}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          pagination={{
            page,
            limit,
            total: data?.total || 0,
            onPageChange: setPage,
            onLimitChange: setLimit,
          }}
        />

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold text-slate-500">{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => allocateMutation.mutate()}
              disabled={selectedIds.length === 0 || allocateMutation.isPending}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {allocateMutation.isPending ? 'Adding…' : `Add ${selectedIds.length || ''} to cohort`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
