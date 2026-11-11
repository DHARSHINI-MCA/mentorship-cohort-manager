import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Search, Users } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/Card';
import { DataTable, PersonCell } from '../../components/DataTable';
import { NomineeForm } from '../../components/NomineeForm';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

/**
 * Nominator workspace. Nominators are independent of cohorts: they only nominate
 * trainees and mentors and see the people they nominated. An admin decides which
 * cohort each nominee joins.
 */
export default function NominatorDashboard() {
  const [activeTab, setActiveTab] = useState('trainees'); // 'trainees' | 'mentors'
  const kind = activeTab === 'trainees' ? 'trainee' : 'mentor';
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setSearch('');
    setPage(1);
  }, [activeTab]);
  useEffect(() => setPage(1), [debouncedSearch, limit]);

  const { data: dashboard } = useQuery({
    queryKey: ['nominatorDashboard'],
    queryFn: async () => (await api.get('/nominator/dashboard')).data,
  });

  const { data: nominees, isLoading } = useQuery({
    queryKey: ['myNominees', kind, debouncedSearch, page, limit],
    queryFn: async () => {
      const res = await api.get(`/nominations/mine/${kind}s`, {
        params: { search: debouncedSearch || undefined, page, limit },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });

  const nominateMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/nominations/${kind}s`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myNominees'] });
      queryClient.invalidateQueries({ queryKey: ['nominatorDashboard'] });
      showToast(`${kind === 'trainee' ? 'Trainee' : 'Mentor'} nominated successfully`);
    },
    onError: (err) => showToast(err.response?.data?.detail || `Failed to nominate ${kind}`, 'error'),
  });

  const columns = [
    { key: 'name', header: kind === 'trainee' ? 'Trainee' : 'Mentor', render: (row) => <PersonCell primary={row.name} secondary={row.email} /> },
    { key: 'employeeId', header: 'Employee ID', render: (row) => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{row.employeeId || '—'}</span> },
    { key: 'location', header: 'Location', render: (row) => row.location || '—' },
    { key: 'timezone', header: 'Time zone', render: (row) => <span className="text-xs text-slate-500">{row.timezone || '—'}</span> },
    { key: 'createdAt', header: 'Nominated on', render: (row) => formatDate(row.createdAt) },
  ];

  const tabs = [
    { key: 'trainees', label: `Nominate Trainees (${dashboard?.totalTraineesNominated ?? 0})`, icon: Users },
    { key: 'mentors', label: `Nominate Mentors (${dashboard?.totalMentorsNominated ?? 0})`, icon: Award },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nominations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Nominate trainees and mentors. Your administrator reviews every nomination and decides where each person joins.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 border-emerald-100">
          <CardHeader>
            <CardTitle subtitle="Nominations are reviewed by your administrator">
              Nominate {kind === 'trainee' ? 'Trainee' : 'Mentor'}
            </CardTitle>
          </CardHeader>
          <CardBody className="p-6">
            <NomineeForm
              key={kind}
              kind={kind}
              isPending={nominateMutation.isPending}
              onSubmit={(payload) => nominateMutation.mutateAsync(payload)}
            />
          </CardBody>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Your Nominated {kind === 'trainee' ? 'Trainees' : 'Mentors'}
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, ID, location…"
                className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={nominees?.items || []}
            loading={isLoading}
            emptyMessage={
              debouncedSearch
                ? 'No nominations match your search.'
                : `You have not nominated any ${kind}s yet. Use the form to add one.`
            }
            pagination={{
              page,
              limit,
              total: nominees?.total || 0,
              onPageChange: setPage,
              onLimitChange: setLimit,
            }}
          />
        </div>
      </div>
    </div>
  );
}
