import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { 
  Layers, Users, Award, TrendingUp, PlusCircle, ArrowRight, 
  Calendar, CheckCircle, ChevronRight, UserCheck, BarChart3, Activity,
  Download, Filter, Clock, Target, Zap, AlertCircle
} from 'lucide-react';
import '../../styles/AdminDashboard.css';

// Simple Line Chart Component
function LineChart({ data, title, height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value || 0));
  const minValue = Math.min(...data.map(d => d.value || 0));
  const range = maxValue - minValue || 1;
  
  const pointsPerItem = (width) => width / (data.length - 1 || 1);
  const width = 600;
  const padding = 40;
  const chartWidth = width - padding * 2;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = height - padding - ((d.value - minValue) / range) * (height - padding * 2);
    return { x, y, ...d };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={`grid-${ratio}`}
            x1={padding}
            y1={height - padding - ratio * (height - padding * 2)}
            x2={width - padding}
            y2={height - padding - ratio * (height - padding * 2)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        {/* Line */}
        <path d={pathD} stroke="#10b981" strokeWidth="2" fill="none" />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
        ))}
      </svg>
    </div>
  );
}

// Simple Bar Chart Component
function BarChart({ data, title, height = 250 }) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value || 0));
  const barWidth = 30;
  const spacing = 50;
  const width = data.length * spacing + 40;
  const padding = 30;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <text
            key={`label-${ratio}`}
            x={15}
            y={height - padding - ratio * (height - padding * 2) + 3}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="end"
          >
            {Math.round(maxValue * ratio)}
          </text>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (height - padding * 2);
          const x = 30 + i * spacing;
          const y = height - padding - barHeight;
          return (
            <g key={`bar-${i}`}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#3b82f6" rx="4" />
              <text
                x={x + barWidth / 2}
                y={height - 10}
                fontSize="11"
                fill="#475569"
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [period, setPeriod] = useState('month');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportType, setExportType] = useState('summary');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch cohorts for filter dropdown
  const { data: allCohorts } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => {
      const res = await api.get('/cohorts');
      return res.data.items || [];
    },
  });

  // Build query params
  const getQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedCohort) params.append('cohort_id', selectedCohort);
    if (period) params.append('period', period);
    return params.toString();
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data;
    },
  });

  const { data: fullDashboard, isLoading: fullLoading } = useQuery({
    queryKey: ['adminDashboardFull', selectedCohort, period],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard-full');
      return res.data;
    },
  });

  const { data: attendanceMetrics, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendanceMetrics', selectedCohort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCohort) params.append('cohort_id', selectedCohort);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      const query = params.toString();
      const res = await api.get(`/admin/attendance-metrics${query ? '?' + query : ''}`);
      return res.data;
    },
  });

  const { data: cohortPerformance, refetch: refetchCohorts } = useQuery({
    queryKey: ['cohortPerformance', period],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      const query = params.toString();
      const res = await api.get(`/admin/cohort-performance${query ? '?' + query : ''}`);
      return res.data;
    },
  });

  const { data: attendanceTrend, refetch: refetchTrend } = useQuery({
    queryKey: ['attendanceTrend', period, selectedCohort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (selectedCohort) params.append('cohort_id', selectedCohort);
      const query = params.toString();
      const res = await api.get(`/admin/attendance-trend${query ? '?' + query : ''}`);
      return res.data;
    },
  });

  // Handle filter changes
  const handleFilterChange = async () => {
    await Promise.all([
      refetchAttendance(),
      refetchCohorts(),
      refetchTrend()
    ]);
  };

  // Handle export
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await api.post('/admin/export-report', {
        format: exportFormat,
        reportType: exportType,
        cohortId: selectedCohort,
        dateFrom: dateFrom,
        dateTo: dateTo,
        includeCharts: true
      });

      if (response.data?.content) {
        // Create blob and download
        const blob = new Blob([response.data.content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.fileName;
        link.click();
        window.URL.revokeObjectURL(url);
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };


  if (statsLoading || fullLoading) {
    return (
      <div className="px-4 py-6">
        <div className="h-4 bg-slate-200 rounded w-40 animate-pulse mb-4" />
        <div className="h-8 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  const recentCohort = [...(allCohorts || [])].sort((a, b) =>
    new Date(b.createdAt || b.startDate || 0) - new Date(a.createdAt || a.startDate || 0)
  )[0];

  // Prepare chart data
  const trendData = attendanceTrend?.trendPoints?.slice(-7).map(point => ({
    label: point.date?.split('-').slice(1).join('-'),
    value: point.attendanceRate
  })) || [];

  const cohortPerfData = cohortPerformance?.cohorts?.slice(0, 5).map(c => ({
    label: c.cohortName?.substring(0, 10),
    value: c.avgProgress
  })) || [];

  const attendanceBreakdown = attendanceMetrics ? [
    { label: 'Present', value: attendanceMetrics.presentRate, color: '#10b981' },
    { label: 'Absent', value: attendanceMetrics.absentRate, color: '#ef4444' },
    { label: 'Excused', value: attendanceMetrics.excusedRate, color: '#f59e0b' },
    { label: 'Late', value: attendanceMetrics.lateRate, color: '#8b5cf6' }
  ] : [];

  return (
    <>
    <div className="admin-dashboard px-4 py-4 max-w-screen-xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Admin Analytics Dashboard</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Real-time mentorship analytics, cohort performance, and engagement metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 hover:border-slate-300"
          >
            <Filter className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline px-2 py-1"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="flex gap-8 py-3 border-b border-slate-200 text-sm flex-wrap">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Cohorts</span>
          <span className="font-bold text-slate-800">{stats?.totalCohorts || 0}</span>
          <span className="text-[11px] text-emerald-600 ml-1">{stats?.activeCohorts || 0} active</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Mentors</span>
          <span className="font-bold text-slate-800">{stats?.totalMentors || 0}</span>
          <span className="text-[11px] text-blue-600 ml-1">{stats?.activeMentorLogins || 0} active</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Trainees</span>
          <span className="font-bold text-slate-800">{stats?.activeTrainees ?? stats?.totalTrainees ?? 0}</span>
          <span className="text-[11px] text-slate-400 ml-1">{stats?.droppedOutTrainees || 0} dropped · {stats?.assignedTrainees || 0} assigned</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Avg Progress</span>
          <span className="font-bold text-slate-800">{stats?.avgProgress || 0}%</span>
        </div>
        {recentCohort && (
          <div className="ml-auto">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Recent Cohort</span>
            <Link to={`/admin/cohorts/${recentCohort.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
              {recentCohort.name} →
            </Link>
          </div>
        )}
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="border-b border-slate-200 py-3 bg-slate-50 px-3 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Cohort</label>
            <select
              value={selectedCohort || ''}
              onChange={(e) => { setSelectedCohort(e.target.value || null); }}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Cohorts</option>
              {allCohorts?.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">From</label>
            <input
              type="date"
              value={dateFrom || ''}
              onChange={(e) => setDateFrom(e.target.value || null)}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">To</label>
            <input
              type="date"
              value={dateTo || ''}
              onChange={(e) => setDateTo(e.target.value || null)}
              className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleFilterChange}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-all"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setSelectedCohort(null);
                setDateFrom(null);
                setDateTo(null);
                setPeriod('month');
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(selectedCohort || dateFrom || dateTo) && (
        <div className="flex flex-wrap gap-2 items-center py-2 border-b border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500">Filters:</span>
          {selectedCohort && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold flex items-center gap-1">
              {allCohorts?.find(c => c.id === selectedCohort)?.name}
              <button onClick={() => setSelectedCohort(null)} className="hover:text-emerald-600">✕</button>
            </span>
          )}
          {dateFrom && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-semibold flex items-center gap-1">
              From: {dateFrom}
              <button onClick={() => setDateFrom(null)} className="hover:text-blue-600">✕</button>
            </span>
          )}
          {dateTo && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-semibold flex items-center gap-1">
              To: {dateTo}
              <button onClick={() => setDateTo(null)} className="hover:text-blue-600">✕</button>
            </span>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-slate-200 mt-2">
        {['overview', 'attendance', 'cohorts', 'activity'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-semibold text-xs uppercase tracking-wider transition-all border-b-2 ${
              activeTab === tab
                ? 'text-emerald-600 border-emerald-600'
                : 'text-slate-400 border-transparent hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-0 mt-3">

          {/* Top Performing Cohorts */}
          <section>
            <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Performing Cohorts</span>
            </div>
            <table className="w-full text-left text-sm border-b border-slate-100">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Cohort</th>
                  <th className="px-4 py-2">Trainees</th>
                  <th className="px-4 py-2">Active Batches</th>
                  <th className="px-4 py-2">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cohortPerformance?.cohorts?.slice(0, 5).map((cohort, idx) => (
                  <tr key={cohort.cohortId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 text-slate-400 font-semibold tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">{cohort.cohortName}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.totalTrainees}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.activeBatches}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 bg-slate-200 rounded">
                          <div className="h-full bg-emerald-500 rounded" style={{ width: `${cohort.avgProgress}%` }} />
                        </div>
                        <span className="tabular-nums text-slate-700 text-xs">{cohort.avgProgress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!cohortPerformance?.cohorts || cohortPerformance.cohorts.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-4 text-xs text-slate-400">No cohort data available.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Attendance Trend */}
            <section className="border border-slate-200 rounded">
              <div className="flex items-center justify-between py-2 px-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  Attendance Trend (Last 7 Days)
                </span>
              </div>
              <div className="p-3">
                <LineChart data={trendData} height={220} />
              </div>
            </section>

            {/* Cohort Progress */}
            <section className="border border-slate-200 rounded">
              <div className="flex items-center justify-between py-2 px-3 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-blue-600" />
                  Cohort Progress
                </span>
              </div>
              <div className="p-3">
                <BarChart data={cohortPerfData} height={220} />
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ATTENDANCE TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'attendance' && (
        <div className="mt-3 space-y-4">

          {/* Attendance rate strip */}
          <div className="flex gap-8 py-3 border-b border-slate-200 text-sm flex-wrap">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Present</span>
              <span className="font-bold text-emerald-700">{attendanceMetrics?.presentRate || 0}%</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Absent</span>
              <span className="font-bold text-red-600">{attendanceMetrics?.absentRate || 0}%</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Excused</span>
              <span className="font-bold text-amber-600">{attendanceMetrics?.excusedRate || 0}%</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Late</span>
              <span className="font-bold text-purple-600">{attendanceMetrics?.lateRate || 0}%</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Sessions</span>
              <span className="font-bold text-slate-800">{attendanceMetrics?.totalSessions || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Attendances</span>
              <span className="font-bold text-slate-800">{attendanceMetrics?.totalAttendances || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Avg Rate</span>
              <span className="font-bold text-slate-800">{attendanceMetrics?.attendanceRate || 0}%</span>
            </div>
          </div>

          {/* Attendance Breakdown */}
          <section>
            <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Breakdown</span>
            </div>
            <table className="w-full text-sm border-b border-slate-100">
              <tbody className="divide-y divide-slate-100">
                {attendanceBreakdown.map((item) => (
                  <tr key={item.label} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 font-semibold text-slate-700 w-24">{item.label}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-32 bg-slate-200 rounded">
                          <div className="h-full rounded" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                        </div>
                        <span className="tabular-nums text-slate-700 text-xs font-semibold">{item.value}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          COHORTS TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'cohorts' && (
        <div className="mt-3">
          <section>
            <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">All Cohorts</span>
            </div>
            <table className="w-full text-left text-sm border-b border-slate-100">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Cohort</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Trainees</th>
                  <th className="px-4 py-2">Mentors</th>
                  <th className="px-4 py-2">Progress</th>
                  <th className="px-4 py-2">Completion</th>
                  <th className="px-4 py-2">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cohortPerformance?.cohorts?.map((cohort) => (
                  <tr key={cohort.cohortId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 font-semibold text-slate-800">{cohort.cohortName}</td>
                    <td className="px-4 py-2">
                      <span className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        cohort.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        cohort.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {cohort.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.totalTrainees}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.totalMentors}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 bg-slate-200 rounded">
                          <div className="h-full bg-emerald-500 rounded" style={{ width: `${cohort.avgProgress}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-slate-700">{cohort.avgProgress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.completionRate}%</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{cohort.attendanceRate}%</td>
                  </tr>
                ))}
                {(!cohortPerformance?.cohorts || cohortPerformance.cohorts.length === 0) && (
                  <tr><td colSpan={7} className="px-4 py-4 text-xs text-slate-400">No cohort data available.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ACTIVITY TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="mt-3 space-y-4">

          {/* Activity strip */}
          <div className="flex gap-8 py-3 border-b border-slate-200 text-sm flex-wrap">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Active Users</span>
              <span className="font-bold text-blue-700">{fullDashboard?.userActivity?.activeUsers || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Active Mentors</span>
              <span className="font-bold text-purple-700">{fullDashboard?.userActivity?.activeMentors || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Active Trainees</span>
              <span className="font-bold text-emerald-700">{fullDashboard?.userActivity?.activeTrainees || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1.5">Total Actions</span>
              <span className="font-bold text-amber-700">{fullDashboard?.userActivity?.totalActions || 0}</span>
            </div>
          </div>

          {/* Top Actions */}
          <section>
            <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Actions</span>
            </div>
            <table className="w-full text-left text-sm border-b border-slate-100">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(fullDashboard?.userActivity?.topActions || {}).map(([action, count]) => (
                  <tr key={action} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2 font-semibold text-slate-700">{action.replace(/_/g, ' ').toUpperCase()}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-800 font-bold text-right">{count}</td>
                  </tr>
                ))}
                {Object.keys(fullDashboard?.userActivity?.topActions || {}).length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-4 text-xs text-slate-400">No activity data.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>

    {/* ── Export Modal ── */}
    {showExportModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md mx-4">
          <div className="flex items-center justify-between py-3 px-4 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Export Dashboard Report</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Report Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Report Type</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="summary">Summary Report</option>
                <option value="detailed">Detailed Report</option>
                <option value="cohorts">Cohort Performance</option>
                <option value="attendance">Attendance Data</option>
                <option value="batches">Batch Completion</option>
              </select>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Format</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">CSV (Spreadsheet)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    disabled
                    className="w-4 h-4 opacity-50"
                  />
                  <span className="text-sm text-slate-500">PDF (Coming Soon)</span>
                </label>
              </div>
            </div>

            {/* Include Charts */}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="charts" defaultChecked className="w-4 h-4" />
              <label htmlFor="charts" className="text-sm text-slate-700">
                Include data visualizations
              </label>
            </div>

            {/* Info Text */}
            <p className="text-xs text-slate-500">
              Your report will include data filtered by current selections (cohort, date range, period).
            </p>
          </div>
          <div className="border-t border-slate-100 p-3 flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded transition-all"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={() => setShowExportModal(false)}
              disabled={isExporting}
              className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
