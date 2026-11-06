"""
Schemas for session management and attendance tracking
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SessionStatus(str, Enum):
    """Session status enumeration"""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AttendanceStatus(str, Enum):
    """Attendance status enumeration"""
    PRESENT = "present"
    ABSENT = "absent"
    EXCUSED = "excused"  # Absent but with valid reason
    LATE = "late"


class SessionCreate(BaseModel):
    """Create a new training session"""
    batchId: str  # Which batch this session is for
    sessionDate: datetime  # Date and time of session
    startTime: str  # HH:MM format, e.g., "14:00"
    endTime: str  # HH:MM format, e.g., "15:30"
    title: str  # Session title/topic
    description: Optional[str] = None  # Detailed description
    format: Optional[str] = None  # "online", "in-person", "hybrid"
    location: Optional[str] = None  # Physical location if in-person
    meetingLink: Optional[str] = None  # Video conferencing URL if online
    maxAttendees: Optional[int] = None  # Capacity limit


class SessionUpdate(BaseModel):
    """Update session details"""
    sessionDate: Optional[datetime] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    format: Optional[str] = None
    location: Optional[str] = None
    meetingLink: Optional[str] = None
    status: Optional[SessionStatus] = None


class AttendanceRecord(BaseModel):
    """Individual trainee attendance"""
    traineeId: str
    name: str
    email: EmailStr
    status: AttendanceStatus
    markedAt: datetime
    markedBy: str  # User ID who marked attendance


class SessionRosterTrainee(BaseModel):
    """Trainee snapshot attached to a session when it is scheduled."""
    traineeId: str
    name: str
    email: EmailStr
    location: Optional[str] = None
    status: Optional[str] = None
    droppedOutAt: Optional[datetime] = None
    dropoutReason: Optional[str] = None


class SessionResponse(BaseModel):
    """Full session information"""
    id: str
    batchId: str
    batchName: Optional[str] = None
    mentorId: str
    mentorName: Optional[str] = None
    sessionDate: datetime
    startTime: str
    endTime: str
    title: str
    description: Optional[str] = None
    format: Optional[str] = None
    location: Optional[str] = None
    meetingLink: Optional[str] = None
    maxAttendees: Optional[int] = None
    status: SessionStatus
    roster: Optional[List[SessionRosterTrainee]] = []
    attendance: Optional[List[AttendanceRecord]] = []
    attendanceCount: int = 0
    presentCount: int = 0
    absentCount: int = 0
    excusedCount: int = 0
    lateCount: int = 0
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class SessionListItem(BaseModel):
    """Session info for list view"""
    id: str
    batchId: str
    batchName: str
    title: str
    sessionDate: datetime
    startTime: str
    endTime: str
    format: Optional[str] = None
    location: Optional[str] = None
    meetingLink: Optional[str] = None
    status: SessionStatus
    attendanceCount: int
    presentCount: int
    totalTrainees: int
    createdAt: datetime


class MarkAttendanceRequest(BaseModel):
    """Request to mark attendance for session"""
    attendanceRecords: List[dict]  # [{"traineeId": "...", "status": "present"}, ...]


class AttendanceReportItem(BaseModel):
    """Item for attendance report"""
    traineeId: str
    traineeName: str
    traineeEmail: EmailStr
    sessionsAttended: int
    sessionsAbsent: int
    sessionsExcused: int
    sessionsLate: int
    totalSessions: int
    attendanceRate: float  # Percentage


class SessionAnalytics(BaseModel):
    """Analytics for a session or batch"""
    sessionId: Optional[str] = None
    batchId: str
    batchName: str
    totalSessions: int
    completedSessions: int
    upcomingSessions: int
    totalTraineesRegistered: int
    averageAttendance: float  # Percentage
    highestAttendance: int
    lowestAttendance: int
    presentCount: int
    absentCount: int
    excusedCount: int
    lateCount: int


class SessionFilter(BaseModel):
    """Filtering options for sessions"""
    batchId: Optional[str] = None
    status: Optional[SessionStatus] = None
    fromDate: Optional[datetime] = None
    toDate: Optional[datetime] = None
    format: Optional[str] = None
