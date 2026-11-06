import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { Users, BookOpen, TrendingUp, ArrowRight, MessageSquare, ExternalLink, ClipboardList, CheckCircle2 } from 'lucide-react';

export function MentorDashboard() {
  const { user } = useAuth();

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

      {/* Trainees Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            Assigned Trainees ({dashboardData?.totalTrainees || 0})
          </h2>
          <span className="text-xs text-slate-500">
            Click on any trainee to check courses and submit weekly feedback
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard count={3} />
          </div>
        ) : dashboardData?.trainees?.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No trainees currently assigned"
            description="You don't have any trainees assigned to your profile in active cohorts yet."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData?.trainees?.map((t) => (
              <Card key={t.traineeId} hover className="flex flex-col justify-between">
                <CardBody className="p-6">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-bold text-slate-800 text-base">{t.name}</h3>{t.status === 'dropped_out' && <Badge variant="danger">Dropped Out</Badge>}</div>
                      <p className="text-xs text-slate-500">{t.email}</p>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {t.employeeId}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 font-medium mb-4 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">{t.department}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-500">{t.cohortName}</span>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600">Curriculum</span>
                        <span className="font-bold text-slate-800">{t.percentComplete}%</span>
                      </div>
                      <ProgressBar percent={t.percentComplete} size="sm" showLabel={false} />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100">
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                        <span>Weekly Feedback</span>
                      </span>
                      <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full text-[11px] border border-purple-100">
                        {t.feedbackCount || 0} / {t.totalWeeks || 4} Weeks Done
                      </span>
                    </div>

                    {t.lastFeedbackDate ? (
                      <p className="text-[11px] text-slate-400">
                        Latest: Week {t.lastFeedbackWeek} on {new Date(t.lastFeedbackDate).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                        <span>●</span> Week 1 evaluation pending
                      </p>
                    )}
                  </div>
                </CardBody>

                <CardFooter className="bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-500">
                    {t.status === 'dropped_out' ? 'Dropped Out' : t.percentComplete >= 100 ? 'Completed Track' : 'In Progress'}
                  </span>
                  <Link
                    to={`/mentor/trainees/${t.traineeId}`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                  >
                    <span>{t.status === 'dropped_out' ? 'View Details' : 'Review Feedback'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
