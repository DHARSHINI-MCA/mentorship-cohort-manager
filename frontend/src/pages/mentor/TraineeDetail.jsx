import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { 
  ArrowLeft, CheckCircle2, Circle, Clock, MessageSquare, 
  Send, Calendar, Star, FileText, Check, ChevronRight, ChevronLeft, CheckCheck,
  ClipboardList, AlertCircle, Sparkles, Award, ArrowRight, UserX
} from 'lucide-react';

const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding'
};

export function TraineeDetail() {
  const { id: traineeId } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { role } = useAuth();

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [answers, setAnswers] = useState({});
  const [expandedWeeks, setExpandedWeeks] = useState({}); // Track which weeks are expanded in history
  const [expandedTalentNext, setExpandedTalentNext] = useState(false); // Track if TalentNext section is expanded

  // 1. Fetch Trainee Details (includes trainee, cohort, plan, progress, feedbackForm, feedbackHistory)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['traineeDetail', traineeId],
    queryFn: async () => {
      const res = await api.get(`/mentor/trainees/${traineeId}`);
      return res.data;
    },
  });

  const trainee = data?.trainee;
  const plan = data?.plan;
  const progress = data?.progress;
  const feedbackForm = data?.feedbackForm;
  const feedbackHistory = data?.feedbackHistory || [];
  const talentnextCourses = data?.talentnextCourses || [];
  const talentnextProgress = data?.talentnextProgress || {};

  // Calculate weeks list from plan (or default 4 weeks)
  const totalWeeksCount = plan?.totalWeeks || plan?.weeks?.length || 4;
  const weeksList = Array.from({ length: totalWeeksCount }, (_, i) => i + 1);

  // Check which weeks have feedback submitted
  const submittedWeeksMap = {};
  feedbackHistory.forEach((fb) => {
    submittedWeeksMap[fb.weekNumber] = fb;
  });

  const existingFeedbackForSelectedWeek = submittedWeeksMap[selectedWeek];
  const feedbackPercent = totalWeeksCount > 0 
    ? Math.round((feedbackHistory.length / totalWeeksCount) * 100) 
    : 0;

  // Whenever selectedWeek changes or feedbackHistory loads, populate answers if already submitted
  useEffect(() => {
    const existing = feedbackHistory.find((fb) => fb.weekNumber === parseInt(selectedWeek, 10));
    if (existing && existing.answers) {
      setAnswers(existing.answers);
    } else {
      setAnswers({});
    }
  }, [selectedWeek, feedbackHistory]);

  // Mutations
  const updateProgressMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.patch(`/mentor/trainees/${traineeId}/progress`, payload);
    },
    onSuccess: (updatedProg) => {
      queryClient.invalidateQueries({ queryKey: ['traineeDetail', traineeId] });
      queryClient.invalidateQueries({ queryKey: ['mentorDashboard'] });
      showToast(`Progress updated: ${updatedProg.data?.percentComplete || updatedProg.percentComplete}% complete`);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update progress', 'error');
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ week, answersPayload, advanceToNext = false }) => {
      const res = await api.post(`/mentor/trainees/${traineeId}/feedback`, {
        weekNumber: parseInt(week, 10),
        answers: answersPayload,
      });
      return { data: res.data, advanceToNext, week };
    },
    onSuccess: ({ advanceToNext, week }) => {
      queryClient.invalidateQueries({ queryKey: ['traineeDetail', traineeId] });
      queryClient.invalidateQueries({ queryKey: ['mentorDashboard'] });
      showToast(`Weekly feedback for Week ${week} saved successfully!`);
      if (advanceToNext && week < totalWeeksCount) {
        setSelectedWeek(week + 1);
      }
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to submit feedback', 'error');
    },
  });

  const updateTalentNextMutation = useMutation({
    mutationFn: async ({ courseId, completed }) => {
      const res = await api.patch(`/mentor/trainees/${traineeId}/talentnext/${courseId}`, {
        completed,
      });
      return res.data;
    },
    onSuccess: (data, { courseId, completed }) => {
      queryClient.invalidateQueries({ queryKey: ['traineeDetail', traineeId] });
      queryClient.invalidateQueries({ queryKey: ['mentorDashboard'] });
      const courseName = talentnextCourses.find(c => c.id === courseId)?.name || 'Course';
      showToast(`${courseName} marked as ${completed ? 'completed' : 'incomplete'}`);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update course status', 'error');
    },
  });

  const dropoutMutation = useMutation({
    mutationFn: async () => api.patch(`/mentor/trainees/${traineeId}/dropout`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['traineeDetail', traineeId] }),
        queryClient.invalidateQueries({ queryKey: ['mentorDashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['mentorAssignedTraineesForBatches'] }),
        queryClient.invalidateQueries({ queryKey: ['mentorBatches'] }),
        queryClient.invalidateQueries({ queryKey: ['batchSessions'] }),
        queryClient.invalidateQueries({ queryKey: ['cohorts'] }),
        queryClient.invalidateQueries({ queryKey: ['cohort', trainee?.cohortId] }),
        queryClient.invalidateQueries({ queryKey: ['cohortTrainees', trainee?.cohortId] }),
        queryClient.invalidateQueries({ queryKey: ['cohortMentors', trainee?.cohortId] }),
        queryClient.invalidateQueries({ queryKey: ['adminCohortSessionOverview', trainee?.cohortId] }),
        queryClient.invalidateQueries({ queryKey: ['adminDashboard'] }),
      ]);
      showToast(`${trainee?.name || 'Trainee'} marked as dropped out`, 'success');
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Could not mark this trainee as dropped out', 'error'),
  });

  const handleToggleCourse = (courseId, currentCompleted) => {
    if (trainee.status === 'dropped_out') return;
    updateProgressMutation.mutate({
      courseId,
      completed: !currentCompleted,
    });
  };

  const handleToggleTalentNextCourse = (courseId) => {
    if (trainee.status === 'dropped_out') return;
    const completionMap = talentnextProgress?.completionMap || {};
    const currentStatus = completionMap[courseId]?.completed || false;
    updateTalentNextMutation.mutate({
      courseId,
      completed: !currentStatus,
    });
  };

  const handleToggleWeek = (weekNumber, markAllComplete) => {
    if (trainee.status === 'dropped_out') return;
    updateProgressMutation.mutate({
      weekNumber,
      completed: markAllComplete,
    });
  };

  const handleAnswerChange = (key, value) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFeedbackSubmit = (e, advanceToNext = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (trainee.status === 'dropped_out') return;
    submitFeedbackMutation.mutate({
      week: selectedWeek,
      answersPayload: answers,
      advanceToNext,
    });
  };

  const jumpToWeekFeedback = (weekNumber) => {
    setSelectedWeek(weekNumber);
    const elem = document.getElementById('feedback-section');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (isError) {
    const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to load trainee details';
    const statusCode = error?.response?.status;
    const isForbidden = statusCode === 403;
    
    return (
      <EmptyState
        icon={AlertCircle}
        title={isForbidden ? 'Access Denied' : 'Trainee Not Found'}
        description={isForbidden 
          ? 'You do not have permission to view this trainee\'s profile. This trainee may be assigned to another mentor.'
          : errorMsg}
        action={
          <Link to="/mentor/dashboard" className="text-xs font-bold text-emerald-600">
            &larr; Back to My Trainees
          </Link>
        }
      />
    );
  }

  if (!trainee) {
    return (
      <EmptyState
        title="Trainee not found"
        description="The trainee record does not exist or you do not have permission to view it."
        action={
          <Link to="/mentor/dashboard" className="text-xs font-bold text-emerald-600">
            &larr; Back to Dashboard
          </Link>
        }
      />
    );
  }

  // Map completed items for quick lookup
  const progressMap = {};
  progress?.items?.forEach((it) => {
    progressMap[it.courseId] = it.completed;
  });

  return (
    <div className="space-y-8">
      {/* Back button & Trainee Header Card */}
      <div>
        <Link
          to="/mentor/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Trainees</span>
        </Link>

        <Card className="border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50/20 shadow-soft">
          <CardBody className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <h1 className="text-2xl font-black text-slate-900">{trainee.name}</h1>
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {trainee.employeeId}
                  </span>
                  {trainee.status === 'dropped_out' && <Badge variant="danger">Dropped Out</Badge>}
                </div>
                <p className="text-xs text-slate-500">{trainee.email}</p>
                <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs font-semibold text-slate-600">
                  <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                    {trainee.department}
                  </span>
                  <span>&bull;</span>
                  <span>{trainee.cohort?.name || 'Cohort'}</span>
                  <span>&bull;</span>
                  <span className="text-emerald-700 font-bold">{plan?.name || 'Training Plan'}</span>
                  <span>&bull;</span>
                  <span className="text-purple-700 font-bold">{totalWeeksCount} Total Weeks</span>
                </div>
              </div>

              {/* Dual Progress Summary Cards: Curriculum & Weekly Feedback */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[480px]">
                {/* Metric 1: Curriculum */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Curriculum</span>
                    </span>
                    <span className="text-base font-black text-emerald-600">
                      {progress?.percentComplete || 0}%
                    </span>
                  </div>
                  <ProgressBar percent={progress?.percentComplete || 0} size="sm" showLabel={false} />
                  <p className="text-[11px] text-slate-400 mt-2 text-right">
                    {progress?.items?.filter((i) => i.completed).length || 0} of {progress?.items?.length || 0} courses
                  </p>
                </div>

                {/* Metric 2: Weekly Feedback Form */}
                <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                      <span>Weekly Reviews</span>
                    </span>
                    <span className="text-base font-black text-purple-700">
                      {feedbackPercent}%
                    </span>
                  </div>
                  <ProgressBar percent={feedbackPercent} size="sm" showLabel={false} />
                  <p className="text-[11px] text-slate-400 mt-2 text-right">
                    {feedbackHistory.length} of {totalWeeksCount} weeks reviewed
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start lg:items-end gap-2">
                {trainee.status === 'dropped_out' ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-right">
                    <p className="text-sm font-bold text-rose-700">Trainee dropped out</p>
                    {trainee.droppedOutAt && <p className="text-xs text-rose-600 mt-1">Recorded {new Date(trainee.droppedOutAt).toLocaleDateString()}</p>}
                    {trainee.dropoutReason && <p className="text-xs text-rose-600 mt-1">Reason: {trainee.dropoutReason}</p>}
                  </div>
                ) : role === 'mentor' ? (
                  <button
                    type="button"
                    disabled={dropoutMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Mark ${trainee.name} as dropped out? This will stop progress and feedback updates.`)) {
                        dropoutMutation.mutate();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <UserX className="w-4 h-4" />
                    {dropoutMutation.isPending ? 'Updating…' : 'Mark as Dropout'}
                  </button>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {trainee.status === 'dropped_out' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          This trainee has dropped out. Curriculum progress, TalentNext updates, and weekly feedback are disabled.
        </div>
      )}

      <div className={trainee.status === 'dropped_out' ? 'pointer-events-none opacity-60' : ''}>

      {/* TalentNext Courses Section */}
      {talentnextCourses.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50/30 to-white shadow-soft">
          <CardHeader className="py-4 px-6 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedTalentNext(!expandedTalentNext)}
                  className="text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ChevronRight className={`w-5 h-5 transition-transform ${expandedTalentNext ? 'rotate-90' : ''}`} />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    TalentNext Courses
                  </h2>
                  <p className="text-xs text-slate-500">Track completion of professional development courses</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200">
                  {talentnextProgress?.completionMap 
                    ? Object.values(talentnextProgress.completionMap).filter(c => c.completed).length 
                    : 0} of {talentnextCourses.length}
                </span>
              </div>
            </div>
          </CardHeader>

          {expandedTalentNext && (
            <CardBody className="p-4 space-y-2.5">
              {talentnextCourses.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs italic">
                  No TalentNext courses assigned to this cohort.
                </div>
              ) : (
                talentnextCourses.map((course) => {
                  const completionMap = talentnextProgress?.completionMap || {};
                  const courseCompletion = completionMap[course.id];
                  const isCompleted = courseCompletion?.completed || false;

                  return (
                    <div
                      key={course.id}
                      onClick={() => handleToggleTalentNextCourse(course.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isCompleted
                          ? 'bg-blue-50/60 border-blue-200 text-blue-950'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          isCompleted
                            ? 'bg-blue-600 text-white'
                            : 'border-2 border-slate-300 hover:border-blue-500'
                        }`}
                      >
                        {isCompleted && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-bold line-clamp-1 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                            {course.name}
                          </span>
                          {course.isMandatory && (
                            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                              Mandatory
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          )}
        </Card>
      )}

      {/* Main Grid: Plan Checklist & Feedback Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Weekly Courses Checklist (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Training Plan Checklist</h2>
              <p className="text-xs text-slate-500">Track course completion and jump to weekly reviews</p>
            </div>
            {plan && (
              <Badge variant="primary">{totalWeeksCount} Weeks Curriculum</Badge>
            )}
          </div>

          {!plan ? (
            <EmptyState
              title="No training plan active"
              description="A training plan has not yet been applied to this cohort."
            />
          ) : (
            <div className="space-y-5">
              {plan.weeks?.map((week) => {
                const weekCourses = week.courses || [];
                const isBufferOnly = (week.isBuffer || weekCourses.length === 0) && weekCourses.length === 0;
                const allWeekComplete = weekCourses.length > 0 && weekCourses.every((c) => progressMap[c.courseId]);
                const completedCount = weekCourses.filter((c) => progressMap[c.courseId]).length;
                const isFeedbackSubmitted = !!submittedWeeksMap[week.weekNumber];

                if (isBufferOnly) {
                  return (
                    <Card key={week.weekNumber} className="border-amber-200 bg-amber-50/20">
                      <CardHeader className="py-3 px-5 bg-amber-50/50">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                            W{week.weekNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-amber-950">{week.title || `Week ${week.weekNumber} (Buffer Week)`}</h3>
                              <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                                Buffer Week
                              </span>
                            </div>
                            <span className="text-[11px] text-amber-700">
                              Catch-up & project milestone period (0 courses)
                            </span>
                          </div>
                        </div>

                        {/* Direct Jump to Feedback Form for this Week */}
                        <button
                          type="button"
                          onClick={() => jumpToWeekFeedback(week.weekNumber)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                            isFeedbackSubmitted
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                          }`}
                          title={`Review feedback form for Week ${week.weekNumber}`}
                        >
                          {isFeedbackSubmitted ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>W{week.weekNumber} Feedback (Done)</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5 text-white" />
                              <span>Review W{week.weekNumber} Feedback</span>
                            </>
                          )}
                        </button>
                      </CardHeader>

                      <CardBody className="p-3.5">
                        <div className="p-3 rounded-xl bg-white border border-amber-200/80 text-xs text-slate-600 flex items-center justify-between">
                          <span className="leading-relaxed">
                            <strong>Buffer Period:</strong> No course modules assigned. Mentee uses this time to catch up on curriculum, complete practical assessments, and receive mentor feedback.
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  );
                }

                return (
                  <Card key={week.weekNumber} className={allWeekComplete ? 'border-emerald-200 bg-emerald-50/10' : ''}>
                    <CardHeader className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          allWeekComplete ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {allWeekComplete ? <Check className="w-4 h-4" /> : week.weekNumber}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{week.title}</h3>
                          <span className="text-[11px] text-slate-500">
                            {completedCount} of {weekCourses.length} completed
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Direct Jump to Feedback Form for this Week */}
                        <button
                          type="button"
                          onClick={() => jumpToWeekFeedback(week.weekNumber)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                            isFeedbackSubmitted
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 shadow-xs'
                          }`}
                          title={`Review feedback form for Week ${week.weekNumber}`}
                        >
                          {isFeedbackSubmitted ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>W{week.weekNumber} Feedback (Done)</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                              <span>Review W{week.weekNumber} Feedback</span>
                            </>
                          )}
                        </button>

                        {/* Mark Week Complete Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleWeek(week.weekNumber, !allWeekComplete)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            allWeekComplete
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-slate-800 hover:bg-slate-900 text-white shadow-xs'
                          }`}
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{allWeekComplete ? 'Unmark Week' : 'Mark Week'}</span>
                        </button>
                      </div>
                    </CardHeader>

                    <CardBody className="p-4 space-y-2">
                      {weekCourses.map((course) => {
                        const isCompleted = !!progressMap[course.courseId];

                        return (
                          <div
                            key={course.courseId}
                            onClick={() => handleToggleCourse(course.courseId, isCompleted)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                              isCompleted
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : 'border-2 border-slate-300 hover:border-emerald-500'
                              }`}
                            >
                              {isCompleted && <Check className="w-3.5 h-3.5" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold line-clamp-1 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                                  {course.title}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                  {course.durationHrs}h
                                </span>
                              </div>
                              {course.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                  {course.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Weekly Feedback Form (Configured to the Cohort) (5 cols) */}
        <div className="lg:col-span-5 space-y-6" id="feedback-section">
          <Card className="border-purple-200 shadow-soft">
            <CardHeader className="bg-gradient-to-r from-purple-50/80 to-white border-b border-purple-100">
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Weekly Feedback Reviews</CardTitle>
                    <Badge variant="primary">
                      {feedbackHistory.length}/{totalWeeksCount} Reviewed
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {feedbackForm?.name || 'Cohort Evaluation Questionnaire'} &bull; Dedicated evaluation for each week
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardBody className="p-5 space-y-5">
              {/* Stepper Header: Quick Week Switcher */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Week ({selectedWeek} of {totalWeeksCount})
                  </span>
                  
                  {/* Next / Prev Stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={selectedWeek <= 1}
                      onClick={() => setSelectedWeek((w) => Math.max(1, w - 1))}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Previous Week"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 font-mono">
                      Week {selectedWeek}
                    </span>
                    <button
                      type="button"
                      disabled={selectedWeek >= totalWeeksCount}
                      onClick={() => setSelectedWeek((w) => Math.min(totalWeeksCount, w + 1))}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Next Week"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Week Grid Chips: Clean & Responsive */}
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-1.5">
                  {weeksList.map((wNum) => {
                    const isSubmitted = !!submittedWeeksMap[wNum];
                    const isSelected = selectedWeek === wNum;
                    const weekObj = plan?.weeks?.find((w) => w.weekNumber === wNum);
                    const isBuffer = weekObj?.isBuffer || !weekObj?.courses || weekObj.courses.length === 0;

                    return (
                      <button
                        key={wNum}
                        type="button"
                        onClick={() => setSelectedWeek(wNum)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'border-purple-600 bg-purple-600 text-white shadow-xs ring-2 ring-purple-500/20'
                            : isSubmitted
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70'
                            : isBuffer
                            ? 'border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100/60'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-black">
                          W{wNum} {isBuffer && <span className="text-[9px] font-normal opacity-75">(Buf)</span>}
                        </span>
                        {isSubmitted ? (
                          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isSelected ? 'text-purple-100' : 'text-emerald-700'}`}>
                            <Check className="w-2.5 h-2.5" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className={`text-[10px] ${isSelected ? 'text-purple-200' : isBuffer ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                            Pending
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Banner for Selected Week */}
              <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs">
                <div className={`p-3.5 flex items-center justify-between text-xs ${
                  existingFeedbackForSelectedWeek
                    ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-100'
                    : 'bg-amber-50 text-amber-900 border-b border-amber-100'
                }`}>
                  <div className="flex items-center gap-2">
                    {existingFeedbackForSelectedWeek ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold">
                        Week {selectedWeek} {plan?.weeks?.find(w => w.weekNumber === selectedWeek)?.isBuffer || plan?.weeks?.find(w => w.weekNumber === selectedWeek)?.courses?.length === 0 ? '(Buffer Week)' : ''} Evaluation:{' '}
                      </span>
                      <span>
                        {existingFeedbackForSelectedWeek
                          ? `Submitted on ${new Date(existingFeedbackForSelectedWeek.submittedAt).toLocaleDateString()}`
                          : 'Pending mentor submission'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    existingFeedbackForSelectedWeek
                      ? 'bg-white text-emerald-700 border border-emerald-200'
                      : 'bg-white text-amber-700 border border-amber-200'
                  }`}>
                    {existingFeedbackForSelectedWeek ? 'Editable' : 'Required'}
                  </span>
                </div>

                {/* Dynamic Feedback Form Configured to the Cohort */}
                <div className="p-4 bg-white">
                  {!feedbackForm ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      No feedback form configured for this cohort.
                    </p>
                  ) : (
                    <form onSubmit={(e) => handleFeedbackSubmit(e, false)} className="space-y-4">
                      {feedbackForm.fields?.map((field) => {
                        const val = answers[field.key] ?? '';

                        return (
                          <div key={field.key} className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-800">
                              {field.label} {field.required && <span className="text-rose-500">*</span>}
                            </label>

                            {field.type === 'rating' && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-1 text-2xl">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        type="button"
                                        key={star}
                                        onClick={() => handleAnswerChange(field.key, star)}
                                        className={`transition-transform hover:scale-115 active:scale-95 ${
                                          (answers[field.key] || 0) >= star ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'
                                        }`}
                                        title={`${star} Star${star > 1 ? 's' : ''}`}
                                      >
                                        ★
                                      </button>
                                    ))}
                                  </div>
                                  {answers[field.key] ? (
                                    <div className="text-right">
                                      <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-lg font-mono">
                                        {answers[field.key]} / 5
                                      </span>
                                      <p className="text-[10px] font-semibold text-slate-600 mt-0.5">
                                        {RATING_LABELS[answers[field.key]]}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Click stars to rate</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {field.type === 'text' && (
                              <textarea
                                rows={3}
                                required={field.required}
                                value={val}
                                onChange={(e) => handleAnswerChange(field.key, e.target.value)}
                                placeholder={`Enter detailed evaluation for ${field.label.toLowerCase()}...`}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800 placeholder:text-slate-400 shadow-2xs"
                              />
                            )}

                            {field.type === 'select' && (
                              <select
                                required={field.required}
                                value={val}
                                onChange={(e) => handleAnswerChange(field.key, e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-800 shadow-2xs"
                              >
                                <option value="">-- Choose Option --</option>
                                {field.options?.map((opt, oIdx) => (
                                  <option key={oIdx} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}

                      {/* Submit Actions */}
                      <div className="pt-2 space-y-2">
                        <button
                          type="submit"
                          disabled={submitFeedbackMutation.isPending}
                          className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {submitFeedbackMutation.isPending
                              ? 'Saving Evaluation...'
                              : existingFeedbackForSelectedWeek
                              ? `Update Week ${selectedWeek} Feedback`
                              : `Submit Week ${selectedWeek} Feedback`}
                          </span>
                        </button>

                        {/* Save & Advance to Next Week Button if not last week */}
                        {selectedWeek < totalWeeksCount && (
                          <button
                            type="button"
                            disabled={submitFeedbackMutation.isPending}
                            onClick={() => handleFeedbackSubmit(null, true)}
                            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>Save & Proceed to Week {selectedWeek + 1}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Submitted Feedback History for Trainee */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Weekly Submissions Log ({feedbackHistory.length} of {totalWeeksCount})</span>
                <span className="text-[11px] font-normal text-slate-500">— {trainee.name}</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Click week to edit</span>
            </div>

            {feedbackHistory.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center">
                <p className="text-xs text-slate-400 italic">No feedback submitted for {trainee.name} yet.</p>
                <p className="text-[11px] text-slate-500 mt-1">Select Week 1 above to submit the first evaluation.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {feedbackHistory.map((fb) => (
                  <Card 
                    key={fb.id} 
                    className={`border transition-all cursor-pointer ${
                      selectedWeek === fb.weekNumber 
                        ? 'border-purple-300 bg-purple-50/30 ring-1 ring-purple-400' 
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <CardHeader 
                      className="p-4 border-b border-slate-100/50"
                      onClick={() => {
                        setExpandedWeeks(prev => ({...prev, [fb.weekNumber]: !prev[fb.weekNumber]}));
                      }}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-purple-950 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center text-[11px] font-black">
                            W{fb.weekNumber}
                          </span>
                          <span>Week {fb.weekNumber} Review for <strong>{trainee.name}</strong></span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${expandedWeeks[fb.weekNumber] ? 'rotate-90' : ''}`} />
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(fb.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardHeader>

                    {expandedWeeks[fb.weekNumber] && (
                      <CardBody className="p-4 space-y-3 bg-purple-50/20">
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-700 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Feedback Details
                          </p>
                          <div className="bg-white rounded-lg border border-slate-200/70 p-3 space-y-2">
                            {Object.entries(fb.answers || {}).map(([k, v]) => (
                              <div key={k} className="flex justify-between items-start text-[11px] pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
                                <span className="text-slate-600 font-medium capitalize">{k.replace(/_/g, ' ')}:</span>
                                <span className="font-bold text-slate-800 text-right max-w-[60%]">
                                  {k.toLowerCase().includes('rating') ? `★ ${v} / 5 (${RATING_LABELS[v] || ''})` : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => jumpToWeekFeedback(fb.weekNumber)}
                          className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-2"
                        >
                          <span>Edit this week's feedback</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </CardBody>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
