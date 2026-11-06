from fastapi import APIRouter, Depends, Query, HTTPException, status
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_admin, require_nominator, require_any_authenticated
from app.services.cohort_service import CohortService
from app.schemas.cohorts import (
    CohortCreate, CohortUpdate, CohortStatusUpdate, CohortConfigureRequest,
    CohortResponse, ExtendTimelineRequest, UpdatePlanRequest, UpdateFeedbackFormRequest
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/cohorts", tags=["Cohorts"])

@router.post("", response_model=CohortResponse)
async def create_cohort(
    data: CohortCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.create_cohort(db, data, current_user["id"])

@router.get("", response_model=PaginatedResponse[CohortResponse])
async def list_cohorts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    nominator_id = current_user["id"] if current_user.get("role") == "nominator" else None
    return await CohortService.get_cohorts(db, page, limit, nominator_id)

@router.get("/{cohort_id}", response_model=CohortResponse)
async def get_cohort(
    cohort_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    cohort = await CohortService.get_cohort_by_id(db, cohort_id)
    if current_user.get("role") == "nominator" and current_user["id"] not in cohort.get("nominatorIds", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this cohort",
            headers={"code": "FORBIDDEN"}
        )
    return cohort

@router.put("/{cohort_id}", response_model=CohortResponse)
async def update_cohort(
    cohort_id: str,
    data: CohortUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.update_cohort(db, cohort_id, data)

@router.patch("/{cohort_id}/status", response_model=CohortResponse)
async def update_cohort_status(
    cohort_id: str,
    data: CohortStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.update_status(db, cohort_id, data.status)

@router.put("/{cohort_id}/configure", response_model=CohortResponse)
async def configure_cohort(
    cohort_id: str,
    data: CohortConfigureRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.configure_cohort(db, cohort_id, data)

@router.get("/{cohort_id}/plan")
async def get_cohort_plan(
    cohort_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    cohort = await CohortService.get_cohort_by_id(db, cohort_id)
    if not cohort.get("trainingPlanId"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No training plan configured for this cohort",
            headers={"code": "PLAN_NOT_CONFIGURED"}
        )
    plan = await db.cohortTrainingPlans.find_one({"_id": ObjectId(cohort["trainingPlanId"])})
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort training plan record not found",
            headers={"code": "NOT_FOUND"}
        )
    plan["id"] = str(plan["_id"])
    plan.pop("_id", None)
    weeks = plan.get("weeks", [])
    if "coreWeeks" not in plan:
        plan["coreWeeks"] = sum(1 for w in weeks if not w.get("isBuffer"))
    if "bufferWeeks" not in plan:
        plan["bufferWeeks"] = sum(1 for w in weeks if w.get("isBuffer"))
    return plan

@router.get("/{cohort_id}/feedback-form")
async def get_cohort_feedback_form(
    cohort_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    cohort = await CohortService.get_cohort_by_id(db, cohort_id)
    if not cohort.get("feedbackFormId"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No feedback form configured for this cohort",
            headers={"code": "FORM_NOT_CONFIGURED"}
        )
    form = await db.cohortFeedbackForms.find_one({"_id": ObjectId(cohort["feedbackFormId"])})
    if not form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort feedback form record not found",
            headers={"code": "NOT_FOUND"}
        )
    form["id"] = str(form["_id"])
    form.pop("_id", None)
    return form

@router.put("/{cohort_id}/plan")
async def update_cohort_plan(
    cohort_id: str,
    data: UpdatePlanRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.update_cohort_plan(db, cohort_id, data)

@router.post("/{cohort_id}/extend-timeline", response_model=CohortResponse)
async def extend_cohort_timeline(
    cohort_id: str,
    data: ExtendTimelineRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.extend_timeline(db, cohort_id, data)

@router.put("/{cohort_id}/feedback-form")
async def update_cohort_feedback_form(
    cohort_id: str,
    data: UpdateFeedbackFormRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await CohortService.update_cohort_feedback_form(db, cohort_id, data)

