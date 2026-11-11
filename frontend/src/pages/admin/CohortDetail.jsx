import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { DataTable, PersonCell } from '../../components/DataTable';
import { AllocateNomineesModal } from '../../components/AllocateNomineesModal';
import { 
  ArrowLeft, Calendar, Award, Users, Settings, UserPlus, 
  KeyRound, CheckCircle2, Lock, Sparkles, BookOpen, Check,
  ChevronDown, ChevronUp, Edit3, Clock, Plus, Trash2, AlertCircle,
  UserCheck, ShieldCheck, Search, Filter, X, Eye, MessageSquare,
  ClipboardList, ChevronRight, Star, ExternalLink, Mail, Copy
} from 'lucide-react';

// The API returns at most 100 rows per page, so walk every page. A cohort or a
// mentor can easily have more than 100 people.
async function fetchAllPages(path) {
  let page = 1;
  let pages = 1;
  let items = [];
  let total = 0;
  do {
    const res = await api.get(path, { params: { limit: 100, page } });
    items = items.concat(res.data.items || []);
    total = res.data.total ?? items.length;
    pages = res.data.pages || 1;
    page += 1;
  } while (page <= pages);
  return { items, total };
}

export function CohortDetail() {
  const { id: cohortId } = useParams();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'nominations' | 'assignments' | 'talentnext' | 'config'
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Search & Filter state for Nominees tab
  const [searchTerm, setSearchTerm] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL');
  const [traineeSearch, setTraineeSearch] = useState('');
  const [traineeFilter, setTraineeFilter] = useState('ALL');

  // Modals
  const [isAllocateMentorsOpen, setIsAllocateMentorsOpen] = useState(false);
  const [isAllocateTraineesOpen, setIsAllocateTraineesOpen] = useState(false);
  const [mentorTemporaryCredentials, setMentorTemporaryCredentials] = useState(null);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [selectedMentorDetails, setSelectedMentorDetails] = useState(null);
  const [targetMentor, setTargetMentor] = useState(null);

  // Edit Cohort & Timeline States
  const [isEditTimelineOpen, setIsEditTimelineOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Extend Weeks & Plan Editor States
  const [isExtendWeeksOpen, setIsExtendWeeksOpen] = useState(false);
  const [additionalWeeksCount, setAdditionalWeeksCount] = useState(1);
  const [newEndDateExtend, setNewEndDateExtend] = useState('');
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [editablePlanName, setEditablePlanName] = useState('');
  const [editablePlanWeeks, setEditablePlanWeeks] = useState([]);

  // Edit Live Feedback Form States
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [editableFormFields, setEditableFormFields] = useState([]);

  // Trainee Feedback Review Modal for Admin
  const [selectedTraineeForFeedback, setSelectedTraineeForFeedback] = useState(null);
  const [isTraineeFeedbackModalOpen, setIsTraineeFeedbackModalOpen] = useState(false);
  const [expandedTalentNext, setExpandedTalentNext] = useState(true); // TalentNext section expanded by default

  // Form states for adding nominee records

  // Expanded mentor card state
  const [expandedMentorId, setExpandedMentorId] = useState(null);
  const [mentorTraineesCache, setMentorTraineesCache] = useState({});
  const [loadingMentorTrainees, setLoadingMentorTrainees] = useState(null);

  // Config tab states
  const [selectedTrainingTplId, setSelectedTrainingTplId] = useState('');
  const [selectedFeedbackTplId, setSelectedFeedbackTplId] = useState('');

  // TalentNext modal and search states
  const [isTalentNextModalOpen, setIsTalentNextModalOpen] = useState(false);
  const [talentNextSearch, setTalentNextSearch] = useState('');
  const [talentNextCourses, setTalentNextCourses] = useState([]);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [selectedCourseMandatory, setSelectedCourseMandatory] = useState(false);

  // Fetch TalentNext Courses
  const { data: availableTalentNextCourses } = useQuery({
    queryKey: ['talentnextCoursesList'],
    queryFn: async () => {
      try {
        const res = await api.get('/talentnext-courses');
        return res.data || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch course details to map IDs to names
  const { data: allTalentNextCourses } = useQuery({
    queryKey: ['allTalentNextCoursesForMapping'],
    queryFn: async () => {
      try {
        const res = await api.get('/talentnext-courses');
        return res.data || [];
      } catch {
        return [];
      }
    },
  });

  // Create a mapping of course ID to course name
  const courseNameMap = {};
  allTalentNextCourses?.forEach(course => {
    courseNameMap[course.id] = course.name;
  });

  // Update component to use fetched courses
  React.useEffect(() => {
    setTalentNextCourses(availableTalentNextCourses || []);
  }, [availableTalentNextCourses]);
  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ['cohort', cohortId],
    queryFn: async () => {
      const res = await api.get(`/cohorts/${cohortId}`);
      return res.data;
    },
  });

  // 2. Fetch Mentors
  const { data: mentorsData, isLoading: mentorsLoading } = useQuery({
    queryKey: ['cohortMentors', cohortId],
    queryFn: async () => {
      return await fetchAllPages(`/cohorts/${cohortId}/mentors`);
    },
  });

  const { data: cohortSessionOverview = [], isLoading: cohortSessionOverviewLoading } = useQuery({
    queryKey: ['adminCohortSessionOverview', cohortId],
    queryFn: async () => {
      const res = await api.get(`/sessions/cohort/${cohortId}/overview`);
      return res.data || [];
    },
    enabled: activeTab === 'nominations' && !!cohortId,
  });

  // 3. Fetch Trainees
  const { data: traineesData, isLoading: traineesLoading } = useQuery({
    queryKey: ['cohortTrainees', cohortId],
    queryFn: async () => {
      return await fetchAllPages(`/cohorts/${cohortId}/trainees`);
    },
  });

  // 4. Fetch Templates for Config Tab
  const { data: trainingTemplates } = useQuery({
    queryKey: ['trainingTemplatesList'],
    queryFn: async () => {
      const res = await api.get('/training-templates?limit=100');
      return res.data?.items || [];
    },
  });

  const { data: feedbackTemplates } = useQuery({
    queryKey: ['feedbackTemplatesList'],
    queryFn: async () => {
      const res = await api.get('/feedback-templates?limit=100');
      return res.data?.items || [];
    },
  });

  // Fetch configured plan & form if available
  const { data: activePlan } = useQuery({
    queryKey: ['cohortPlan', cohortId, cohort?.trainingPlanId],
    queryFn: async () => {
      if (!cohort?.trainingPlanId) return null;
      const res = await api.get(`/cohorts/${cohortId}/plan`);
      return res.data;
    },
    enabled: !!cohort?.trainingPlanId,
  });

  const { data: activeForm } = useQuery({
    queryKey: ['cohortForm', cohortId, cohort?.feedbackFormId],
    queryFn: async () => {
      if (!cohort?.feedbackFormId) return null;
      const res = await api.get(`/cohorts/${cohortId}/feedback-form`);
      return res.data;
    },
    enabled: !!cohort?.feedbackFormId,
  });

  const { data: traineeFeedbackDetail, isLoading: traineeFeedbackLoading } = useQuery({
    queryKey: ['adminTraineeFeedback', selectedTraineeForFeedback?.id],
    queryFn: async () => {
      if (!selectedTraineeForFeedback?.id) return null;
      const res = await api.get(`/mentor/trainees/${selectedTraineeForFeedback.id}`);
      return res.data;
    },
    enabled: isTraineeFeedbackModalOpen && !!selectedTraineeForFeedback?.id,
  });

  // Mutations
  const statusMutation = useMutation({
    mutationFn: async (newStatus) => {
      const res = await api.patch(`/cohorts/${cohortId}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      showToast(`Cohort status changed to ${updated.status}`);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update status', 'error');
    },
  });

  const configureMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/cohorts/${cohortId}/configure`, {
        trainingTemplateId: selectedTrainingTplId,
        feedbackTemplateId: selectedFeedbackTplId,
        force: true,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortPlan', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortForm', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortTrainees', cohortId] });
      showToast('Templates copied and configured for this cohort!');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to configure templates', 'error');
    },
  });

  const updateCohortMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/cohorts/${cohortId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      showToast('Cohort timeline and details updated successfully!');
      setIsEditTimelineOpen(false);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update cohort', 'error');
    },
  });

  const createTalentNextCourseMutation = useMutation({
    mutationFn: async (courseName) => {
      const res = await api.post('/talentnext-courses', { name: courseName });
      return res.data;
    },
    onSuccess: (newCourse) => {
      queryClient.invalidateQueries({ queryKey: ['talentnextCoursesList'] });
      queryClient.invalidateQueries({ queryKey: ['allTalentNextCoursesForMapping'] });
      showToast(`Course "${newCourse.name}" created successfully!`);
      setIsCreateCourseModalOpen(false);
      setNewCourseName('');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to create course', 'error');
    },
  });

  const extendWeeksMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/cohorts/${cohortId}/extend-timeline`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortPlan', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortTrainees', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['mentorCohortPlan'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      showToast('Cohort timeline and curriculum weeks extended successfully!');
      setIsExtendWeeksOpen(false);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to extend weeks', 'error');
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/cohorts/${cohortId}/plan`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortPlan', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortTrainees', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['mentorCohortPlan'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      showToast('Training plan curriculum & weeks updated successfully!');
      setIsEditPlanOpen(false);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update training plan', 'error');
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/cohorts/${cohortId}/feedback-form`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortForm', cohortId] });
      showToast('Cohort feedback questionnaire updated successfully!');
      setIsEditFormOpen(false);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update feedback form', 'error');
    },
  });

  const activateLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/mentors/${targetMentor.id}/activate-login`);
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cohortMentors', cohortId] });
      setMentorTemporaryCredentials({
        name: targetMentor.name,
        email: targetMentor.email,
        password: result.temporaryPassword,
      });
      showToast(`Login activated for mentor ${targetMentor.name}. Share the temporary password securely.`);
      setIsActivateModalOpen(false);
      setTargetMentor(null);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to activate login', 'error');
    },
  });

  const resetMentorPasswordMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await api.post(`/admin/users/users/${userId}/reset-temp-password`);
      return response.data;
    },
    onSuccess: (result) => {
      const mentor = selectedMentorDetails;
      setMentorTemporaryCredentials({
        name: mentor?.name || 'Mentor',
        email: mentor?.email || '',
        password: result.tempPassword,
      });
      setSelectedMentorDetails((current) => current ? { ...current, firstLoginPasswordReset: true } : current);
      queryClient.invalidateQueries({ queryKey: ['cohortMentors', cohortId] });
      showToast('Temporary password generated. Share it securely with the mentor.');
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to reset mentor password', 'error'),
  });

  const toggleAccountMutation = useMutation({
    mutationFn: async ({ userId, isActive }) => {
      const action = isActive ? 'activate' : 'deactivate';
      const response = await api.put(`/admin/users/users/${userId}/${action}`);
      return response.data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cohortMentors', cohortId] });
      showToast(`Account ${variables.isActive ? 'activated' : 'deactivated'}`);
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Failed to update account status', 'error'),
  });

  const assignMentorMutation = useMutation({
    mutationFn: async ({ traineeId, mentorId }) => {
      return await api.put(`/trainees/${traineeId}/mentor`, { mentorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohortTrainees', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohortMentors', cohortId] });
      queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
      showToast('Trainee assigned to mentor!');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to assign mentor', 'error');
    },
  });

  // Handler: Toggle expanded mentor card & fetch their trainees
  const handleMentorExpand = async (mentorId) => {
    if (expandedMentorId === mentorId) {
      setExpandedMentorId(null);
      return;
    }
    setExpandedMentorId(mentorId);
    // Only fetch if not already cached
    if (!mentorTraineesCache[mentorId]) {
      setLoadingMentorTrainees(mentorId);
      try {
        const res = await api.get(`/cohorts/${cohortId}/mentors/${mentorId}/trainees`);
        setMentorTraineesCache((prev) => ({ ...prev, [mentorId]: res.data }));
      } catch (err) {
        setMentorTraineesCache((prev) => ({ ...prev, [mentorId]: [] }));
      } finally {
        setLoadingMentorTrainees(null);
      }
    }
  };

  if (cohortLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (!cohort) {
    return (
      <EmptyState
        title="Cohort not found"
        description="The requested cohort does not exist or has been removed."
        action={
          <Link to="/admin/cohorts" className="text-xs font-bold text-emerald-600">
            &larr; Back to Cohorts
          </Link>
        }
      />
    );
  }

  const isLocked = cohort.status === 'closed';
  const selectedTrainingTpl = trainingTemplates?.find((t) => t.id === selectedTrainingTplId);
  const selectedFeedbackTpl = feedbackTemplates?.find((t) => t.id === selectedFeedbackTplId);

  // Filtered mentors list matching mentor name, employeeId, email, department, nominator OR assigned trainee name/empId/dept
  const filteredMentors = (mentorsData?.items || []).filter((mentor) => {
    const q = searchTerm.toLowerCase().trim();
    const assigned = mentor.assignedTrainees || [];

    const matchesMentorName = mentor.name?.toLowerCase().includes(q);
    const matchesMentorEmail = mentor.email?.toLowerCase().includes(q);
    const matchesMentorEmpId = mentor.employeeId?.toLowerCase().includes(q);
    const matchesMentorDept = mentor.department?.toLowerCase().includes(q);
    const matchesNominator = mentor.nominatorName?.toLowerCase().includes(q);

    const matchesAnyTrainee = assigned.some((t) => 
      t.name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.employeeId?.toLowerCase().includes(q) ||
      t.department?.toLowerCase().includes(q)
    );

    const matchesSearch = !q || matchesMentorName || matchesMentorEmail || matchesMentorEmpId || matchesMentorDept || matchesNominator || matchesAnyTrainee;
    let matchesAssign = true;
    if (assignmentFilter === 'ASSIGNED') {
      matchesAssign = assigned.length > 0;
    } else if (assignmentFilter === 'UNASSIGNED') {
      matchesAssign = assigned.length === 0;
    }

    return matchesSearch && matchesAssign;
  });

  // Trainees tab: search + filter
  const filteredTrainees = (traineesData?.items || []).filter((trainee) => {
    const q = traineeSearch.toLowerCase().trim();
    const matchesSearch = !q || [trainee.name, trainee.email, trainee.employeeId, trainee.location]
      .some((value) => String(value || '').toLowerCase().includes(q));
    const dropped = trainee.status === 'dropped_out';
    let matchesFilter = true;
    if (traineeFilter === 'UNASSIGNED') matchesFilter = !trainee.mentorId && !dropped;
    else if (traineeFilter === 'ASSIGNED') matchesFilter = Boolean(trainee.mentorId) && !dropped;
    else if (traineeFilter === 'DROPPED') matchesFilter = dropped;
    return matchesSearch && matchesFilter;
  });

  // Mentor details modal data (re-read from the list so it stays fresh after edits)
  const detailMentor = selectedMentorDetails
    ? (mentorsData?.items || []).find((mentor) => mentor.id === selectedMentorDetails.id) || selectedMentorDetails
    : null;
  const detailTrainees = detailMentor?.assignedTrainees || [];
  const detailActiveTrainees = detailTrainees.filter((trainee) => trainee.status !== 'dropped_out');
  const detailDroppedOut = detailTrainees.length - detailActiveTrainees.length;
  const detailBatches = detailMentor
    ? (cohortSessionOverview.find((group) => String(group.mentorId) === String(detailMentor.userId))?.batches || [])
    : [];
  const detailSessionCount = detailBatches.reduce((count, batch) => count + (batch.sessions?.length || 0), 0);

  return (
    <div className="space-y-8">
      {/* Back button & Breadcrumb */}
      <div>
        <Link
          to="/admin/cohorts"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Cohorts</span>
        </Link>

        {/* Cohort Header Card */}
        <Card className="border-emerald-100 bg-gradient-to-r from-white via-white to-emerald-50/30">
          <CardBody className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{cohort.name}</h1>
                  <Badge variant={cohort.status} size="md">{cohort.status}</Badge>
                </div>
                <p className="text-sm text-slate-500 max-w-2xl">{cohort.description || 'No description provided.'}</p>
                <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{mentorsData?.total || 0} Mentors</span>
                  </div>
                  <div>&bull;</div>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-400" />
                    <span>{traineesData?.total || 0} Trainees</span>
                  </div>
                  <div>&bull;</div>
                  <div>Managed by Administrator</div>
                </div>
              </div>

              {/* Status & Timeline Controls */}
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => {
                    setEditName(cohort.name);
                    setEditDesc(cohort.description || '');
                    setIsEditTimelineOpen(true);
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Edit</span>
                </button>

                {cohort.status === 'draft' && (
                  <button
                    onClick={() => statusMutation.mutate('active')}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Activate Cohort</span>
                  </button>
                )}
                {cohort.status === 'active' && (
                  <button
                    onClick={() => statusMutation.mutate('closed')}
                    disabled={statusMutation.isPending}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Close Cohort</span>
                  </button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { key: 'overview', label: 'Overview', icon: BookOpen },
          { key: 'nominations', label: `Mentor Details`, icon: Users },
          { key: 'assignments', label: `Assign Mentors (${cohort.assignedTraineeCount || 0}/${cohort.traineeCount || 0})`, icon: Award },
          { key: 'talentnext', label: `TalentNext (${cohort?.talentnextCourses?.length || 0})`, icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                isSelected
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <Card>
              <CardBody className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mentors</span>
                <div className="mt-2 text-2xl font-black text-slate-800">{cohort.mentorCount}</div>
                <p className="text-xs text-slate-500 mt-1">Available mentors</p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trainees</span>
                <div className="mt-2 text-2xl font-black text-slate-800">{cohort.activeTraineeCount ?? cohort.traineeCount}</div>
                <p className="text-xs text-slate-500 mt-1">Active · {cohort.traineeCount} total</p>
              </CardBody>
            </Card>

            <Card className="border-rose-100">
              <CardBody className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Dropped Out</span>
                <div className="mt-2 text-2xl font-black text-rose-600">{cohort.droppedOutTraineeCount || 0}</div>
                <p className="text-xs text-slate-500 mt-1">Trainees who left the cohort</p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Trainees</span>
                <div className="mt-2 text-2xl font-black text-slate-800">
                  {cohort.assignedTraineeCount} / {cohort.activeTraineeCount ?? cohort.traineeCount}
                </div>
                <p className="text-xs text-slate-500 mt-1">Paired with mentors</p>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cohort Completion</span>
                <div className="mt-2 text-2xl font-black text-emerald-600">{cohort.avgProgress}%</div>
                <div className="mt-2">
                  <ProgressBar percent={cohort.avgProgress} size="sm" showLabel={false} />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Configured Templates Preview Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle subtitle="Independent snapshot created for this cohort">
                    Applied Training Plan
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {activePlan && (activePlan.bufferWeeks > 0 || activePlan.weeks?.some(w => w.isBuffer || !w.courses?.length)) ? (
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                          {activePlan.coreWeeks ?? activePlan.weeks?.filter(w => !w.isBuffer && w.courses?.length > 0).length} Core
                        </span>
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                          +{activePlan.bufferWeeks ?? activePlan.weeks?.filter(w => w.isBuffer || !w.courses?.length).length} Buffer
                        </span>
                      </div>
                    ) : (
                      <Badge variant={activePlan ? 'active' : 'draft'}>
                        {activePlan ? `${activePlan.totalWeeks} Weeks` : 'Not Set'}
                      </Badge>
                    )}
                    {activePlan && (
                      <>
                        <button
                          onClick={() => {
                            setEditablePlanName(activePlan.name || '');
                            setEditablePlanWeeks(JSON.parse(JSON.stringify(activePlan.weeks || [])));
                            setIsEditPlanOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                          title="Edit weeks, buffer flags, and course modules"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Weeks</span>
                        </button>
                        <button
                          onClick={() => {
                            setAdditionalWeeksCount(1);
                            setNewEndDateExtend(cohort.endDate);
                            setIsExtendWeeksOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Extend Weeks</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-6">
                {activePlan ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{activePlan.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activePlan.coreWeeks ?? activePlan.weeks?.filter(w => !w.isBuffer && w.courses?.length > 0).length} Core Curriculum Weeks
                        {(activePlan.bufferWeeks > 0 || activePlan.weeks?.some(w => w.isBuffer || !w.courses?.length)) && (
                          <span className="text-amber-700 font-semibold">
                            {` + ${activePlan.bufferWeeks ?? activePlan.weeks?.filter(w => w.isBuffer || !w.courses?.length).length} Buffer Weeks`}
                          </span>
                        )}
                        {` (${activePlan.totalWeeks} Weeks Total)`}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 max-h-56 overflow-y-auto pr-1">
                      {activePlan.weeks?.map((w) => {
                        const isBuffer = w.isBuffer || !w.courses || w.courses.length === 0;

                        return (
                          <div
                            key={w.weekNumber}
                            className={`flex justify-between items-center text-xs p-2.5 rounded-xl border transition-all ${
                              isBuffer
                                ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                                : 'bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                  isBuffer ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {w.weekNumber}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">
                                  {w.title || (isBuffer ? `Week ${w.weekNumber} (Buffer)` : `Week ${w.weekNumber}`)}
                                </span>
                                {isBuffer && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                                    Buffer Week
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              className={`font-mono text-[11px] ${
                                isBuffer ? 'text-amber-800 font-bold' : 'text-slate-500'
                              }`}
                            >
                              {isBuffer ? '0 Courses (Buffer Period)' : `${w.courses?.length || 0} modules`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No training plan applied yet. Go to the Cohort Config tab to select and apply a training plan.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle subtitle="Independent feedback questionnaire copy">
                    Applied Feedback Form
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={activeForm ? 'active' : 'draft'}>
                      {activeForm ? `${activeForm.fields?.length || 0} Questions` : 'Not Set'}
                    </Badge>
                    {activeForm && (
                      <button
                        onClick={() => {
                          setEditableFormFields(JSON.parse(JSON.stringify(activeForm.fields || [])));
                          setIsEditFormOpen(true);
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Form</span>
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-6">
                {activeForm ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-800">{activeForm.name}</h4>
                    <p className="text-xs text-slate-500">{activeForm.fields?.length || 0} Dynamic Form Fields</p>
                    <div className="space-y-1.5 pt-2 max-h-56 overflow-y-auto pr-1">
                      {activeForm.fields?.map((f) => (
                        <div key={f.key} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="font-semibold text-slate-700">{f.label}</span>
                          <span className="text-slate-400 uppercase text-[10px] font-mono bg-slate-200/60 px-1.5 py-0.5 rounded">{f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No feedback form applied yet. Go to the Cohort Config tab to select and apply a feedback form.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: NOMINEES (MENTORS + ALLOCATED TRAINEES) */}
      {activeTab === 'nominations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Mentors & Assigned Trainees</h3>
              <p className="text-xs text-slate-500">Mentors in this cohort. Add more from the nominations list.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAllocateMentorsOpen(true)}
              disabled={isLocked}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Mentors from Nominations</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by mentor name, trainee name, employee ID or email..."
                className="w-full pl-10 pr-9 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className="w-full md:w-44 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                <option value="ALL">All Mentors</option>
                <option value="ASSIGNED">With Trainees</option>
                <option value="UNASSIGNED">No Trainees Yet</option>
              </select>
            </div>
          </div>

          <DataTable
            loading={mentorsLoading}
            rows={filteredMentors}
            emptyMessage={
              searchTerm || assignmentFilter !== 'ALL'
                ? 'No mentors or trainees match your search.'
                : 'No mentors in this cohort yet. Use "Add Mentors from Nominations" to add some.'
            }
            columns={[
              {
                key: 'name',
                header: 'Mentor',
                render: (mentor) => <PersonCell primary={mentor.name} secondary={mentor.email} />,
              },
              {
                key: 'employeeId',
                header: 'Employee ID',
                render: (mentor) => (
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{mentor.employeeId || '—'}</span>
                ),
              },
              { key: 'location', header: 'Location', render: (mentor) => mentor.location || '—' },
              {
                key: 'trainees',
                header: 'Trainees',
                render: (mentor) => {
                  const assigned = mentor.assignedTrainees || [];
                  const droppedOut = assigned.filter((t) => t.status === 'dropped_out').length;
                  return (
                    <span className="text-xs">
                      <span className="font-bold text-slate-800">{assigned.length - droppedOut}</span> active
                      {droppedOut > 0 && <span className="ml-1.5 font-semibold text-rose-700">· {droppedOut} dropped</span>}
                    </span>
                  );
                },
              },
              {
                key: 'groups',
                header: 'Groups · Sessions',
                render: (mentor) => {
                  const group = cohortSessionOverview.find((g) => String(g.mentorId) === String(mentor.userId));
                  const batches = group?.batches || [];
                  const sessions = batches.reduce((count, batch) => count + (batch.sessions?.length || 0), 0);
                  return <span className="text-xs text-slate-600">{batches.length} groups · {sessions} sessions</span>;
                },
              },
              {
                key: 'account',
                header: 'Login',
                render: (mentor) => (
                  <div className="flex items-center gap-2">
                    <Badge variant={!mentor.isLoginActive || !mentor.isAccountActive ? 'draft' : 'active'}>
                      {!mentor.isLoginActive ? 'No login' : !mentor.isAccountActive ? 'Deactivated' : mentor.firstLoginPasswordReset ? 'Setup pending' : 'Active'}
                    </Badge>
                    {!mentor.isLoginActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetMentor(mentor);
                          setIsActivateModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        <KeyRound className="w-3 h-3" /> Activate
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mentor.isAccountActive}
                        aria-label={`${mentor.isAccountActive ? 'Deactivate' : 'Activate'} mentor account`}
                        onClick={() => toggleAccountMutation.mutate({ userId: mentor.userId, isActive: !mentor.isAccountActive })}
                        disabled={toggleAccountMutation.isPending}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${mentor.isAccountActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${mentor.isAccountActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    )}
                  </div>
                ),
              },
              {
                key: 'details',
                header: '',
                render: (mentor) => (
                  <button
                    type="button"
                    onClick={() => setSelectedMentorDetails(mentor)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details
                  </button>
                ),
              },
            ]}
            pageSize={10}
          />
        </div>
      )}

      {/* TAB 3: ASSIGNMENTS (ADMIN ONLY ASSIGNS MENTOR TO TRAINEE) */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Assign Mentor to Trainee</h3>
              <p className="text-xs text-slate-500">
                Add trainees from the nominations list, then pick a mentor for each one. Any mentor in this cohort can be assigned to any trainee.
                The system creates or updates the trainee's progress tracking automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAllocateTraineesOpen(true)}
              disabled={isLocked}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Trainees from Nominations</span>
            </button>
          </div>

          <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={traineeSearch}
                onChange={(e) => setTraineeSearch(e.target.value)}
                placeholder="Search trainee name, email, employee ID or location..."
                className="w-full pl-10 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
            </div>
            <select
              value={traineeFilter}
              onChange={(e) => setTraineeFilter(e.target.value)}
              className="w-full md:w-48 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            >
              <option value="ALL">All Trainees</option>
              <option value="UNASSIGNED">Without a mentor</option>
              <option value="ASSIGNED">With a mentor</option>
              <option value="DROPPED">Dropped out</option>
            </select>
          </div>

          <DataTable
            loading={traineesLoading}
            rows={filteredTrainees}
            emptyMessage={
              traineeSearch || traineeFilter !== 'ALL'
                ? 'No trainees match your search.'
                : 'No trainees in this cohort yet. Use "Add Trainees from Nominations" to add some.'
            }
            columns={[
              {
                key: 'name',
                header: 'Trainee',
                render: (trainee) => <PersonCell primary={trainee.name} secondary={trainee.email} />,
              },
              {
                key: 'employeeId',
                header: 'Employee ID',
                render: (trainee) => (
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{trainee.employeeId || '—'}</span>
                ),
              },
              { key: 'location', header: 'Location', render: (trainee) => trainee.location || '—' },
              {
                key: 'progress',
                header: 'Progress',
                className: 'min-w-[120px]',
                render: (trainee) => (
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><ProgressBar percent={trainee.percentComplete || 0} size="sm" showLabel={false} /></div>
                    <span className="text-xs font-bold text-slate-700 w-9 text-right">{Math.round(trainee.percentComplete || 0)}%</span>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (trainee) =>
                  trainee.status === 'dropped_out' ? (
                    <Badge variant="danger">Dropped Out</Badge>
                  ) : (
                    <Badge variant={trainee.mentorId ? 'active' : 'draft'}>{trainee.mentorId ? 'Assigned' : 'Unassigned'}</Badge>
                  ),
              },
              {
                key: 'mentor',
                header: 'Assigned Mentor',
                className: 'min-w-[230px]',
                render: (trainee) => {
                  const currentMentorId = trainee.mentorId || '';
                  const cohortMentors = mentorsData?.items || [];
                  const assignedMentor = cohortMentors.find((mentor) => mentor.id === currentMentorId);
                  const assignedMentorIsDeactivated = Boolean(assignedMentor?.isLoginActive && !assignedMentor?.isAccountActive);
                  const assignableMentors = cohortMentors.filter((mentor) => !(mentor.isLoginActive && !mentor.isAccountActive));
                  return (
                    <div>
                      <select
                        value={currentMentorId}
                        disabled={trainee.status === 'dropped_out' || isLocked}
                        onChange={(e) => {
                          const mentorId = e.target.value;
                          if (mentorId) assignMentorMutation.mutate({ traineeId: trainee.id, mentorId });
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">-- Select a Mentor --</option>
                        {assignedMentorIsDeactivated && (
                          <option value={assignedMentor.id} disabled>
                            {assignedMentor.name} ({assignedMentor.employeeId || 'EMP'}) · Deactivated (currently assigned)
                          </option>
                        )}
                        {assignableMentors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.employeeId || 'EMP'}) · {m.assignedTraineesCount} trainees
                          </option>
                        ))}
                      </select>
                      {assignedMentorIsDeactivated && trainee.status !== 'dropped_out' && (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Assigned to a deactivated mentor. Pick an active mentor.</p>
                      )}
                    </div>
                  );
                },
              },
            ]}
            pageSize={10}
          />
        </div>
      )}

      {/* TAB 4: TALENTNEXT COURSES MANAGEMENT */}
      {activeTab === 'talentnext' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">TalentNext Courses</h2>
              <p className="text-sm text-slate-500 mt-1">View, edit, and manage TalentNext courses for this cohort</p>
            </div>
            <button
              onClick={() => setIsTalentNextModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          </div>

          {/* Courses List */}
          <div className="space-y-2">
            {cohort?.talentnextCourses && cohort.talentnextCourses.length > 0 ? (
              cohort.talentnextCourses.map((assignment, idx) => (
                <Card key={idx} className="border-slate-200">
                  <CardBody className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {courseNameMap[assignment.courseId] || `Course (${assignment.courseId.substring(0, 8)}...)`}
                        </span>
                        <Badge variant={assignment.isMandatory ? 'danger' : 'info'}>
                          {assignment.isMandatory ? 'Mandatory' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingCourseId(assignment.courseId);
                          setSelectedCourseMandatory(assignment.isMandatory);
                          setIsTalentNextModalOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Edit course"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const updated = cohort.talentnextCourses.filter((_, i) => i !== idx);
                          updateCohortMutation.mutate(
                            { talentnextCourses: updated },
                            {
                              onSuccess: () => {
                                showToast('Course removed from cohort');
                                queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
                              },
                              onError: (err) => {
                                showToast(`Failed to remove course: ${err.message}`, 'error');
                              }
                            }
                          );
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardBody>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No TalentNext courses assigned"
                description="Add TalentNext courses to provide trainees with learning paths"
                action={
                  <button
                    onClick={() => setIsTalentNextModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Course</span>
                  </button>
                }
              />
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!mentorTemporaryCredentials}
        onClose={() => setMentorTemporaryCredentials(null)}
        title="Mentor Temporary Password"
        maxWidth="max-w-lg"
      >
        {mentorTemporaryCredentials && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{mentorTemporaryCredentials.name}</p>
              <p className="text-xs text-slate-500">{mentorTemporaryCredentials.email}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-emerald-800">Temporary password — show once</label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-800">{mentorTemporaryCredentials.password}</code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(mentorTemporaryCredentials.password);
                      showToast('Temporary password copied');
                    } catch {
                      showToast('Could not copy the password. Select and copy it manually.', 'warning');
                    }
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                ><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Share this temporary password securely. The mentor must enter it as their current password and set a new password on first login. This password cannot be viewed again.</p>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setMentorTemporaryCredentials(null)} className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-900">Done</button>
            </div>
          </div>
        )}
      </Modal>


      {/* MODAL: Add nominated mentors / trainees to this cohort */}
      <AllocateNomineesModal
        isOpen={isAllocateMentorsOpen}
        onClose={() => setIsAllocateMentorsOpen(false)}
        kind="mentor"
        cohortId={cohortId}
        cohortName={cohort.name}
      />
      <AllocateNomineesModal
        isOpen={isAllocateTraineesOpen}
        onClose={() => setIsAllocateTraineesOpen(false)}
        kind="trainee"
        cohortId={cohortId}
        cohortName={cohort.name}
      />

      {/* MODAL: Mentor details */}
      {detailMentor && (
        <Modal
          isOpen
          onClose={() => setSelectedMentorDetails(null)}
          title={`Mentor Details · ${detailMentor.name}`}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-5">
            <section className="grid sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
              <div><span className="text-slate-500">Employee ID</span><p className="font-semibold text-slate-800">{detailMentor.employeeId || 'Not provided'}</p></div>
              <div><span className="text-slate-500">Email</span><p className="font-semibold text-slate-800">{detailMentor.email}</p></div>
              <div><span className="text-slate-500">Location</span><p className="font-semibold text-slate-800">{detailMentor.location || 'Not provided'}{detailMentor.timezone ? ` · ${detailMentor.timezone}` : ''}</p></div>
              <div><span className="text-slate-500">Login</span><p className="font-semibold text-slate-800">{!detailMentor.isLoginActive ? 'Not activated' : !detailMentor.isAccountActive ? 'Inactive' : detailMentor.firstLoginPasswordReset ? 'Password setup pending' : 'Active'}</p></div>
              <div><span className="text-slate-500">Nominated by</span><p className="font-semibold text-slate-800">{detailMentor.nominatorName || 'Platform Administrator'}</p></div>
              <div><span className="text-slate-500">Nominated on</span><p className="font-semibold text-slate-800">{detailMentor.createdAt ? new Date(detailMentor.createdAt).toLocaleDateString() : 'Not provided'}</p></div>
            </section>

            {detailMentor.isLoginActive && detailMentor.userId && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-900">Mentor login credentials</p>
                  <p className="mt-0.5 text-xs text-amber-800">Passwords are stored securely and cannot be viewed. Reset to generate a one-time temporary password.</p>
                </div>
                <button
                  type="button"
                  onClick={() => resetMentorPasswordMutation.mutate(detailMentor.userId)}
                  disabled={resetMentorPasswordMutation.isPending}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {resetMentorPasswordMutation.isPending ? 'Generating…' : 'Reset password'}
                </button>
              </div>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800">Allocated Trainees</h4>
                <span className="text-xs font-semibold text-purple-700">{detailActiveTrainees.length} active · {detailDroppedOut} dropped out</span>
              </div>
              <DataTable
                rows={detailTrainees}
                emptyMessage="No trainees assigned."
                pageSize={10}
                columns={[
                  { key: 'name', header: 'Trainee', render: (t) => <PersonCell primary={t.name} secondary={t.email} /> },
                  { key: 'employeeId', header: 'Employee ID', render: (t) => <span className="font-mono text-xs">{t.employeeId || '—'}</span> },
                  { key: 'location', header: 'Location', render: (t) => t.location || '—' },
                  {
                    key: 'progress',
                    header: 'Progress',
                    className: 'min-w-[120px]',
                    render: (t) => (
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><ProgressBar percent={t.percentComplete || 0} size="sm" showLabel={false} /></div>
                        <span className="text-xs font-bold w-9 text-right">{Math.round(t.percentComplete || 0)}%</span>
                      </div>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (t) =>
                      t.status === 'dropped_out' ? (
                        <div>
                          <Badge variant="danger">Dropped out</Badge>
                          {t.dropoutReason && <p className="mt-1 text-[11px] text-rose-600">{t.dropoutReason}</p>}
                        </div>
                      ) : (
                        <Badge variant="active">Active</Badge>
                      ),
                  },
                  {
                    key: 'feedback',
                    header: '',
                    render: (t) => (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTraineeForFeedback({
                            ...t,
                            mentorName: detailMentor.name,
                            mentorEmployeeId: detailMentor.employeeId,
                            mentorEmail: detailMentor.email,
                            mentorDepartment: detailMentor.department,
                            mentorNominatedBy: detailMentor.nominatorName,
                          });
                          setIsTraineeFeedbackModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details & feedback
                      </button>
                    ),
                  },
                ]}
              />
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800">Training Groups & Sessions</h4>
                <span className="text-xs text-slate-500">{detailBatches.length} groups · {detailSessionCount} sessions</span>
              </div>
              {cohortSessionOverviewLoading ? (
                <p className="text-sm text-slate-500">Loading group and session details…</p>
              ) : detailBatches.length ? (
                <div className="space-y-4">
                  {detailBatches.map((batch) => (
                    <div key={batch.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h5 className="font-bold text-slate-800">{batch.name}</h5>
                        <span className="text-xs text-slate-500">{batch.traineeCount} trainees</span>
                      </div>
                      <DataTable
                        rows={batch.trainees}
                        rowKey={(t) => t.traineeId}
                        emptyMessage="No trainees in this group."
                        pageSize={10}
                        columns={[
                          { key: 'name', header: 'Trainee', render: (t) => <PersonCell primary={t.name} secondary={t.email} /> },
                          { key: 'location', header: 'Location', render: (t) => t.location || '—' },
                          {
                            key: 'status',
                            header: 'Status',
                            render: (t) => t.status === 'dropped_out' ? <Badge variant="danger">Dropped out</Badge> : <Badge variant="active">Active</Badge>,
                          },
                        ]}
                      />
                      <div className="space-y-2">
                        {batch.sessions.length ? batch.sessions.map((session) => (
                          <div key={session.id} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-sm text-slate-800">{session.title}</p>
                                <p className="text-xs text-slate-500">{new Date(session.sessionDate).toLocaleDateString()} · {session.startTime}–{session.endTime}</p>
                              </div>
                              <Badge>{session.status?.replace('_', ' ')}</Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Attendance: {session.presentCount} present · {session.attendanceCount}/{session.attendance.length} marked</p>
                            {session.attendance.length > 0 && (
                              <div className="mt-2">
                                <DataTable
                                  rows={session.attendance}
                                  rowKey={(record) => record.traineeId}
                                  pageSize={10}
                                  columns={[
                                    { key: 'name', header: 'Trainee' },
                                    {
                                      key: 'status',
                                      header: 'Attendance',
                                      render: (record) => (
                                        <span className={`text-xs font-bold capitalize ${record.status === 'present' ? 'text-emerald-600' : record.status === 'absent' ? 'text-rose-600' : 'text-slate-400'}`}>
                                          {record.status.replace('_', ' ')}
                                        </span>
                                      ),
                                    },
                                  ]}
                                />
                              </div>
                            )}
                          </div>
                        )) : <p className="text-xs text-slate-500">No sessions scheduled for this group.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No training groups created for this mentor.</p>}
            </section>
          </div>
        </Modal>
      )}

      {/* MODAL: Activate Mentor Login */}
      <Modal isOpen={isActivateModalOpen} onClose={() => setIsActivateModalOpen(false)} title={`Activate Login: ${targetMentor?.name}`}>
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Activate a mentor login for <strong>{targetMentor?.email}</strong>. A temporary password will be generated and shown once. The mentor must create a new password the first time they sign in.
          </p>
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsActivateModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => activateLoginMutation.mutate()}
              disabled={activateLoginMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{activateLoginMutation.isPending ? 'Activating…' : 'Activate & Generate Password'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit Cohort Profile */}
      <Modal
        isOpen={isEditTimelineOpen}
        onClose={() => setIsEditTimelineOpen(false)}
        title="Edit Cohort Profile"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateCohortMutation.mutate({
              name: editName,
              description: editDesc,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cohort Name
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditTimelineOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateCohortMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{updateCohortMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Extend Weeks for Cohort Curriculum */}
      <Modal
        isOpen={isExtendWeeksOpen}
        onClose={() => setIsExtendWeeksOpen(false)}
        title="Extend Curriculum & Add Weeks"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            extendWeeksMutation.mutate({
              additionalWeeks: parseInt(additionalWeeksCount, 10),
              newEndDate: newEndDateExtend || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
            <p className="font-bold">
              Current Curriculum: {activePlan?.totalWeeks || 0} Weeks ({activePlan?.coreWeeks ?? activePlan?.weeks?.filter(w => !w.isBuffer && w.courses?.length > 0).length} Core + {activePlan?.bufferWeeks ?? activePlan?.weeks?.filter(w => w.isBuffer || !w.courses?.length).length} Buffer)
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Extended weeks are added as <strong>Buffer Weeks</strong> (with 0 course modules). Trainees use this buffer period to catch up on assignments, complete projects, and submit weekly mentor feedback without artificial dummy courses.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Number of Additional Weeks to Add
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    setAdditionalWeeksCount(count);
                    const baseDate = new Date(cohort.endDate);
                    baseDate.setDate(baseDate.getDate() + count * 7);
                    setNewEndDateExtend(baseDate.toISOString().split('T')[0]);
                  }}
                  className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                    additionalWeeksCount === count
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  +{count} {count === 1 ? 'Week' : 'Weeks'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Extended Cohort End Date (Optional)
            </label>
            <input
              type="date"
              value={newEndDateExtend}
              onChange={(e) => setNewEndDateExtend(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              New total curriculum will become {(activePlan?.totalWeeks || 0) + parseInt(additionalWeeksCount, 10)} Weeks.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsExtendWeeksOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={extendWeeksMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{extendWeeksMutation.isPending ? 'Extending...' : `Extend by +${additionalWeeksCount} Week(s)`}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Applied Training Plan & Weeks */}
      <Modal
        isOpen={isEditPlanOpen}
        onClose={() => setIsEditPlanOpen(false)}
        title="Edit Cohort Training Plan & Curriculum Weeks"
        maxWidth="max-w-4xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editablePlanWeeks.length === 0) {
              showToast('At least 1 week is required in the training plan', 'error');
              return;
            }
            const cleanedWeeks = editablePlanWeeks.map((w, idx) => ({
              weekNumber: idx + 1,
              title: (w.title || '').trim() || `Week ${idx + 1}`,
              isBuffer: !!w.isBuffer,
              courses: (w.courses || []).map((c) => ({
                courseId: c.courseId || undefined,
                title: (c.title || '').trim(),
                durationHrs: Number(c.durationHrs) || 1,
                description: c.description || '',
              })),
            }));

            for (let w of cleanedWeeks) {
              for (let c of w.courses) {
                if (!c.title) {
                  showToast(`Please enter a title for all modules in Week ${w.weekNumber}`, 'error');
                  return;
                }
              }
            }

            updatePlanMutation.mutate({
              name: editablePlanName.trim() || activePlan?.name || 'Cohort Training Plan',
              totalWeeks: cleanedWeeks.length,
              weeks: cleanedWeeks,
            });
          }}
          className="space-y-5"
        >
          {/* Plan Name & Stats Bar */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Plan Name
              </label>
              <input
                type="text"
                required
                value={editablePlanName}
                onChange={(e) => setEditablePlanName(e.target.value)}
                placeholder="e.g. Full-Stack Engineering Curriculum"
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Overview:</span>
                <span className="bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  {editablePlanWeeks.length} Weeks Total
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  {editablePlanWeeks.filter((w) => !w.isBuffer && w.courses?.length > 0).length} Core
                </span>
                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  {editablePlanWeeks.filter((w) => w.isBuffer || !w.courses?.length).length} Buffer
                </span>
                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  {editablePlanWeeks.reduce((acc, w) => acc + (w.courses?.length || 0), 0)} Total Modules
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextNum = editablePlanWeeks.length + 1;
                  setEditablePlanWeeks([
                    ...editablePlanWeeks,
                    {
                      weekNumber: nextNum,
                      title: `Week ${nextNum}`,
                      isBuffer: false,
                      courses: [],
                    },
                  ]);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Week</span>
              </button>
            </div>
          </div>

          {/* Weeks List */}
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {editablePlanWeeks.map((week, wIdx) => {
              const isBuffer = !!week.isBuffer;
              return (
                <div
                  key={wIdx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isBuffer
                      ? 'bg-amber-50/40 border-amber-200/90'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Week Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isBuffer ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
                        }`}
                      >
                        W{wIdx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={week.title}
                        onChange={(e) => {
                          const updated = [...editablePlanWeeks];
                          updated[wIdx].title = e.target.value;
                          setEditablePlanWeeks(updated);
                        }}
                        placeholder={`Week ${wIdx + 1} Title...`}
                        className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-800 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Buffer Checkbox Toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={isBuffer}
                          onChange={(e) => {
                            const updated = [...editablePlanWeeks];
                            updated[wIdx].isBuffer = e.target.checked;
                            setEditablePlanWeeks(updated);
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] ${
                            isBuffer
                              ? 'bg-amber-100 text-amber-900 border border-amber-200 font-bold'
                              : 'text-slate-600'
                          }`}
                        >
                          Buffer Week
                        </span>
                      </label>

                      {/* Delete Week */}
                      {editablePlanWeeks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editablePlanWeeks
                              .filter((_, i) => i !== wIdx)
                              .map((w, i) => ({ ...w, weekNumber: i + 1 }));
                            setEditablePlanWeeks(filtered);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete this week"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Modules inside Week */}
                  <div className="pt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Course Modules ({week.courses?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editablePlanWeeks];
                          if (!updated[wIdx].courses) updated[wIdx].courses = [];
                          updated[wIdx].courses.push({
                            courseId: '',
                            title: '',
                            durationHrs: 1.0,
                            description: '',
                          });
                          setEditablePlanWeeks(updated);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-dashed border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-slate-500" />
                        <span>Add Module</span>
                      </button>
                    </div>

                    {(!week.courses || week.courses.length === 0) ? (
                      <div className="p-3 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-center">
                        <p className="text-[11px] text-slate-500 italic">
                          {isBuffer
                            ? 'Buffer week period with 0 modules (no formal coursework). You can add modules if needed.'
                            : 'No course modules configured for this week yet. Click "+ Add Module" above to add one.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {week.courses.map((course, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                required
                                value={course.title}
                                onChange={(e) => {
                                  const updated = [...editablePlanWeeks];
                                  updated[wIdx].courses[cIdx].title = e.target.value;
                                  setEditablePlanWeeks(updated);
                                }}
                                placeholder="Module title (e.g. React Hooks Deep Dive)..."
                                className="flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                              />

                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shrink-0">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="number"
                                  min="0.5"
                                  step="0.5"
                                  value={course.durationHrs ?? 1}
                                  onChange={(e) => {
                                    const updated = [...editablePlanWeeks];
                                    updated[wIdx].courses[cIdx].durationHrs = parseFloat(e.target.value) || 1;
                                    setEditablePlanWeeks(updated);
                                  }}
                                  className="w-12 text-xs font-semibold text-slate-700 bg-transparent focus:outline-none text-right"
                                />
                                <span className="text-[10px] text-slate-400 font-bold">hrs</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editablePlanWeeks];
                                  updated[wIdx].courses = updated[wIdx].courses.filter((_, i) => i !== cIdx);
                                  setEditablePlanWeeks(updated);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Remove module"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={course.description || ''}
                              onChange={(e) => {
                                const updated = [...editablePlanWeeks];
                                updated[wIdx].courses[cIdx].description = e.target.value;
                                setEditablePlanWeeks(updated);
                              }}
                              placeholder="Module summary / learning objective (optional)..."
                              className="w-full px-2.5 py-1 text-[11px] text-slate-600 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const nextNum = editablePlanWeeks.length + 1;
                setEditablePlanWeeks([
                  ...editablePlanWeeks,
                  {
                    weekNumber: nextNum,
                    title: `Week ${nextNum}`,
                    isBuffer: false,
                    courses: [],
                  },
                ]);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Week</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditPlanOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatePlanMutation.isPending}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{updatePlanMutation.isPending ? 'Saving Plan...' : 'Save Curriculum Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Live Feedback Form */}
      <Modal
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        title="Edit Cohort Evaluation Questionnaire"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateFormMutation.mutate({
              fields: editableFormFields
            });
          }}
          className="space-y-4"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Questionnaire Metrics ({editableFormFields.length})
            </span>
            <button
              type="button"
              onClick={() => {
                const nextNum = editableFormFields.length + 1;
                setEditableFormFields([
                  ...editableFormFields,
                  {
                    key: `metric_${nextNum}`,
                    label: `Evaluation Metric ${nextNum}`,
                    type: 'rating',
                    options: [],
                    required: true
                  }
                ]);
              }}
              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Question</span>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
            {editableFormFields.map((field, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={field.label}
                    onChange={(e) => {
                      const updated = [...editableFormFields];
                      updated[idx].label = e.target.value;
                      setEditableFormFields(updated);
                    }}
                    placeholder="Question label..."
                    className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const updated = [...editableFormFields];
                      updated[idx].type = e.target.value;
                      setEditableFormFields(updated);
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="rating">Rating (1-5)</option>
                    <option value="text">Text Response</option>
                    <option value="select">Select Dropdown</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setEditableFormFields(editableFormFields.filter((_, i) => i !== idx));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pl-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => {
                        const updated = [...editableFormFields];
                        updated[idx].required = e.target.checked;
                        setEditableFormFields(updated);
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-[11px] font-semibold">Required Question</span>
                  </label>
                  <span className="font-mono text-[10px] text-slate-400">key: {field.key}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditFormOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateFormMutation.isPending}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{updateFormMutation.isPending ? 'Saving...' : 'Save Feedback Form'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Trainee Mentorship & Weekly Feedback */}
      <Modal
        isOpen={isTraineeFeedbackModalOpen}
        onClose={() => {
          setIsTraineeFeedbackModalOpen(false);
          setSelectedTraineeForFeedback(null);
        }}
        title="Trainee Mentorship & Weekly Feedback Log"
      >
        {traineeFeedbackLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading mentorship details and evaluations...</p>
          </div>
        ) : !traineeFeedbackDetail ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Unable to load trainee details.</p>
        ) : (
          <div className="space-y-6">
            {/* 1. Dual Overview Cards: Trainee Info & Mentor Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trainee Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 border border-blue-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                    Trainee Profile
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {traineeFeedbackDetail.trainee?.employeeId}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-base">{traineeFeedbackDetail.trainee?.name}</h4>
                  <p className="text-xs text-slate-500">{traineeFeedbackDetail.trainee?.email}</p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-blue-100/80 text-blue-800 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                    {traineeFeedbackDetail.trainee?.department}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-600 text-[11px] truncate">{cohort?.name}</span>
                </div>

                {/* Progress bar inside Trainee card */}
                <div className="pt-2 border-t border-blue-100/80">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-600">Curriculum Completion</span>
                    <span className="font-bold text-emerald-600">
                      {traineeFeedbackDetail.progress?.percentComplete || 0}%
                    </span>
                  </div>
                  <ProgressBar percent={traineeFeedbackDetail.progress?.percentComplete || 0} size="sm" showLabel={false} />
                  <p className="text-[10px] text-slate-400 mt-1 text-right">
                    {traineeFeedbackDetail.progress?.items?.filter(i => i.completed).length || 0} of {traineeFeedbackDetail.progress?.items?.length || 0} courses complete
                  </p>
                </div>
              </div>

              {/* Mentor Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 border border-purple-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full">
                    Assigned Mentor
                  </span>
                  <span className="font-mono text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {traineeFeedbackDetail.mentor?.employeeId || selectedTraineeForFeedback?.mentorEmployeeId || 'EMP-MTR'}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {traineeFeedbackDetail.mentor?.name || selectedTraineeForFeedback?.mentorName || 'Assigned Mentor'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {traineeFeedbackDetail.mentor?.email || selectedTraineeForFeedback?.mentorEmail || 'mentor@example.com'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-purple-100/80 text-purple-800 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                    {traineeFeedbackDetail.mentor?.department || selectedTraineeForFeedback?.mentorDepartment || 'Engineering'}
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Active Mentor</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-purple-100/80 text-[11px] space-y-1">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Nominated By:</span>
                    <span className="font-bold text-slate-800">
                      {traineeFeedbackDetail.mentor?.nominatorName || selectedTraineeForFeedback?.mentorNominatedBy || 'Platform Administrator'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Weekly Reviews Given:</span>
                    <span className="font-bold text-purple-700">
                      {traineeFeedbackDetail.feedbackHistory?.length || 0} Submitted
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TalentNext Courses Completion Status (Styled like Weekly Feedback) */}
            {traineeFeedbackDetail.talentnextCourses && traineeFeedbackDetail.talentnextCourses.length > 0 && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setExpandedTalentNext(!expandedTalentNext)}
                  className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
                >
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-blue-600" />
                      <span>TalentNext Courses Completion</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Professional development courses completed by trainee
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                      {traineeFeedbackDetail.talentnextProgress?.completionMap 
                        ? Object.values(traineeFeedbackDetail.talentnextProgress.completionMap).filter(c => c.completed).length 
                        : 0} of {traineeFeedbackDetail.talentnextCourses.length}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${expandedTalentNext ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Courses List - Collapsible */}
                {expandedTalentNext && (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {traineeFeedbackDetail.talentnextCourses.map((course) => {
                      const completionMap = traineeFeedbackDetail.talentnextProgress?.completionMap || {};
                      const courseCompletion = completionMap[course.id];
                      const isCompleted = courseCompletion?.completed || false;

                      return (
                        <div
                          key={course.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isCompleted
                              ? 'bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/20 border-emerald-200 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : 'border-2 border-slate-300 bg-white'
                            }`}>
                              {isCompleted && <Check className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h6 className={`text-xs font-bold ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                  {course.name}
                                </h6>
                                {isCompleted ? (
                                  <Badge variant="active">Completed</Badge>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {course.isMandatory && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                    MANDATORY
                                  </span>
                                )}
                                {isCompleted && courseCompletion?.completedAt && (
                                  <p className="text-[10px] text-slate-500">
                                    • Completed on {new Date(courseCompletion.completedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. Weekly Feedback Given to the Trainee from Mentor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-purple-600" />
                    <span>Weekly Feedback Reviews Given by Mentor</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {traineeFeedbackDetail.feedbackForm?.name || 'Cohort Evaluation Questionnaire'} &bull; Evaluations across all weeks
                  </p>
                </div>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                  {traineeFeedbackDetail.feedbackHistory?.length || 0} of {traineeFeedbackDetail.plan?.totalWeeks || activePlan?.totalWeeks || 4} Weeks Reviewed
                </span>
              </div>

              {/* Weeks List */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {Array.from({ length: traineeFeedbackDetail.plan?.totalWeeks || activePlan?.totalWeeks || 4 }, (_, i) => i + 1).map((wNum) => {
                  const fb = traineeFeedbackDetail.feedbackHistory?.find((f) => f.weekNumber === wNum);
                  const weekObj = traineeFeedbackDetail.plan?.weeks?.find(w => w.weekNumber === wNum);
                  const isBuffer = weekObj?.isBuffer || !weekObj?.courses || weekObj.courses.length === 0;

                  return (
                    <div
                      key={wNum}
                      className={`p-4 rounded-2xl border transition-all ${
                        fb 
                          ? 'bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/20 border-emerald-200 shadow-2xs' 
                          : isBuffer
                          ? 'bg-amber-50/40 border-amber-200/80'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            fb 
                              ? 'bg-emerald-600 text-white' 
                              : isBuffer
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {fb ? <Check className="w-4 h-4" /> : `W${wNum}`}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                Week {wNum} Evaluation
                              </span>
                              {isBuffer && (
                                <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                                  Buffer Week
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {fb 
                                ? `Submitted on ${new Date(fb.submittedAt).toLocaleDateString()}` 
                                : `Pending evaluation from mentor ${traineeFeedbackDetail.mentor?.name || selectedTraineeForFeedback?.mentorName || ''}`}
                            </span>
                          </div>
                        </div>

                        {fb ? (
                          <Badge variant="active">Completed</Badge>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            Pending Review
                          </span>
                        )}
                      </div>

                      {/* Submitted Feedback Answers */}
                      {fb && fb.answers ? (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                          {Object.entries(fb.answers).map(([key, val]) => {
                            const isRating = key.toLowerCase().includes('rating');

                            return (
                              <div key={key} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600 font-semibold capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </span>
                                  {isRating && (
                                    <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md font-mono text-[11px]">
                                      ★ {val} / 5
                                    </span>
                                  )}
                                </div>
                                {!isRating && (
                                  <p className="text-slate-800 font-medium leading-relaxed bg-white p-2 rounded-lg border border-slate-200/80">
                                    {String(val)}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic mt-1">
                          No feedback submitted for Week {wNum} yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsTraineeFeedbackModalOpen(false);
                  setSelectedTraineeForFeedback(null);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* TalentNext Courses Modal */}
      <Modal
        isOpen={isTalentNextModalOpen}
        onClose={() => {
          setIsTalentNextModalOpen(false);
          setEditingCourseId(null);
          setSelectedCourseMandatory(false);
        }}
        title={editingCourseId ? 'Edit TalentNext Course' : 'Add TalentNext Course to Cohort'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {!editingCourseId && (
            <>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-900">
                  Select courses from available TalentNext offerings and mark them as mandatory or optional.
                </p>
              </div>

              {/* Create New Course Button */}
              <button
                type="button"
                onClick={() => setIsCreateCourseModalOpen(true)}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New TalentNext Course</span>
              </button>
            </>
          )}

          {editingCourseId && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-900">
                Editing: <strong>{courseNameMap[editingCourseId]}</strong>
              </p>
            </div>
          )}

          {/* Search */}
          {!editingCourseId && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={talentNextSearch}
                onChange={(e) => setTalentNextSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Mandatory/Optional Toggle */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <label className="text-xs font-bold text-slate-700 block mb-2.5">
              Course Type
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="courseMandatory"
                  checked={!selectedCourseMandatory}
                  onChange={() => setSelectedCourseMandatory(false)}
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700">Optional</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="courseMandatory"
                  checked={selectedCourseMandatory}
                  onChange={() => setSelectedCourseMandatory(true)}
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-700">Mandatory</span>
              </label>
            </div>
          </div>

          {/* Courses List */}
          {!editingCourseId && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
            {talentNextCourses && talentNextCourses.length > 0 ? (
              talentNextCourses
                .filter(c => {
                  // Filter by search term
                  const matchesSearch = c.name.toLowerCase().includes(talentNextSearch.toLowerCase());
                  // Filter out already-assigned courses (unless in edit mode)
                  const isAlreadyAssigned = cohort?.talentnextCourses?.some(a => a.courseId === c.id);
                  return matchesSearch && !isAlreadyAssigned;
                })
                .map(course => (
                  <div
                    key={course.id}
                    onClick={() => {
                      let updated;
                      if (editingCourseId) {
                        // Edit mode: update the existing course assignment
                        updated = cohort?.talentnextCourses?.map(assignment =>
                          assignment.courseId === editingCourseId
                            ? { ...assignment, isMandatory: selectedCourseMandatory }
                            : assignment
                        ) || [];
                      } else {
                        // Add mode: add new course
                        const assignment = {
                          courseId: course.id,
                          isMandatory: selectedCourseMandatory
                        };
                        updated = [...(cohort?.talentnextCourses || []), assignment];
                      }

                      // Call mutation to update cohort
                      updateCohortMutation.mutate(
                        { talentnextCourses: updated },
                        {
                          onSuccess: () => {
                            if (editingCourseId) {
                              showToast(`Updated: ${courseNameMap[editingCourseId]} (${selectedCourseMandatory ? 'Mandatory' : 'Optional'})`);
                            } else {
                              showToast(`Added: ${course.name} (${selectedCourseMandatory ? 'Mandatory' : 'Optional'})`);
                            }
                            setIsTalentNextModalOpen(false);
                            setTalentNextSearch('');
                            setSelectedCourseMandatory(false); // Reset for next time
                            setEditingCourseId(null);
                            queryClient.invalidateQueries({ queryKey: ['cohort', cohortId] });
                          },
                          onError: (err) => {
                            showToast(`Failed to update course: ${err.message}`, 'error');
                          }
                        }
                      );
                    }}
                    className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 cursor-pointer hover:bg-emerald-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{course.name}</span>
                      <Plus className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>
                ))
            ) : talentNextCourses.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No courses available. Create them in the admin panel first.</p>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">All available courses are already assigned to this cohort.</p>
            )}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsTalentNextModalOpen(false);
                setEditingCourseId(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Create New TalentNext Course Modal */}
      <Modal
        isOpen={isCreateCourseModalOpen}
        onClose={() => {
          setIsCreateCourseModalOpen(false);
          setNewCourseName('');
        }}
        title="Create New TalentNext Course"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-900">
              Create a new TalentNext course that can be assigned to cohorts.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Course Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Advanced Java Patterns, DevOps Masterclass"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[11px] text-slate-500">
              Enter a descriptive course name that will be visible to mentors and trainees.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateCourseModalOpen(false);
                setNewCourseName('');
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (newCourseName.trim()) {
                  createTalentNextCourseMutation.mutate(newCourseName.trim());
                } else {
                  showToast('Please enter a course name', 'error');
                }
              }}
              disabled={createTalentNextCourseMutation.isPending || !newCourseName.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{createTalentNextCourseMutation.isPending ? 'Creating...' : 'Create Course'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
