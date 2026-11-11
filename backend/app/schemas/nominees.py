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
    department: Optional[str] = ""
    employeeId: Optional[str] = ""
    location: Optional[str] = None
    timezone: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []

class CohortRef(BaseModel):
    id: str
    name: str
    status: Optional[str] = "active"

class MentorNomineeResponse(BaseModel):
    """Mentor as seen by admin / inside a cohort."""
    id: str
    cohortId: Optional[str] = None
    cohortIds: Optional[List[str]] = []
    cohortNames: Optional[List[str]] = []
    assignedCohorts: Optional[List[CohortRef]] = []
    nominatedBy: Optional[str] = "admin"
    nominatorName: Optional[str] = "Admin"
    name: str
    email: EmailStr
    department: Optional[str] = ""
    employeeId: Optional[str] = ""
    location: Optional[str] = None
    timezone: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []
    userId: Optional[str] = None
    isLoginActive: bool = False
    isAccountActive: bool = True
    isActive: bool = True
    status: Optional[str] = "pending"
    assignedTraineesCount: Optional[int] = 0
    assignedTrainees: Optional[List[TraineeInMentor]] = []
    createdAt: datetime

class MentorCohortsUpdateRequest(BaseModel):
    cohortIds: List[str]

class TraineeCohortUpdateRequest(BaseModel):
    cohortId: Optional[str] = None

class MentorAssignCohortsRequest(BaseModel):
    cohortIds: List[str]

class TraineeNomineeCreate(BaseModel):
    name: str
    email: EmailStr
    employeeId: str
    department: Optional[str] = ""
    location: Optional[str] = None
    timezone: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []

class TraineeNomineeResponse(BaseModel):
    """Trainee as seen by admin / inside a cohort."""
    id: str
    cohortId: Optional[str] = None
    nominatedBy: Optional[str] = "admin"
    nominatorName: Optional[str] = "Admin"
    name: str
    email: EmailStr
    employeeId: str
    department: Optional[str] = ""
    location: Optional[str] = None
    timezone: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []
    status: Optional[str] = "pending"
    droppedOutAt: Optional[datetime] = None
    droppedOutBy: Optional[str] = None
    dropoutReason: Optional[str] = None
    mentorId: Optional[str] = None
    mentorName: Optional[str] = None
    percentComplete: Optional[float] = 0.0
    createdAt: datetime

class MyNomineeResponse(BaseModel):
    """What a nominator sees about their own nominees. Deliberately has NO
    cohort, mentor or progress information."""
    id: str
    type: str  # "mentor" | "trainee"
    name: str
    email: EmailStr
    employeeId: Optional[str] = ""
    location: Optional[str] = None
    timezone: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = []
    createdAt: datetime

class AllocateRequest(BaseModel):
    ids: List[str]

class MentorAssignmentRequest(BaseModel):
    mentorId: str
