import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileText, LoaderCircle, Printer, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardBody } from '../../components/Card';
import '../../styles/AdminReports.css';

const REPORT_SECTIONS = [
  { id: 'overview', label: 'Summary numbers and charts', description: 'Cohorts, mentors, trainees, progress and attendance totals.' },
  { id: 'cohorts', label: 'Cohort performance', description: 'Status, dates, mentor and trainee counts, average progress.' },
  { id: 'mentors', label: 'Mentor details', description: 'Mentor contact, department, login state, and assigned trainees.' },
  { id: 'trainees', label: 'Trainee details', description: 'Employee ID, location, mentor assignment, and progress.' },
  { id: 'batches', label: 'Training groups and progress', description: 'Batch membership, progress, completion and status.' },
  { id: 'sessions', label: 'Sessions and attendance', description: 'Session schedule and each trainee’s recorded attendance.' },
];

const number = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

function HorizontalMetricChart({ title, rows, valueKey, colorClass = 'bg-indigo-500' }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="font-bold text-slate-800 mb-4">{title}</h4>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const value = Math.max(0, Math.min(100, Number(row[valueKey] || 0)));
            return (
              <div key={row.id}>
                <div className="flex justify-between gap-3 text-xs mb-1.5">
                  <span className="font-medium text-slate-600 truncate">{row.name}</span>
                  <span className="font-bold text-slate-800 shrink-0">{number(value, 1)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="text-sm text-slate-400">No cohort data for this chart.</p>}
    </div>
  );
}

function buildReportDataset(cohorts, records) {
  const cohortIds = new Set(cohorts.map((cohort) => String(cohort.id)));
  const mentors = records.flatMap((record) => (record.mentors || []).map((mentor) => ({ ...mentor, reportCohort: record.cohort })));
  const trainees = records.flatMap((record) => (record.trainees || []).map((trainee) => ({ ...trainee, reportCohort: record.cohort })));
  const batches = records.flatMap((record) => (record.groups || []).flatMap((group) => (
    (group.batches || []).map((batch) => ({
      ...batch,
      mentorName: group.mentorName,
      reportCohort: record.cohort,
      analytics: record.batchAnalytics?.[batch.id] || null,
    }))
  )));
  const sessions = batches.flatMap((batch) => (batch.sessions || []).map((session) => ({
    ...session,
    batchName: batch.name,
    mentorName: batch.mentorName,
    reportCohort: batch.reportCohort,
    attendance: session.attendance || [],
  })));

  const cohortRows = cohorts.map((cohort) => {
    const cohortTrainees = trainees.filter((trainee) => String(trainee.cohortId) === String(cohort.id));
    const droppedOutTrainees = cohortTrainees.filter((trainee) => trainee.status === 'dropped_out').length;
    const activeCohortTrainees = cohortTrainees.filter((trainee) => trainee.status !== 'dropped_out');
    const cohortMentors = mentors.filter((mentor) => String(mentor.cohortId) === String(cohort.id));
    const cohortSessions = sessions.filter((session) => String(session.reportCohort?.id) === String(cohort.id));
    const marked = cohortSessions.flatMap((session) => session.attendance).filter((entry) => entry.status !== 'not_marked');
    const present = marked.filter((entry) => entry.status === 'present').length;
    const averageProgress = activeCohortTrainees.length
      ? activeCohortTrainees.reduce((sum, trainee) => sum + Number(trainee.percentComplete || 0), 0) / activeCohortTrainees.length
      : Number(cohort.avgProgress || 0);
    return {
      id: cohort.id,
      name: cohort.name,
      status: cohort.status,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      mentors: cohortMentors.length || Number(cohort.mentorCount || 0),
      trainees: activeCohortTrainees.length || Number(cohort.activeTraineeCount || 0),
      droppedOutTrainees,
      assignedTrainees: activeCohortTrainees.filter((trainee) => trainee.mentorId || trainee.mentorName).length,
      averageProgress,
      sessions: cohortSessions.length,
      attendanceRate: marked.length ? (present / marked.length) * 100 : 0,
    };
  });

  const markedAttendance = sessions.flatMap((session) => session.attendance).filter((entry) => entry.status !== 'not_marked');
  const presentCount = markedAttendance.filter((entry) => entry.status === 'present').length;
  const batchAnalyticsById = Object.fromEntries(batches.map((batch) => [batch.id, batch.analytics]));

  return {
    cohorts: cohortRows,
    mentors,
    trainees,
    batches,
    sessions,
    totals: {
      cohortCount: cohortIds.size,
      mentorCount: mentors.length,
      traineeCount: trainees.length,
      activeTrainees: trainees.filter((trainee) => trainee.status !== 'dropped_out').length,
      droppedOutTrainees: trainees.filter((trainee) => trainee.status === 'dropped_out').length,
      assignedTrainees: trainees.filter((trainee) => trainee.status !== 'dropped_out' && (trainee.mentorId || trainee.mentorName)).length,
      batchCount: batches.length,
      sessionCount: sessions.length,
      averageProgress: trainees.filter((trainee) => trainee.status !== 'dropped_out').length
        ? trainees.filter((trainee) => trainee.status !== 'dropped_out').reduce((sum, trainee) => sum + Number(trainee.percentComplete || 0), 0) / trainees.filter((trainee) => trainee.status !== 'dropped_out').length
        : 0,
      attendanceCount: markedAttendance.length,
      presentCount,
      absentCount: markedAttendance.filter((entry) => entry.status === 'absent').length,
      attendanceRate: markedAttendance.length ? (presentCount / markedAttendance.length) * 100 : 0,
      completedSessions: sessions.filter((session) => session.status === 'completed').length,
    },
    batchAnalyticsById,
  };
}

