from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class FeedbackSubmitRequest(BaseModel):
    weekNumber: int
    answers: Dict[str, Any]

class FeedbackResponseModel(BaseModel):
    id: str
    cohortId: str
    traineeId: str
    mentorId: str
    formId: str
    weekNumber: int
    answers: Dict[str, Any]
    submittedAt: datetime
