from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class TalentNextCourseBase(BaseModel):
    name: str


class TalentNextCourseCreate(TalentNextCourseBase):
    pass


class TalentNextCourseUpdate(BaseModel):
    name: Optional[str] = None


class TalentNextCourseResponse(TalentNextCourseBase):
    id: str
    createdAt: datetime

    class Config:
        from_attributes = True
