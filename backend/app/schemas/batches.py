"""
Schemas for batch management and grouping
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BatchStatus(str, Enum):
    """Batch status enumeration"""
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ARCHIVED = "archived"


class TraineeInBatch(BaseModel):
    """Trainee information within a batch"""
    traineeId: str
    name: str
    email: EmailStr
    employeeId: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = None
    percentComplete: Optional[float] = 0.0
    status: Optional[str] = None
    droppedOutAt: Optional[datetime] = None
    dropoutReason: Optional[str] = None


class BatchCreate(BaseModel):
    """Create a new batch"""
    name: str  # Batch name, e.g., "Cohort 2024 Q1 - Engineering Track"
    description: Optional[str] = None
    cohortId: str  # Which cohort this batch belongs to
    timezone: Optional[str] = None  # Primary timezone for batch sessions
    trainingLevel: Optional[str] = None  # e.g., "beginner", "intermediate", "advanced"
    maxTrainees: Optional[int] = None  # Maximum number of trainees allowed
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    traineeIds: List[str] = Field(default_factory=list)


class BatchUpdate(BaseModel):
    """Update batch details"""
    name: Optional[str] = None
    description: Optional[str] = None
    timezone: Optional[str] = None
    trainingLevel: Optional[str] = None
    maxTrainees: Optional[int] = None
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    status: Optional[BatchStatus] = None


class BatchAddTraineesRequest(BaseModel):
    """Request to add trainees to a batch"""
    traineeIds: List[str]  # IDs of trainees to add


class BatchRemoveTraineesRequest(BaseModel):
    """Request to remove trainees from a batch"""
    traineeIds: List[str]


class BatchResponse(BaseModel):
    """Full batch information"""
    id: str
    mentorId: str
    mentorName: Optional[str] = None
    cohortId: str
    name: str
    description: Optional[str] = None
    timezone: Optional[str] = None
    trainingLevel: Optional[str] = None
    maxTrainees: Optional[int] = None
    traineeCount: int = 0
    trainees: Optional[List[TraineeInBatch]] = []
    status: BatchStatus = BatchStatus.DRAFT
    progress: Optional[float] = 0.0  # Average progress of trainees
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class BatchListItem(BaseModel):
    """Batch info for list view"""
    id: str
    name: str
    cohortId: str
    timezone: Optional[str] = None
    trainingLevel: Optional[str] = None
    traineeCount: int
    maxTrainees: Optional[int] = None
    status: BatchStatus
    progress: float
    startDate: Optional[datetime] = None
    endDate: Optional[datetime] = None
    createdAt: datetime


class BatchTraineeMapping(BaseModel):
    """Mapping of trainee to batch for assignment"""
    traineeId: str
    batchId: str
    assignedAt: datetime
    status: str = "active"  # active, inactive


class BatchAnalytics(BaseModel):
    """Analytics for a batch"""
    batchId: str
    batchName: str
    totalTrainees: int
    droppedOutTrainees: int = 0
    completedTrainees: int
    averageProgress: float
    onTrackTrainees: int  # Trainees above 50% progress
    behindTrainees: int  # Trainees below 50% progress
    status: BatchStatus
    trainingLevel: Optional[str] = None
    durationDays: Optional[int] = None