export function AdminReports() {
  const { showToast } = useToast();
  const [reportName, setReportName] = useState('Cohort performance report');
  const [description, setDescription] = useState('');
  const [cohortScope, setCohortScope] = useState('all');
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [selectedSections, setSelectedSections] = useState(REPORT_SECTIONS.map((section) => section.id));
  const [report, setReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: cohortResponse, isLoading: cohortsLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get('/cohorts?limit=100')).data,
  });
  const cohorts = cohortResponse?.items || [];

  const reportCohorts = useMemo(() => {
    if (cohortScope === 'one' && selectedCohortId) return cohorts.filter((cohort) => cohort.id === selectedCohortId);
    return cohorts;
  }, [cohorts, cohortScope, selectedCohortId]);

  const handleSectionChange = (sectionId) => {
    setSelectedSections((current) => current.includes(sectionId)
      ? current.filter((section) => section !== sectionId)
      : [...current, sectionId]);
  };

  const generateReport = async (event) => {
    event.preventDefault();
    if (!reportName.trim()) return showToast('Enter a report name.', 'error');
    if (selectedSections.length === 0) return showToast('Choose at least one report section.', 'error');
    if (cohortScope === 'one' && !selectedCohortId) return showToast('Choose a cohort for this report.', 'error');
    if (!reportCohorts.length) return showToast('There are no cohorts available to report on.', 'error');

    setIsGenerating(true);
    try {
      const records = await Promise.all(reportCohorts.map(async (cohort) => {
        const [mentorResponse, traineeResponse, groupsResponse] = await Promise.all([
          api.get(`/cohorts/${cohort.id}/mentors?limit=100`),
          api.get(`/cohorts/${cohort.id}/trainees?limit=100`),
          api.get(`/sessions/cohort/${cohort.id}/overview`),
        ]);
        const groups = groupsResponse.data || [];
        const cohortBatches = groups.flatMap((group) => group.batches || []);
        const analyticsEntries = await Promise.all(cohortBatches.map(async (batch) => {
          try {
            const response = await api.get(`/batches/${batch.id}/analytics`);
            return [batch.id, response.data];
          } catch {
            return [batch.id, null];
          }
        }));
        return {
          cohort,
          mentors: mentorResponse.data?.items || [],
          trainees: traineeResponse.data?.items || [],
          groups,
          batchAnalytics: Object.fromEntries(analyticsEntries),
        };
      }));

      const data = buildReportDataset(reportCohorts, records);
      setReport({
        name: reportName.trim(),
        description: description.trim(),
        generatedAt: new Date(),
        sections: [...selectedSections],
        data,
      });
      showToast('Report generated and ready to view.', 'success');
    } catch (error) {
      showToast(error.response?.data?.detail || 'Could not generate the report. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = () => window.print();

  const sectionEnabled = (id) => report?.sections.includes(id);

  return (
    <main className="admin-reports-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      <div className="report-builder flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Build a cohort report, choose what it contains, then preview or save it.</p>
        </div>
        {report && (
          <button type="button" onClick={downloadReport} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        )}
      </div>

      <Card className="report-builder">
        <CardBody className="p-5 sm:p-6">
          <form onSubmit={generateReport} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Report name</span>
                <input value={reportName} onChange={(event) => setReportName(event.target.value)} maxLength={120} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="e.g. Q4 Mentorship Summary" />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Description</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="What is this report for? (optional)" />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Cohort scope</span>
                <select value={cohortScope} onChange={(event) => setCohortScope(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                  <option value="all">All cohorts</option>
                  <option value="one">One cohort</option>
                </select>
              </label>
              {cohortScope === 'one' && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Select cohort</span>
                  <select value={selectedCohortId} onChange={(event) => setSelectedCohortId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                    <option value="">Choose a cohort…</option>
                    {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
                  </select>
                </label>
              )}
            </div>

            <fieldset>
              <legend className="text-sm font-bold text-slate-700 mb-2">Choose report details</legend>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {REPORT_SECTIONS.map((section) => (
                  <label key={section.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${selectedSections.includes(section.id) ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={selectedSections.includes(section.id)} onChange={() => handleSectionChange(section.id)} className="mt-0.5 accent-emerald-600" />
                    <span><span className="block text-sm font-semibold text-slate-800">{section.label}</span><span className="block text-xs text-slate-500 mt-0.5">{section.description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">{cohortsLoading ? 'Loading cohorts…' : `${reportCohorts.length} cohort${reportCohorts.length === 1 ? '' : 's'} selected`}</p>
              <button type="submit" disabled={isGenerating || cohortsLoading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
                {isGenerating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : report ? <RefreshCw className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                {isGenerating ? 'Generating…' : report ? 'Regenerate report' : 'Generate report'}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      {report && (
        <article className="report-preview space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8">
          <header className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2"><BarChart3 className="w-4 h-4" /> Cohort Manager Report</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{report.name}</h2>
              {report.description && <p className="mt-2 text-sm text-slate-600">{report.description}</p>}
            </div>
            <p className="text-xs text-slate-500 shrink-0">Generated {report.generatedAt.toLocaleString()}</p>
          </header>

          {sectionEnabled('overview') && (
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Program overview</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ['Cohorts', report.data.totals.cohortCount],
                  ['Mentors', report.data.totals.mentorCount],
                  ['Trainees', report.data.totals.traineeCount],
                  ['Active trainees', report.data.totals.activeTrainees],
                  ['Dropped out', report.data.totals.droppedOutTrainees],
                  ['Assigned trainees', report.data.totals.assignedTrainees],
                  ['Training groups', report.data.totals.batchCount],
                  ['Sessions', report.data.totals.sessionCount],
                  ['Average progress', `${number(report.data.totals.averageProgress, 1)}%`],
                  ['Attendance rate', `${number(report.data.totals.attendanceRate, 1)}%`],
                  ['Present', report.data.totals.presentCount],
                  ['Absent', report.data.totals.absentCount],
                  ['Completed sessions', report.data.totals.completedSessions],
                  ['Attendance marked', report.data.totals.attendanceCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sectionEnabled('cohorts') && (
            <section className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Cohort performance</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                <HorizontalMetricChart title="Average trainee progress" rows={report.data.cohorts} valueKey="averageProgress" colorClass="bg-indigo-500" />
                <HorizontalMetricChart title="Session attendance rate" rows={report.data.cohorts} valueKey="attendanceRate" colorClass="bg-emerald-500" />
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Cohort</th><th className="p-3">Status</th><th className="p-3">Dates</th><th className="p-3">Mentors</th><th className="p-3">Active trainees</th><th className="p-3">Dropped out</th><th className="p-3">Avg progress</th><th className="p-3">Attendance</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{report.data.cohorts.map((cohort) => <tr key={cohort.id}><td className="p-3 font-semibold text-slate-800">{cohort.name}</td><td className="p-3 capitalize">{cohort.status}</td><td className="p-3">{cohort.startDate || '—'} – {cohort.endDate || '—'}</td><td className="p-3">{cohort.mentors}</td><td className="p-3">{cohort.trainees}</td><td className="p-3 font-semibold text-rose-700">{cohort.droppedOutTrainees}</td><td className="p-3">{number(cohort.averageProgress, 1)}%</td><td className="p-3">{number(cohort.attendanceRate, 1)}%</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {sectionEnabled('mentors') && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800">Mentor details</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Mentor</th><th className="p-3">Employee ID</th><th className="p-3">Department</th><th className="p-3">Cohort</th><th className="p-3">Assigned trainees</th><th className="p-3">Login</th></tr></thead><tbody className="divide-y divide-slate-100">{report.data.mentors.map((mentor) => <tr key={`${mentor.cohortId}-${mentor.id}`}><td className="p-3"><span className="block font-semibold text-slate-800">{mentor.name}</span><span className="text-xs text-slate-500">{mentor.email}</span></td><td className="p-3">{mentor.employeeId || '—'}</td><td className="p-3">{mentor.department || '—'}</td><td className="p-3">{mentor.reportCohort.name}</td><td className="p-3">{mentor.assignedTraineesCount || mentor.assignedTrainees?.length || 0}</td><td className="p-3">{mentor.isLoginActive ? 'Active' : 'Not activated'}</td></tr>)}</tbody></table>
              </div>
            </section>
          )}

          {sectionEnabled('trainees') && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800">Trainee details</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Trainee</th><th className="p-3">Employee ID</th><th className="p-3">Department</th><th className="p-3">Location</th><th className="p-3">Mentor</th><th className="p-3">Cohort</th><th className="p-3">Progress</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{report.data.trainees.map((trainee) => <tr key={`${trainee.cohortId}-${trainee.id}`}><td className="p-3"><span className="block font-semibold text-slate-800">{trainee.name}</span><span className="text-xs text-slate-500">{trainee.email}</span></td><td className="p-3">{trainee.employeeId || '—'}</td><td className="p-3">{trainee.department || '—'}</td><td className="p-3">{trainee.location || '—'}</td><td className="p-3">{trainee.mentorName || 'Unassigned'}</td><td className="p-3">{trainee.reportCohort.name}</td><td className="p-3">{number(trainee.percentComplete, 1)}%</td><td className={`p-3 font-semibold ${trainee.status === 'dropped_out' ? 'text-rose-700' : 'text-slate-600'}`}>{trainee.status === 'dropped_out' ? <><span className="block">Dropped Out</span><span className="block text-xs font-normal">{trainee.droppedOutAt ? new Date(trainee.droppedOutAt).toLocaleDateString() : ''}{trainee.dropoutReason ? ` · ${trainee.dropoutReason}` : ''}</span></> : 'Active'}</td></tr>)}</tbody></table>
              </div>
            </section>
          )}

          {sectionEnabled('batches') && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800">Training groups and progress</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Group</th><th className="p-3">Cohort</th><th className="p-3">Mentor</th><th className="p-3">Active trainees</th><th className="p-3">Dropped out</th><th className="p-3">Avg progress</th><th className="p-3">Completed</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{report.data.batches.map((batch) => <tr key={batch.id}><td className="p-3 font-semibold text-slate-800">{batch.name}</td><td className="p-3">{batch.reportCohort.name}</td><td className="p-3">{batch.mentorName}</td><td className="p-3">{batch.analytics?.totalTrainees ?? batch.traineeCount}</td><td className="p-3 font-semibold text-rose-700">{batch.analytics?.droppedOutTrainees ?? batch.trainees.filter((trainee) => trainee.status === 'dropped_out').length}</td><td className="p-3">{number(batch.analytics?.averageProgress, 1)}%</td><td className="p-3">{batch.analytics?.completedTrainees ?? '—'}</td><td className="p-3 capitalize">{batch.status}</td></tr>)}</tbody></table>
              </div>
            </section>
          )}

          {sectionEnabled('sessions') && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800">Sessions and attendance</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Session</th><th className="p-3">Date / Time</th><th className="p-3">Group</th><th className="p-3">Mentor</th><th className="p-3">Status</th><th className="p-3">Present</th><th className="p-3">Absent</th><th className="p-3">Roster</th></tr></thead><tbody className="divide-y divide-slate-100">{report.data.sessions.map((session) => <tr key={session.id}><td className="p-3 font-semibold text-slate-800">{session.title}</td><td className="p-3">{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : '—'}<span className="block text-xs text-slate-500">{session.startTime}–{session.endTime}</span></td><td className="p-3">{session.batchName}</td><td className="p-3">{session.mentorName}</td><td className="p-3 capitalize">{session.status?.replace('_', ' ')}</td><td className="p-3 text-emerald-700 font-semibold">{session.attendance.filter((entry) => entry.status === 'present').length}</td><td className="p-3 text-rose-700 font-semibold">{session.attendance.filter((entry) => entry.status === 'absent').length}</td><td className="p-3">{session.attendance.length}</td></tr>)}</tbody></table>
              </div>
              {report.data.sessions.length > 0 && (
                <div className="space-y-2 pt-2">
                  {report.data.sessions.map((session) => (
                    <details key={`${session.id}-attendance`} className="rounded-xl border border-slate-200 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">{session.title} · {session.batchName} — view trainee attendance</summary>
                      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {session.attendance.map((record) => <div key={record.traineeId} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-700">{record.name}{record.location ? ` · ${record.location}` : ''}{record.traineeStatus === 'dropped_out' ? ' · Dropped out' : ''}</span><span className={`font-bold capitalize ${record.status === 'present' ? 'text-emerald-700' : record.status === 'absent' ? 'text-rose-700' : 'text-slate-400'}`}>{record.status.replace('_', ' ')}</span></div>)}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          )}

          <footer className="border-t border-slate-200 pt-4 text-xs text-slate-400">Cohort Manager · Report generated {report.generatedAt.toLocaleString()}</footer>
        </article>
      )}
    </main>
  );
}
