import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/EmptyState';
import { Users } from 'lucide-react';

const dateLabel = (value) => value ? new Date(value).toLocaleDateString() : '—';

export function MentorDashboard() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['mentorDashboard'],
    queryFn: async () => (await api.get('/mentor/dashboard')).data,
  });
  const { data: cohortPlan } = useQuery({
    queryKey: ['mentorCohortPlan'],
    queryFn: async () => {
      try { return (await api.get('/mentor/cohort-plan')).data; }
      catch { return null; }
    },
  });

  const trainees = dashboardData?.trainees || [];
  const activeCount = dashboardData?.activeTrainees ?? dashboardData?.totalTrainees ?? 0;
  const droppedCount = dashboardData?.droppedOutTrainees || 0;
  const averageProgress = dashboardData?.avgProgress || 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">

      {/* ── Slim page header ── */}
      <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mentor workspace</span>
          <h1 className="text-sm font-bold text-slate-900 mt-0.5">{dashboardData?.mentorName || user?.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick nav links */}
          <Link to="/mentor/batches" className="text-xs font-semibold text-emerald-700 hover:underline">Batches</Link>
          <Link to="/mentor/sessions" className="text-xs font-semibold text-emerald-700 hover:underline">Sessions</Link>
          {cohortPlan && (
            <Link to="/mentor/plan" className="text-xs font-semibold text-slate-500 hover:text-slate-900">
              {cohortPlan.name} <span className="font-normal text-slate-400">· {cohortPlan.totalWeeks || 4}w</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex gap-6 text-sm py-2.5 border-b border-slate-100 flex-wrap">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Active trainees</span>
          <span className="font-bold text-slate-900">{activeCount}</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Dropped out</span>
          <span className="font-bold text-rose-700">{droppedCount}</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Avg progress</span>
          <span className="font-bold text-slate-900">{averageProgress}%</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Feedback submitted</span>
          <span className="font-bold text-slate-900">{trainees.reduce((sum, trainee) => sum + (trainee.feedbackCount || 0), 0)}</span>
        </div>
        <div className="ml-auto text-[11px] text-slate-400">{trainees.length} total trainees</div>
      </div>

      {/* ── Trainees table ── */}
      <section>
        <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Trainees</span>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100 border-b border-slate-200">
            {[1, 2, 3].map((row) => <div key={row} className="h-10 animate-pulse bg-slate-50" />)}
          </div>
        ) : trainees.length === 0 ? (
          <EmptyState icon={Users} title="No trainees currently assigned" description="Trainees assigned to you will appear here." />
        ) : (
          <div className="overflow-x-auto border-b border-slate-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Trainee</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Progress</th>
                  <th className="px-4 py-2">Feedback</th>
                  <th className="px-4 py-2">Last review</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainees.map((trainee) => {
                  const dropped = trainee.status === 'dropped_out';
                  const percent = Math.max(0, Math.min(100, Number(trainee.percentComplete) || 0));
                  return (
                    <tr key={trainee.traineeId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2">
                        <Link to={`/mentor/trainees/${trainee.traineeId}`} className="font-semibold text-slate-900 hover:text-emerald-700">{trainee.name}</Link>
                        <p className="mt-0.5 text-[11px] text-slate-400">{trainee.employeeId || '—'} · {trainee.email}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        <span>{trainee.location || 'Not provided'}</span>
                        <p className="mt-0.5 text-[11px] text-slate-400">{trainee.timezone || trainee.cohortName || '—'}</p>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 bg-slate-200 rounded">
                            <div className="h-full bg-emerald-500 rounded" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-700 text-xs">{percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-600 text-xs">{trainee.feedbackCount || 0} / {trainee.totalWeeks || 4}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">
                        {trainee.lastFeedbackDate ? `Week ${trainee.lastFeedbackWeek || '—'} · ${dateLabel(trainee.lastFeedbackDate)}` : <span className="text-amber-700">Pending</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          dropped ? 'bg-rose-50 text-rose-700' :
                          percent >= 100 ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {dropped ? 'Dropped' : percent >= 100 ? 'Done' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link to={`/mentor/trainees/${trainee.traineeId}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                          {dropped ? 'Record' : 'Review'} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
