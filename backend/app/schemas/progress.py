from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProgressItem(BaseModel):
    weekNumber: int
    courseId: str
    completed: bool = False
    completedAt: Optional[datetime] = None
    completedBy: Optional[str] = None

class ProgressResponse(BaseModel):
    id: str
    cohortId: str
    traineeId: str
    mentorId: str
    planId: str
    items: List[ProgressItem] = []
    percentComplete: float = 0.0

class ProgressUpdateCourse(BaseModel):
    courseId: str
    completed: bool

class ProgressUpdateWeek(BaseModel):
    weekNumber: int
    completed: bool

class ProgressUpdateRequest(BaseModel):
    courseId: Optional[str] = None
    weekNumber: Optional[int] = None
    completed: bool

class TraineeDropoutRequest(BaseModel):
    reason: Optional[str] = None
