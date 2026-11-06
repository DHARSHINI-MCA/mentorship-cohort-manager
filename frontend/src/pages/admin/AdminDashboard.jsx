import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
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
      <div className="space-y-8">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse mb-6" />
        <div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const recentCohort = [...(allCohorts || [])].sort((a, b) =>
    new Date(b.createdAt || b.startDate || 0) - new Date(a.createdAt || a.startDate || 0)
  )[0];

  return (
    <div className="admin-dashboard space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your most recently created cohort</p>
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Recent Cohort</CardTitle>
        </CardHeader>
        <CardBody className="p-6">
          {recentCohort ? (
            <Link
              to={`/admin/cohorts/${recentCohort.id}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-colors"
            >
              <div>
                <h2 className="font-bold text-slate-900">{recentCohort.name}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {recentCohort.startDate || 'Start date not set'}
                  {recentCohort.endDate ? ` – ${recentCohort.endDate}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-700 capitalize">
                {recentCohort.status || 'Draft'} →
              </span>
            </Link>
          ) : (
            <p className="text-sm text-slate-500">No cohorts yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );

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
    <div className="admin-dashboard space-y-8">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Admin Analytics Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time mentorship analytics, cohort performance, and engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 transition-all"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <Card className="bg-slate-50 border-slate-200">
          <CardBody className="p-6">
            <h3 className="font-bold text-slate-800 mb-4">Filter Dashboard</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Cohort Filter */}
              <div className="filter-group">
                <label className="block text-xs font-semibold text-slate-700 mb-2">Cohort</label>
                <select
                  value={selectedCohort || ''}
                  onChange={(e) => {
                    setSelectedCohort(e.target.value || null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">All Cohorts</option>
                  {allCohorts?.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div className="filter-group">
                <label className="block text-xs font-semibold text-slate-700 mb-2">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="quarter">Last 90 Days</option>
                </select>
              </div>

              {/* Date From */}
              <div className="filter-group">
                <label className="block text-xs font-semibold text-slate-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={dateFrom || ''}
                  onChange={(e) => setDateFrom(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Date To */}
              <div className="filter-group">
                <label className="block text-xs font-semibold text-slate-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={dateTo || ''}
                  onChange={(e) => setDateTo(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleFilterChange}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setSelectedCohort(null);
                  setDateFrom(null);
                  setDateTo(null);
                  setPeriod('month');
                }}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 text-sm font-semibold rounded-lg transition-all"
              >
                Reset
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active Filters Display */}
      {(selectedCohort || dateFrom || dateTo) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-slate-600">Active Filters:</span>
          {selectedCohort && (
            <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold flex items-center gap-2">
              Cohort: {allCohorts?.find(c => c.id === selectedCohort)?.name}
              <button
                onClick={() => setSelectedCohort(null)}
                className="hover:text-emerald-600"
              >
                ✕
              </button>
            </div>
          )}
          {dateFrom && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center gap-2">
              From: {dateFrom}
              <button
                onClick={() => setDateFrom(null)}
                className="hover:text-blue-600"
              >
                ✕
              </button>
            </div>
          )}
          {dateTo && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center gap-2">
              To: {dateTo}
              <button
                onClick={() => setDateTo(null)}
                className="hover:text-blue-600"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {['overview', 'attendance', 'cohorts', 'activity'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 ${
              activeTab === tab
                ? 'text-emerald-600 border-emerald-600'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Primary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="border-emerald-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cohorts</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800">{stats?.totalCohorts || 0}</span>
                  <span className="text-xs font-semibold text-emerald-600">{stats?.activeCohorts || 0} active</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-blue-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mentors</span>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800">{stats?.totalMentors || 0}</span>
                  <span className="text-xs font-semibold text-blue-600">{stats?.activeMentorLogins || 0} active</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-purple-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Trainees</span>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800">{stats?.activeTrainees ?? stats?.totalTrainees ?? 0}</span>
                  <span className="text-xs font-semibold text-purple-600">{stats?.droppedOutTrainees || 0} dropped out · {stats?.assignedTrainees || 0} assigned</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-amber-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Completion</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-800">{stats?.avgProgress || 0}%</span>
                  <span className="text-xs font-semibold text-slate-400">overall</span>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Top Performing Cohorts */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Top Performing Cohorts</CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <div className="space-y-3">
                {cohortPerformance?.cohorts?.slice(0, 5).map((cohort, idx) => (
                  <div key={cohort.cohortId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-slate-800">{cohort.cohortName}</p>
                        <p className="text-xs text-slate-500">{cohort.totalTrainees} trainees • {cohort.activeBatches} active batches</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{cohort.avgProgress}%</p>
                      <p className="text-xs text-slate-500">progress</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Trend */}
            <Card>
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Attendance Trend (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardBody className="p-6">
                <LineChart data={trendData} height={280} />
              </CardBody>
            </Card>

            {/* Cohort Progress */}
            <Card>
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  Cohort Progress
                </CardTitle>
              </CardHeader>
              <CardBody className="p-6">
                <BarChart data={cohortPerfData} height={280} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card className="border-green-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Present</span>
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-800">{attendanceMetrics?.presentRate || 0}%</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-red-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Absent</span>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-800">{attendanceMetrics?.absentRate || 0}%</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-amber-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Excused</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-800">{attendanceMetrics?.excusedRate || 0}%</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border-purple-100">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Late</span>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-800">{attendanceMetrics?.lateRate || 0}%</span>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Attendance Breakdown */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Attendance Breakdown</CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <div className="space-y-4">
                {attendanceBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                      <span className="text-sm font-bold text-slate-800">{item.value}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${item.value}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Session Statistics</CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Total Sessions</p>
                  <p className="text-2xl font-bold text-slate-800">{attendanceMetrics?.totalSessions || 0}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Total Attendances</p>
                  <p className="text-2xl font-bold text-slate-800">{attendanceMetrics?.totalAttendances || 0}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Avg Attendance Rate</p>
                  <p className="text-2xl font-bold text-slate-800">{attendanceMetrics?.attendanceRate || 0}%</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* COHORTS TAB */}
      {activeTab === 'cohorts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohortPerformance?.cohorts?.map((cohort) => (
              <Card key={cohort.cohortId} className="hover:shadow-md transition-shadow">
                <CardBody className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-slate-800">{cohort.cohortName}</h3>
                    <Badge variant={cohort.status}>{cohort.status}</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-600">Progress</span>
                        <span className="text-xs font-bold text-slate-800">{cohort.avgProgress}%</span>
                      </div>
                      <ProgressBar percent={cohort.avgProgress} size="sm" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <p className="text-slate-400 mb-1">Trainees</p>
                        <p className="font-bold text-slate-800">{cohort.totalTrainees}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Completion</p>
                        <p className="font-bold text-slate-800">{cohort.completionRate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Mentors</p>
                        <p className="font-bold text-slate-800">{cohort.totalMentors}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Attendance</p>
                        <p className="font-bold text-slate-800">{cohort.attendanceRate}%</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>User Activity</CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-blue-900">{fullDashboard?.userActivity?.activeUsers || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 font-semibold mb-1">Active Mentors</p>
                  <p className="text-2xl font-bold text-purple-900">{fullDashboard?.userActivity?.activeMentors || 0}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-semibold mb-1">Active Trainees</p>
                  <p className="text-2xl font-bold text-green-900">{fullDashboard?.userActivity?.activeTrainees || 0}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 font-semibold mb-1">Total Actions</p>
                  <p className="text-2xl font-bold text-amber-900">{fullDashboard?.userActivity?.totalActions || 0}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Top Actions */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Top Actions</CardTitle>
            </CardHeader>
            <CardBody className="p-6">
              <div className="space-y-2">
                {Object.entries(fullDashboard?.userActivity?.topActions || {}).map(([action, count]) => (
                  <div key={action} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">{action.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="text-sm font-bold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>

    
    {showExportModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Export Dashboard Report</CardTitle>
          </CardHeader>
          <CardBody className="p-6 space-y-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
              <label className="block text-sm font-semibold text-slate-700 mb-2">Format</label>
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
          </CardBody>
          <div className="border-t border-slate-100 p-4 flex gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={() => setShowExportModal(false)}
              disabled={isExporting}
              className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </Card>
      </div>
    )}
    </>
  );
}
