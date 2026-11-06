from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_admin
from app.services.assignment_service import AssignmentService
from app.schemas.nominees import MentorAssignmentRequest, TraineeNomineeResponse

router = APIRouter(tags=["Assignments"])

@router.get("/cohorts/{cohort_id}/unassigned-trainees", response_model=List[TraineeNomineeResponse])
async def get_unassigned_trainees(
    cohort_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await AssignmentService.get_unassigned_trainees(db, cohort_id)

@router.put("/trainees/{trainee_id}/mentor", response_model=TraineeNomineeResponse)
async def assign_mentor(
    trainee_id: str,
    data: MentorAssignmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await AssignmentService.assign_mentor(db, trainee_id, data.mentorId)
