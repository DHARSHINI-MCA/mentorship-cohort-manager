from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_nominator, require_any_authenticated
from app.services.nomination_service import NominationService
from app.schemas.nominees import (
    MentorNomineeCreate, MentorNomineeResponse,
    TraineeNomineeCreate, TraineeNomineeResponse
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/cohorts", tags=["Nominations"])

@router.post("/{cohort_id}/mentors", response_model=MentorNomineeResponse)
async def nominate_mentor(
    cohort_id: str,
    data: MentorNomineeCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_nominator)
):
    return await NominationService.nominate_mentor(db, cohort_id, data, current_user)

@router.get("/{cohort_id}/mentors", response_model=PaginatedResponse[MentorNomineeResponse])
async def list_mentors(
    cohort_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await NominationService.get_cohort_mentors(db, cohort_id, current_user, page, limit)

@router.post("/{cohort_id}/trainees", response_model=TraineeNomineeResponse)
async def nominate_trainee(
    cohort_id: str,
    data: TraineeNomineeCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_nominator)
):
    return await NominationService.nominate_trainee(db, cohort_id, data, current_user)

@router.get("/{cohort_id}/trainees", response_model=PaginatedResponse[TraineeNomineeResponse])
async def list_trainees(
    cohort_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await NominationService.get_cohort_trainees(db, cohort_id, current_user, page, limit)

@router.get("/{cohort_id}/mentors/{mentor_id}/trainees")
async def get_mentor_assigned_trainees(
    cohort_id: str,
    mentor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await NominationService.get_mentor_trainees_in_cohort(db, cohort_id, mentor_id)
