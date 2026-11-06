from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

# Training
class CourseBase(BaseModel):
    courseId: Optional[str] = None
    title: str
    description: Optional[str] = ""
    durationHrs: float = 1.0

class CourseInPlan(CourseBase):
    courseId: Optional[str] = None

class WeekBase(BaseModel):
    weekNumber: int
    title: str
    isBuffer: Optional[bool] = False
    courses: List[CourseBase] = []

class WeekInPlan(BaseModel):
    weekNumber: int
    title: str
    isBuffer: Optional[bool] = False
    courses: List[CourseInPlan] = []

class TrainingTemplateCreate(BaseModel):
    name: str
    totalWeeks: int
    weeks: List[WeekBase] = []

class TrainingTemplateResponse(TrainingTemplateCreate):
    id: str
    createdAt: datetime

class CohortTrainingPlanResponse(BaseModel):
    id: str
    cohortId: str
    name: str
    totalWeeks: int
    coreWeeks: Optional[int] = None
    bufferWeeks: Optional[int] = None
    weeks: List[WeekInPlan] = []
    createdAt: datetime

# Feedback
class FieldType(str, Enum):
    RATING = "rating"
    TEXT = "text"
    SELECT = "select"

class FeedbackField(BaseModel):
    key: str
    label: str
    type: FieldType
    options: List[str] = []
    required: bool = True

class FeedbackTemplateCreate(BaseModel):
    name: str
    fields: List[FeedbackField] = []

class FeedbackTemplateResponse(FeedbackTemplateCreate):
    id: str
    createdAt: datetime

class CohortFeedbackFormResponse(BaseModel):
    id: str
    cohortId: str
    name: str
    fields: List[FeedbackField] = []
    createdAt: datetime
