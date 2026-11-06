from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class TraineeInMentor(BaseModel):
    id: str
    name: str
    email: EmailStr
    employeeId: Optional[str] = ""
    department: Optional[str] = ""
    percentComplete: Optional[float] = 0.0
    status: Optional[str] = None
    location: Optional[str] = None
    droppedOutAt: Optional[datetime] = None
    dropoutReason: Optional[str] = None

class MentorNomineeCreate(BaseModel):
    name: str
    email: EmailStr
    department: str
    employeeId: Optional[str] = ""
    location: Optional[str] = None  # NEW: Geographic location
    timezone: Optional[str] = None  # NEW: Timezone
    experience: Optional[str] = None  # NEW: Years of experience
    skills: Optional[List[str]] = []  # NEW: Technical skills

class MentorNomineeResponse(BaseModel):
    id: str
    cohortId: str
    nominatedBy: Optional[str] = "admin"
    nominatorName: Optional[str] = "Admin"
    name: str
    email: EmailStr
    department: str
    employeeId: Optional[str] = ""
    location: Optional[str] = None  # NEW
    timezone: Optional[str] = None  # NEW
    experience: Optional[str] = None  # NEW
    skills: Optional[List[str]] = []  # NEW
    userId: Optional[str] = None
    isLoginActive: bool = False
    isAccountActive: bool = False
    status: Optional[str] = "pending"  # NEW: pending, approved, rejected
    assignedTraineesCount: Optional[int] = 0
    assignedTrainees: Optional[List[TraineeInMentor]] = []
    createdAt: datetime

class TraineeNomineeCreate(BaseModel):
    name: str
    email: EmailStr
    employeeId: str
    department: str
    location: Optional[str] = None  # NEW: Geographic location
    timezone: Optional[str] = None  # NEW: Timezone
    experience: Optional[str] = None  # NEW: Background/experience
    skills: Optional[List[str]] = []  # NEW: Technical skills

class TraineeNomineeResponse(BaseModel):
    id: str
    cohortId: str
    nominatedBy: Optional[str] = "admin"
    nominatorName: Optional[str] = "Admin"
    name: str
    email: EmailStr
    employeeId: str
    department: str
    location: Optional[str] = None  # NEW
    timezone: Optional[str] = None  # NEW
    experience: Optional[str] = None  # NEW
    skills: Optional[List[str]] = []  # NEW
    status: Optional[str] = "pending"  # NEW: pending, approved, rejected
    droppedOutAt: Optional[datetime] = None
    droppedOutBy: Optional[str] = None
    dropoutReason: Optional[str] = None
    mentorId: Optional[str] = None
    mentorName: Optional[str] = None
    percentComplete: Optional[float] = 0.0
    createdAt: datetime

class MentorAssignmentRequest(BaseModel):
    mentorId: str
