import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { BookOpen, Clock, Layers, Calendar, ArrowLeft } from 'lucide-react';

export function MentorPlan() {
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['mentorCohortPlan'],
    queryFn: async () => {
      const res = await api.get('/mentor/cohort-plan');
      return res.data;
    },
  });

  // Fetch TalentNext courses for the cohort
  const { data: talentnextCourses } = useQuery({
    queryKey: ['mentorTalentNextCourses', plan?.cohortId],
    queryFn: async () => {
      if (!plan?.cohortId) return [];
      const res = await api.get(`/cohorts/${plan.cohortId}`);
      return res.data?.talentnextCourses || [];
    },
    enabled: !!plan?.cohortId,
  });

  // Fetch course details
  const { data: courseDetails } = useQuery({
    queryKey: ['talentnextCourseDetails', talentnextCourses],
    queryFn: async () => {
      if (!talentnextCourses || talentnextCourses.length === 0) return [];
      const courseIds = talentnextCourses.map(c => c.courseId);
      try {
        const res = await api.get('/talentnext-courses');
        const allCourses = res.data || [];
        return allCourses.filter(c => courseIds.includes(c.id));
      } catch {
        return [];
      }
    },
    enabled: !!talentnextCourses && talentnextCourses.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-slate-200 rounded w-48 animate-pulse" />
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No training plan allocated"
        description="Your cohort has not been configured with a training plan yet. Please check back once the cohort administrator has applied the curriculum."
        action={
          <Link to="/mentor/dashboard" className="text-xs font-bold text-emerald-600">
            &larr; Back to My Trainees
          </Link>
        }
      />
    );
  }

  const totalWeeks = plan.totalWeeks || plan.weeks?.length || 4;
  const coreWeeks = plan.coreWeeks ?? plan.weeks?.filter((w) => !w.isBuffer && w.courses?.length > 0).length ?? totalWeeks;
  const bufferWeeks = plan.bufferWeeks ?? plan.weeks?.filter((w) => w.isBuffer || !w.courses || w.courses?.length === 0).length ?? 0;

  const totalCourses = plan.weeks?.reduce((acc, w) => acc + (w.courses?.length || 0), 0) || 0;
  const totalHours = plan.weeks?.reduce(
    (acc, w) => acc + (w.courses?.reduce((cAcc, c) => cAcc + (c.durationHrs || 0), 0) || 0),
    0
  ) || 0;

  return (
    <div className="space-y-8">
      {/* Top Banner Card */}
      <div>
        <Link
          to="/mentor/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Trainees</span>
        </Link>

        <Card className="border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50/20">
          <CardBody className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Allocated Training Plan
                  </h1>
                  <Badge variant={plan.cohortStatus || 'active'}>
                    {plan.cohortStatus || 'Active'}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{plan.name}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{plan.cohortDates || 'Cohort Track'}</span>
                  </div>
                  <div>&bull;</div>
                  <div>{plan.cohortName || 'Engineering Cohort'}</div>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Track</span>
                  <span className="text-base font-black text-slate-800">{totalWeeks} Weeks</span>
                  {bufferWeeks > 0 && (
                    <span className="text-[10px] text-amber-700 font-bold block">
                      {coreWeeks} Core + {bufferWeeks} Buffer
                    </span>
                  )}
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Modules</span>
                  <span className="text-base font-black text-slate-800">{totalCourses} Courses</span>
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Workload</span>
                  <span className="text-base font-black text-emerald-600">{totalHours}h Total</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Week-by-Week Curriculum Cards */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Curriculum Breakdown</h2>
          <p className="text-xs text-slate-500">
            This is the official cohort training curriculum allocated to you and your mentees ({coreWeeks} Core Curriculum Weeks {bufferWeeks > 0 && `+ ${bufferWeeks} Buffer Weeks`})
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plan.weeks?.map((week) => {
            const hasCourses = week.courses && week.courses.length > 0;
            const isBufferOnly = (week.isBuffer || !hasCourses) && !hasCourses;

            if (isBufferOnly) {
              return (
                <Card key={week.weekNumber} className="flex flex-col justify-between border-amber-200 bg-amber-50/20 shadow-soft">
                  <CardHeader className="py-4 bg-amber-50/60 border-b border-amber-100">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                          W{week.weekNumber}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-amber-950">{week.title || `Week ${week.weekNumber} (Buffer Week)`}</h3>
                          <span className="text-[11px] text-amber-700 font-semibold">Catch-up & Project Extension Period</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-200">
                        Buffer Week
                      </span>
                    </div>
                  </CardHeader>

                  <CardBody className="p-5">
                    <div className="p-4 rounded-xl bg-white border border-amber-200/80 text-center space-y-1.5 shadow-2xs">
                      <p className="text-xs font-bold text-slate-800">Buffer & Project Completion Period</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
                        No additional course modules scheduled for this week. This buffer period is dedicated for trainees to complete pending assignments, project deliverables, and participate in mentor evaluations.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              );
            }

            return (
              <Card key={week.weekNumber} className="flex flex-col justify-between border-slate-200/90 shadow-soft">
                <CardHeader className="py-4 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                      W{week.weekNumber}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{week.title}</h3>
                      <span className="text-[11px] text-slate-500">{week.courses?.length || 0} modules in this week</span>
                    </div>
                  </div>
                </CardHeader>

                <CardBody className="p-5 space-y-3">
                  {week.courses?.map((course, idx) => (
                    <div
                      key={course.courseId || idx}
                      className="p-3.5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-800">
                          {idx + 1}. {course.title}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                          {course.durationHrs}h
                        </span>
                      </div>
                      {course.description && (
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {course.description}
                        </p>
                      )}
                    </div>
                  ))}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {/* TalentNext Courses Section */}
      {talentnextCourses && talentnextCourses.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">TalentNext Learning Paths</h2>
            <p className="text-xs text-slate-500">
              Additional specialized courses and learning tracks ({talentnextCourses.filter(c => c.isMandatory).length} Mandatory, {talentnextCourses.filter(c => !c.isMandatory).length} Optional)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mandatory Courses */}
            {talentnextCourses.filter(c => c.isMandatory).length > 0 && (
              <Card className="border-rose-200 bg-rose-50/20 shadow-soft">
                <CardHeader className="py-4 bg-rose-50/60 border-b border-rose-100">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-rose-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                      M
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-rose-950">Mandatory Courses</h3>
                      <span className="text-[11px] text-rose-700 font-semibold">{talentnextCourses.filter(c => c.isMandatory).length} courses</span>
                    </div>
                  </div>
                </CardHeader>

                <CardBody className="p-5 space-y-2">
                  {talentnextCourses.filter(c => c.isMandatory).map((assignment, idx) => {
                    const course = courseDetails?.find(c => c.id === assignment.courseId);
                    return (
                      <div
                        key={assignment.courseId}
                        className="p-3 rounded-lg bg-white border border-rose-200/80 hover:border-rose-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-rose-900">
                                {idx + 1}. {course?.name || 'Loading...'}
                              </span>
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                Required
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            )}

            {/* Optional Courses */}
            {talentnextCourses.filter(c => !c.isMandatory).length > 0 && (
              <Card className="border-blue-200 bg-blue-50/20 shadow-soft">
                <CardHeader className="py-4 bg-blue-50/60 border-b border-blue-100">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-blue-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                      O
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-blue-950">Optional Courses</h3>
                      <span className="text-[11px] text-blue-700 font-semibold">{talentnextCourses.filter(c => !c.isMandatory).length} courses</span>
                    </div>
                  </div>
                </CardHeader>

                <CardBody className="p-5 space-y-2">
                  {talentnextCourses.filter(c => !c.isMandatory).map((assignment, idx) => {
                    const course = courseDetails?.find(c => c.id === assignment.courseId);
                    return (
                      <div
                        key={assignment.courseId}
                        className="p-3 rounded-lg bg-white border border-blue-200/80 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-blue-900">
                                {idx + 1}. {course?.name || 'Loading...'}
                              </span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                                Optional
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
