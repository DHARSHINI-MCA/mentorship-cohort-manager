import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, MapPin, Video, Users, ChevronDown } from 'lucide-react';
import api from '../../api/client';
import { Card, CardBody } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';

const statusStyles = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatDate(value) {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function SessionHistory() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [attendanceStatuses, setAttendanceStatuses] = useState({});

  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ['mentorSessionHistory'],
    queryFn: async () => {
      const response = await api.get('/sessions/?limit=100');
      return response.data || [];
    },
  });

  const { data: sessionDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['mentorSessionHistoryDetails', expandedSessionId],
    queryFn: async () => {
      const response = await api.get(`/sessions/${expandedSessionId}`);
      return response.data;
    },
    enabled: !!expandedSessionId,
  });

  useEffect(() => {
    if (!sessionDetails?.roster) return;
    const existingStatuses = Object.fromEntries(
      (sessionDetails.attendance || []).map((record) => [
        record.traineeId,
        record.status === 'present' ? 'present' : 'absent',
      ])
    );
    setAttendanceStatuses(Object.fromEntries(
      sessionDetails.roster.map((trainee) => [trainee.traineeId, existingStatuses[trainee.traineeId] || ''])
    ));
  }, [sessionDetails]);

  const attendanceMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${expandedSessionId}/attendance`, {
      attendanceRecords: (sessionDetails?.roster || []).map((trainee) => ({
        traineeId: trainee.traineeId,
        status: attendanceStatuses[trainee.traineeId],
      })),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mentorSessionHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['mentorSessionHistoryDetails', expandedSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['batchSessions'] }),
      ]);
      showToast('Attendance saved', 'success');
    },
    onError: (error) => showToast(error.response?.data?.detail || 'Could not save attendance', 'error'),
  });

  const filteredSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));
    return statusFilter === 'all' ? sorted : sorted.filter((session) => session.status === statusFilter);
  }, [sessions, statusFilter]);

  const scheduledCount = sessions.filter((session) => session.status === 'scheduled').length;
  const completedCount = sessions.filter((session) => session.status === 'completed').length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Session History</h1>
          <p className="text-slate-500 mt-2">Review scheduled and completed sessions across your batches.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5 min-w-28">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Scheduled</p>
            <p className="text-xl font-bold text-blue-700">{scheduledCount}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-2.5 min-w-28">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Completed</p>
            <p className="text-xl font-bold text-emerald-700">{completedCount}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-bold text-slate-800">Your sessions <span className="text-sm font-medium text-slate-400">({filteredSessions.length})</span></h2>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="all">All sessions</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <Card><CardBody><p className="text-sm text-slate-500">Loading your sessions…</p></CardBody></Card>
      ) : isError ? (
        <Card><CardBody><p className="text-sm text-rose-600">Could not load session history. Please try again.</p></CardBody></Card>
      ) : filteredSessions.length === 0 ? (
        <Card><CardBody className="py-12 text-center">
          <CalendarDays className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">No sessions found</p>
          <p className="text-sm text-slate-500 mt-1">Sessions you schedule in your batches will appear here.</p>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            return (
              <Card key={session.id} onClick={() => setExpandedSessionId(session.id)} className="cursor-pointer hover:border-indigo-300">
                <CardBody className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-slate-800">{session.title}</h3>
                        <Badge className={statusStyles[session.status] || ''}>{(session.status || 'unknown').replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">{session.batchName || 'Batch'}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{formatDate(session.sessionDate)}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" />{session.startTime}–{session.endTime}</span>
                        {session.format === 'in-person' && session.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{session.location}</span>}
                        {session.format === 'online' && session.meetingLink && <a className="inline-flex items-center gap-1.5 text-blue-600 hover:underline" href={session.meetingLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Video className="w-3.5 h-3.5" />Meeting link</a>}
                        <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{session.totalTrainees} trainees · {session.presentCount} present</span>
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">Open session <ChevronDown className="w-4 h-4" /></span>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!expandedSessionId}
        onClose={() => setExpandedSessionId(null)}
        title={sessionDetails?.title ? `Session · ${sessionDetails.title}` : 'Session Attendance'}
      >
        {detailsLoading ? (
          <p className="text-sm text-slate-500">Loading the session roster…</p>
        ) : sessionDetails?.roster?.length ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{sessionDetails.batchName}</p>
              <p>{formatDate(sessionDetails.sessionDate)} · {sessionDetails.startTime}–{sessionDetails.endTime}</p>
            </div>
            <div className="space-y-2">
              {sessionDetails.roster.map((trainee) => (
                <div key={trainee.traineeId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{trainee.name}</p>
                    <p className="text-xs text-slate-500">{trainee.email}{trainee.location ? ` · ${trainee.location}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-2" role="group" aria-label={`Attendance for ${trainee.name}`}>
                    <button
                      type="button"
                      aria-pressed={attendanceStatuses[trainee.traineeId] === 'present'}
                      onClick={() => setAttendanceStatuses((current) => ({ ...current, [trainee.traineeId]: 'present' }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${attendanceStatuses[trainee.traineeId] === 'present' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                    >Present</button>
                    <button
                      type="button"
                      aria-pressed={attendanceStatuses[trainee.traineeId] === 'absent'}
                      onClick={() => setAttendanceStatuses((current) => ({ ...current, [trainee.traineeId]: 'absent' }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${attendanceStatuses[trainee.traineeId] === 'absent' ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
                    >Absent</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setExpandedSessionId(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">Close</button>
              <button
                type="button"
                disabled={attendanceMutation.isPending || sessionDetails.roster.some((trainee) => !attendanceStatuses[trainee.traineeId])}
                onClick={() => attendanceMutation.mutate()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {attendanceMutation.isPending ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Could not load this session’s trainee list.</p>
        )}
      </Modal>
    </main>
  );
}
