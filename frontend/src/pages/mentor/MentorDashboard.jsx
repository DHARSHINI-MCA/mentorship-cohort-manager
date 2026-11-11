import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card, CardBody } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { EmptyState } from '../../components/EmptyState';
import { DataTable, PersonCell } from '../../components/DataTable';
import { Users, BookOpen, TrendingUp, ArrowRight, ExternalLink, Search } from 'lucide-react';

export function MentorDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['mentorDashboard'],
    queryFn: async () => {
      const res = await api.get('/mentor/dashboard');
      return res.data;
    },
  });

  const { data: cohortPlan } = useQuery({
    queryKey: ['mentorCohortPlan'],
    queryFn: async () => {
      try {
        const res = await api.get('/mentor/cohort-plan');
        return res.data;
      } catch (err) {
        return null;
      }
    },
  });

  return (
    <div className="space-y-8">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Mentor Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome, {dashboardData?.mentorName || user?.name}. Manage your mentees, track completion, and submit cohort evaluations.
          </p>
        </div>
        {cohortPlan && (
          <Link
            to="/mentor/plan"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all shrink-0"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>View Allocated Training Plan</span>
          </Link>
        )}
      </div>

      {/* 3 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1: Trainees under mentor */}
        <Card className="border-blue-100">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Trainees</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800">{dashboardData?.activeTrainees ?? dashboardData?.totalTrainees ?? 0}</span>
              <span className="text-xs font-semibold text-blue-600">{dashboardData?.droppedOutTrainees || 0} dropped out</span>
            </div>
          </CardBody>
        </Card>

        {/* Metric 2: Allocated Training Plan */}
        <Card className="border-emerald-100">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Allocated Training Plan</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-bold text-slate-800 line-clamp-1">
                {cohortPlan?.name || 'Curriculum Track'}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-emerald-600 font-semibold">
                <span>{cohortPlan?.totalWeeks || 4} Weeks Allocated</span>
                <Link to="/mentor/plan" className="hover:underline flex items-center gap-0.5 text-[11px]">
                  <span>Details</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Metric 3: Average Completion */}
        <Card className="border-purple-100">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cohort Track Progress</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-800">{dashboardData?.avgProgress || 0}%</span>
              <span className="text-xs font-semibold text-purple-600">Average Completion</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Assigned trainees table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Assigned Trainees ({dashboardData?.totalTrainees || 0})
            </h2>
            <span className="text-xs text-slate-500">
              Open a trainee to check courses and submit weekly feedback
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email or employee ID…"
                className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
            >
              <option value="ALL">All trainees</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="DROPPED">Dropped out</option>
            </select>
          </div>
        </div>

        {!isLoading && dashboardData?.trainees?.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No trainees currently assigned"
            description="You don't have any trainees assigned to your profile in active cohorts yet."
          />
        ) : (
          <DataTable
            loading={isLoading}
            rowKey={(t) => t.traineeId}
            rows={(dashboardData?.trainees || []).filter((t) => {
              const q = search.toLowerCase().trim();
              const matchesSearch = !q || [t.name, t.email, t.employeeId, t.cohortName]
                .some((value) => String(value || '').toLowerCase().includes(q));
              const dropped = t.status === 'dropped_out';
              const done = !dropped && t.percentComplete >= 100;
              const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'DROPPED' && dropped) ||
                (statusFilter === 'COMPLETED' && done) ||
                (statusFilter === 'IN_PROGRESS' && !dropped && !done);
              return matchesSearch && matchesStatus;
            })}
            emptyMessage="No trainees match your search."
            pageSize={10}
            columns={[
              { key: 'name', header: 'Trainee', render: (t) => <PersonCell primary={t.name} secondary={t.email} /> },
              { key: 'employeeId', header: 'Employee ID', render: (t) => <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{t.employeeId || '—'}</span> },
              { key: 'cohortName', header: 'Cohort' },
              {
                key: 'progress',
                header: 'Curriculum',
                className: 'min-w-[130px]',
                render: (t) => (
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><ProgressBar percent={t.percentComplete} size="sm" showLabel={false} /></div>
                    <span className="text-xs font-bold text-slate-700 w-9 text-right">{Math.round(t.percentComplete || 0)}%</span>
                  </div>
                ),
              },
              {
                key: 'feedback',
                header: 'Weekly feedback',
                render: (t) => (
                  <div>
                    <span className="text-xs font-bold text-purple-700">{t.feedbackCount || 0} / {t.totalWeeks || 4} weeks</span>
                    <p className="text-[11px] text-slate-400">
                      {t.lastFeedbackDate
                        ? `Latest: week ${t.lastFeedbackWeek}, ${new Date(t.lastFeedbackDate).toLocaleDateString()}`
                        : 'Week 1 pending'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (t) =>
                  t.status === 'dropped_out' ? (
                    <Badge variant="danger">Dropped Out</Badge>
                  ) : (
                    <Badge variant={t.percentComplete >= 100 ? 'active' : 'draft'}>
                      {t.percentComplete >= 100 ? 'Completed' : 'In Progress'}
                    </Badge>
                  ),
              },
              {
                key: 'open',
                header: '',
                render: (t) => (
                  <Link
                    to={`/mentor/trainees/${t.traineeId}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                  >
                    <span>{t.status === 'dropped_out' ? 'View Details' : 'Review Feedback'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
