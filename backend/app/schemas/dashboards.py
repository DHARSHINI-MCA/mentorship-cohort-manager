from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from app.schemas.cohorts import CohortResponse
from app.schemas.nominees import TraineeNomineeResponse


class AdminDashboardStats(BaseModel):
    totalCohorts: int
    activeCohorts: int
    totalMentors: int
    activeMentorLogins: int
    totalTrainees: int
    activeTrainees: int = 0
    droppedOutTrainees: int = 0
    assignedTrainees: int
    avgProgress: float
    recentCohorts: List[CohortResponse]


class MentorTraineeSummary(BaseModel):
    traineeId: str
    name: str
    email: str
    department: str
    employeeId: str
    location: Optional[str] = ""
    timezone: Optional[str] = ""
    cohortId: str
    cohortName: str
    percentComplete: float
    status: Optional[str] = None
    lastFeedbackDate: Optional[datetime] = None
    lastFeedbackWeek: Optional[int] = None
    feedbackCount: Optional[int] = 0
    totalWeeks: Optional[int] = 4


class MentorDashboardStats(BaseModel):
    mentorName: str
    totalTrainees: int
    activeTrainees: int = 0
    droppedOutTrainees: int = 0
    avgProgress: float
    trainees: List[MentorTraineeSummary]


# ============================================================================
# NEW ANALYTICS SCHEMAS (Task #6)
# ============================================================================

class AttendanceStatusEnum(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    EXCUSED = "excused"
    LATE = "late"


class AttendanceMetrics(BaseModel):
    """Attendance statistics for a specific cohort or time period"""
    totalSessions: int
    totalAttendances: int
    presentCount: int
    absentCount: int
    excusedCount: int
    lateCount: int
    attendanceRate: float  # percentage 0-100
    presentRate: float
    absentRate: float
    excusedRate: float
    lateRate: float


class BatchCompletionAnalytics(BaseModel):
    """Analytics on batch completion and progress"""
    batchId: str
    batchName: str
    mentorId: str
    mentorName: str
    cohortId: str
    cohortName: str
    totalTrainees: int
    completedTrainees: int
    completionRate: float  # percentage 0-100
    avgProgress: float
    status: str
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None


class UserActivityRecord(BaseModel):
    """Individual user activity record"""
    userId: str
    userName: str
    userRole: str  # admin, mentor, trainee, nominator
    action: str  # login, create_batch, mark_attendance, etc.
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None


class UserActivityAnalytics(BaseModel):
    """User activity tracking and engagement metrics"""
    period: str  # "today", "week", "month"
    activeUsers: int
    activeAdmins: int
    activeMentors: int
    activeTrainees: int
    totalActions: int
    topActions: Dict[str, int]  # action -> count
    recentActivities: List[UserActivityRecord]


class CohortPerformanceMetric(BaseModel):
    """Performance metrics for a single cohort"""
    cohortId: str
    cohortName: str
    totalMentors: int
    totalTrainees: int
    droppedOutTrainees: int = 0
    avgProgress: float
    completionRate: float  # percentage of completed trainees
    attendanceRate: float
    activeMentors: int
    activeBatches: int
    activeSessions: int
    status: str


class CohortPerformanceAnalytics(BaseModel):
    """Comparative cohort performance dashboard"""
    period: str
    totalCohorts: int
    activeCohorts: int
    cohorts: List[CohortPerformanceMetric]
    bestPerformingCohort: Optional[CohortPerformanceMetric] = None
    lowestPerformingCohort: Optional[CohortPerformanceMetric] = None
    avgCohortProgress: float
    avgAttendanceRate: float


class AttendanceTrendPoint(BaseModel):
    """Single data point in attendance trend"""
    date: str  # ISO format YYYY-MM-DD
    sessionCount: int
    attendanceCount: int
    attendanceRate: float
    presentCount: int
    absentCount: int
    excusedCount: int
    lateCount: int


class AttendanceTrendAnalytics(BaseModel):
    """Attendance trends over time"""
    period: str  # "week", "month", "quarter", "year"
    startDate: datetime
    endDate: datetime
    trendPoints: List[AttendanceTrendPoint]
    avgAttendanceRate: float
    highestRate: float
    lowestRate: float
    trend: str  # "improving", "declining", "stable"


class HeatmapDataPoint(BaseModel):
    """Single heatmap data point for attendance patterns"""
    cohortId: str
    cohortName: str
    mentorId: str
    mentorName: str
    dayOfWeek: str  # Monday-Sunday
    timeSlot: str  # e.g., "09:00-10:00", "10:00-11:00"
    sessionCount: int
    attendanceRate: float
    avgTraineeCount: int


class AttendanceHeatmapAnalytics(BaseModel):
    """Heatmap of attendance patterns by day/time"""
    cohortId: Optional[str] = None
    cohortName: Optional[str] = None
    heatmapData: List[HeatmapDataPoint]
    totalSessions: int
    avgSessionAttendance: float


class BatchAnalyticsDetail(BaseModel):
    """Detailed batch analytics for a specific batch"""
    batchId: str
    batchName: str
    mentorId: str
    mentorName: str
    cohortId: str
    cohortName: str
    totalTrainees: int
    droppedOutTrainees: int = 0
    trainees: List[Dict[str, Any]]  # trainee details with progress
    totalSessions: int
    completedSessions: int
    upcomingSessions: int
    avgSessionAttendance: float
    attendanceRate: float
    avgProgress: float
    createdAt: datetime
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    status: str


class AdminDashboardFull(BaseModel):
    """Complete admin dashboard with all analytics"""
    systemStats: AdminDashboardStats
    attendanceMetrics: AttendanceMetrics
    cohortPerformance: CohortPerformanceAnalytics
    batchCompletionTop5: List[BatchCompletionAnalytics]
    userActivity: UserActivityAnalytics
    attendanceTrend: AttendanceTrendAnalytics
    generatedAt: datetime


class ExportRequest(BaseModel):
    """Request for exporting dashboard data"""
    format: str  # "csv" or "pdf"
    reportType: str  # "summary", "detailed", "cohorts", "batches", "attendance"
    cohortId: Optional[str] = None
    dateFrom: Optional[datetime] = None
    dateTo: Optional[datetime] = None
    includeCharts: bool = False


class ExportResponse(BaseModel):
    """Response for export request"""
    fileName: str
    fileType: str
    fileSize: int
    generatedAt: datetime
    expiresAt: datetime
