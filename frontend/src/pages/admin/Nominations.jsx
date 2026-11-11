import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Copy, FolderPlus, KeyRound, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DataTable, PersonCell } from '../../components/DataTable';
import { NomineeForm } from '../../components/NomineeForm';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

/**
 * Admin view of everything nominators have submitted, plus the nominator accounts.
 * The admin adds nominees to cohorts here (or from inside a cohort).
 */
export function Nominations() {
  const [activeTab, setActiveTab] = useState('trainees'); // 'trainees' | 'mentors' | 'nominators'
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const kind = activeTab === 'mentors' ? 'mentor' : 'trainee';
  const isNomineeTab = activeTab !== 'nominators';

  // ---- nominee tables ----
  const [search, setSearch] = useState('');
  const [allocation, setAllocation] = useState('unallocated');
  const [nominatorFilter, setNominatorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [targetCohortId, setTargetCohortId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setSearch('');
    setPage(1);
    setSelectedIds([]);
  }, [activeTab]);
  useEffect(() => setPage(1), [debouncedSearch, allocation, nominatorFilter, limit]);

  const { data: nominees, isLoading: nomineesLoading } = useQuery({
    queryKey: ['adminNominees', kind, allocation, nominatorFilter, debouncedSearch, page, limit],
    queryFn: async () => {
      const res = await api.get(`/nominations/${kind}s`, {
        params: {
          allocation,
          nominator_id: nominatorFilter || undefined,
          search: debouncedSearch || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
    enabled: isNomineeTab,
    placeholderData: (previous) => previous,
  });

  const { data: nominators = [], isLoading: nominatorsLoading } = useQuery({
    queryKey: ['adminNominators'],
    queryFn: async () => (await api.get('/users/nominators')).data,
  });

  const { data: cohortsData } = useQuery({
    queryKey: ['cohorts', 'forAllocation'],
    queryFn: async () => (await api.get('/cohorts?limit=100')).data,
    enabled: isAllocateOpen,
  });
  const openCohorts = (cohortsData?.items || []).filter((cohort) => cohort.status !== 'closed');

  const allocateMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/cohorts/${targetCohortId}/${kind}s/allocate`, { ids: selectedIds })).data,
    onSuccess: (result) => {
      const cohortName = openCohorts.find((cohort) => cohort.id === targetCohortId)?.name || 'the cohort';
      queryClient.invalidateQueries({ queryKey: ['adminNominees'] });
      queryClient.invalidateQueries({ queryKey: ['nomineePool'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      queryClient.invalidateQueries({ queryKey: ['adminNominators'] });
      showToast(`${result.allocated} ${kind}${result.allocated === 1 ? '' : 's'} added to ${cohortName}`);
      if (result.skipped?.length) showToast(`${result.skipped.length} skipped (already in a cohort)`, 'warning');
      setSelectedIds([]);
      setIsAllocateOpen(false);
      setTargetCohortId('');
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to add to cohort', 'error'),
  });

  const addNomineeMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/nominations/${kind}s`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminNominees'] });
      showToast(`${kind === 'trainee' ? 'Trainee' : 'Mentor'} added to the nominations list`);
      setIsAddOpen(false);
    },
    onError: (err) => showToast(err.response?.data?.detail || `Failed to add ${kind}`, 'error'),
  });

  const nomineeColumns = [
    { key: 'name', header: kind === 'trainee' ? 'Trainee' : 'Mentor', render: (row) => <PersonCell primary={row.name} secondary={row.email} /> },
    { key: 'employeeId', header: 'Employee ID', render: (row) => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{row.employeeId || '—'}</span> },
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <div>
          <div>{row.location || '—'}</div>
          {row.timezone && <div className="text-xs text-slate-400">{row.timezone}</div>}
        </div>
      ),
    },
    { key: 'nominatorName', header: 'Nominated by' },
    { key: 'createdAt', header: 'Nominated on', render: (row) => formatDate(row.createdAt) },
    {
      key: 'allocationStatus',
      header: 'Cohort',
      render: (row) =>
        row.cohortId ? (
          <Badge variant="active">{row.cohortName || 'In a cohort'}</Badge>
        ) : (
          <Badge variant="draft">Not in a cohort</Badge>
        ),
    },
  ];

  // ---- nominator accounts ----
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [credentials, setCredentials] = useState(null); // { title, name, email, temporaryPassword }

  const createNominatorMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/users/nominators', payload)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminNominators'] });
      setIsCreateOpen(false);
      setCredentials({
        title: 'Nominator Created',
        name: result.nominator.name,
        email: result.nominator.email,
        temporaryPassword: result.temporaryPassword,
      });
      setNewName('');
      setNewEmployeeId('');
      setNewEmail('');
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to create nominator', 'error'),
  });

  const toggleAccountMutation = useMutation({
    mutationFn: async ({ userId, isActive }) =>
      (await api.put(`/admin/users/users/${userId}/${isActive ? 'activate' : 'deactivate'}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminNominators'] });
      showToast('Account updated');
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to update account', 'error'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (nominator) => {
      const res = await api.post(`/admin/users/users/${nominator.id}/reset-temp-password`);
      return { nominator, data: res.data };
    },
    onSuccess: ({ nominator, data }) => {
      queryClient.invalidateQueries({ queryKey: ['adminNominators'] });
      setCredentials({
        title: 'Temporary Password Reset',
        name: nominator.name,
        email: nominator.email,
        temporaryPassword: data.tempPassword,
      });
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to reset password', 'error'),
  });

  const nominatorColumns = [
    { key: 'name', header: 'Nominator', render: (row) => <PersonCell primary={row.name} secondary={row.email} /> },
    { key: 'employeeId', header: 'Employee ID', render: (row) => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{row.employeeId || '—'}</span> },
    { key: 'traineesNominated', header: 'Trainees nominated', render: (row) => <span className="font-semibold">{row.traineesNominated}</span> },
    { key: 'mentorsNominated', header: 'Mentors nominated', render: (row) => <span className="font-semibold">{row.mentorsNominated}</span> },
    {
      key: 'status',
      header: 'Account',
      render: (row) => (
        <Badge variant={!row.isActive || row.firstLoginPasswordReset ? 'draft' : 'active'}>
          {!row.isActive ? 'Inactive' : row.firstLoginPasswordReset ? 'Password setup pending' : 'Active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => resetPasswordMutation.mutate(row)}
            disabled={resetPasswordMutation.isPending}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" /> Reset password
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={row.isActive}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} nominator account`}
            onClick={() => toggleAccountMutation.mutate({ userId: row.id, isActive: !row.isActive })}
            disabled={toggleAccountMutation.isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${row.isActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${row.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      ),
    },
  ];

  const tabs = [
    { key: 'trainees', label: 'Nominated Trainees', icon: Users },
    { key: 'mentors', label: 'Nominated Mentors', icon: Award },
    { key: 'nominators', label: `Nominators (${nominators.length})`, icon: UserCheck },
  ];

  const personLabel = kind === 'trainee' ? 'Trainee' : 'Mentor';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nominations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everything nominators submit lands here. Add nominees to a cohort, then assign mentors to trainees inside the cohort.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {isNomineeTab && (
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, employee ID or location…"
                className="w-full pl-10 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={allocation}
              onChange={(event) => setAllocation(event.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
            >
              <option value="unallocated">Not in a cohort</option>
              <option value="allocated">Already in a cohort</option>
              <option value="all">All nominations</option>
            </select>
            <select
              value={nominatorFilter}
              onChange={(event) => setNominatorFilter(event.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
            >
              <option value="">All nominators</option>
              {nominators.map((nominator) => (
                <option key={nominator.id} value={nominator.id}>{nominator.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" /> Add {personLabel}
            </button>
            <button
              type="button"
              onClick={() => setIsAllocateOpen(true)}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <FolderPlus className="w-4 h-4" /> Add {selectedIds.length || ''} to cohort
            </button>
          </div>

          <DataTable
            columns={nomineeColumns}
            rows={nominees?.items || []}
            loading={nomineesLoading}
            emptyMessage={
              debouncedSearch || nominatorFilter || allocation !== 'all'
                ? `No ${kind}s match these filters.`
                : `No ${kind}s have been nominated yet.`
            }
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isRowSelectable={(row) => !row.cohortId}
            pagination={{ page, limit, total: nominees?.total || 0, onPageChange: setPage, onLimitChange: setLimit }}
          />
        </div>
      )}

      {activeTab === 'nominators' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Nominators only get a login. They are not tied to any cohort and cannot see cohort data.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <UserPlus className="h-4 w-4" /> Create Nominator
            </button>
          </div>
          <DataTable
            columns={nominatorColumns}
            rows={nominators}
            loading={nominatorsLoading}
            emptyMessage="No nominators yet. Create one so they can start nominating."
            pageSize={10}
          />
        </div>
      )}

      {/* Add nominee manually (admin) */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={`Add ${personLabel}`} maxWidth="max-w-lg">
        <NomineeForm
          key={kind}
          kind={kind}
          isPending={addNomineeMutation.isPending}
          onSubmit={(payload) => addNomineeMutation.mutateAsync(payload)}
        />
      </Modal>

      {/* Add selected nominees to a cohort */}
      <Modal isOpen={isAllocateOpen} onClose={() => setIsAllocateOpen(false)} title="Add to Cohort" maxWidth="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add <strong>{selectedIds.length}</strong> selected {kind}{selectedIds.length === 1 ? '' : 's'} to:
          </p>
          <select value={targetCohortId} onChange={(event) => setTargetCohortId(event.target.value)} className={inputClass}>
            <option value="">Select a cohort</option>
            {openCohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>{cohort.name} ({cohort.status})</option>
            ))}
          </select>
          {openCohorts.length === 0 && cohortsData && (
            <p className="text-xs text-amber-700">No open cohorts. Create a cohort first on the Cohorts page.</p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setIsAllocateOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button
              type="button"
              onClick={() => allocateMutation.mutate()}
              disabled={!targetCohortId || allocateMutation.isPending}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {allocateMutation.isPending ? 'Adding…' : 'Add to cohort'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create nominator */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Nominator" maxWidth="max-w-lg">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createNominatorMutation.mutate({ name: newName.trim(), employeeId: newEmployeeId.trim(), email: newEmail.trim() });
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Name *</label>
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Employee ID *</label>
            <input required value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)} placeholder="Employee ID" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Email *</label>
            <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" className={inputClass} />
          </div>
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            A temporary password is generated from the name and employee ID. The nominator must change it at first sign-in.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="submit" disabled={createNominatorMutation.isPending} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {createNominatorMutation.isPending ? 'Creating…' : 'Create Nominator'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Temporary password (shown once) */}
      <Modal isOpen={!!credentials} onClose={() => setCredentials(null)} title={credentials?.title || ''} maxWidth="max-w-lg">
        {credentials && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{credentials.name}</p>
              <p className="text-xs text-slate-500">{credentials.email}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-emerald-800">Temporary password — shown once</label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-800">{credentials.temporaryPassword}</code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(credentials.temporaryPassword);
                      showToast('Temporary password copied');
                    } catch {
                      showToast('Could not copy. Select and copy it manually.', 'warning');
                    }
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Share this password securely. It will not be shown again. At first sign-in the nominator enters it as the current password and sets a new one.
            </p>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setCredentials(null)} className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-900">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
