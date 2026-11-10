from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
from app.schemas.templates import (
    WeekBase, FeedbackField, TrainingTemplateCreate, FeedbackTemplateCreate,
    TalentNextCourseAssignment,
)


class CohortStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class CohortBase(BaseModel):
    name: str
    description: Optional[str] = ""
    startDate: str
    endDate: str
    nominatorIds: List[str] = []
    talentnextCourses: List[TalentNextCourseAssignment] = []

class CohortCreate(CohortBase):
    trainingTemplateId: Optional[str] = None
    feedbackTemplateId: Optional[str] = None
    totalWeeks: Optional[int] = None
    customTrainingPlan: Optional[TrainingTemplateCreate] = None
    customFeedbackForm: Optional[FeedbackTemplateCreate] = None

class CohortUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    nominatorIds: Optional[List[str]] = None
    talentnextCourses: Optional[List[TalentNextCourseAssignment]] = None
    totalWeeks: Optional[int] = None

class CohortStatusUpdate(BaseModel):
    status: CohortStatus

class CohortConfigureRequest(BaseModel):
    trainingTemplateId: str
    feedbackTemplateId: str
    force: Optional[bool] = False

class ExtendTimelineRequest(BaseModel):
    newEndDate: Optional[str] = None
    additionalWeeks: Optional[int] = 1
    newWeeks: Optional[List[WeekBase]] = None

class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    totalWeeks: Optional[int] = None
    weeks: List[WeekBase]

class UpdateFeedbackFormRequest(BaseModel):
    name: Optional[str] = None
    fields: List[FeedbackField]

class CohortResponse(CohortBase):
    id: str
    status: CohortStatus
    trainingPlanId: Optional[str] = None
    feedbackFormId: Optional[str] = None
    talentnextCourses: List[TalentNextCourseAssignment] = []
    createdBy: str
    createdAt: datetime
    # Extra aggregated counts for rich cards
    mentorCount: Optional[int] = 0
    traineeCount: Optional[int] = 0
    assignedTraineeCount: Optional[int] = 0
    activeTraineeCount: Optional[int] = 0
    droppedOutTraineeCount: Optional[int] = 0
    avgProgress: Optional[float] = 0.0

