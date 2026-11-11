from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_mentor, require_any_authenticated
from app.services.progress_service import ProgressService
from app.services.feedback_service import FeedbackService
from app.schemas.progress import ProgressUpdateRequest, ProgressResponse, TraineeDropoutRequest
from app.schemas.feedback import FeedbackSubmitRequest, FeedbackResponseModel

router = APIRouter(prefix="/mentor", tags=["Mentor Operations"])

@router.get("/cohorts")
async def get_my_cohorts(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_mentor)
):
    """Return cohorts linked to the signed-in mentor profile with trainee and batch counts."""
    mentor_profiles = await db.mentors.find({"userId": current_user["id"]}).to_list(length=None)
    cohort_ids = []
    for profile in mentor_profiles:
        c_ids = profile.get("cohortIds") or ([str(profile["cohortId"])] if profile.get("cohortId") else [])
        for cid in c_ids:
            if cid and str(cid) not in cohort_ids:
                cohort_ids.append(str(cid))

    mentor_ids = [str(profile["_id"]) for profile in mentor_profiles]
    cohorts = []
    for cohort_id in cohort_ids:
        try:
            cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        except Exception:
            cohort = None
        if cohort:
            cid_str = str(cohort["_id"])
            # Assigned active trainees in this cohort
            trainee_count = await db.trainees.count_documents({
                "cohortId": cid_str,
                "mentorId": {"$in": mentor_ids},
                "status": {"$ne": "dropped_out"}
            })
            # Batches created by mentor in this cohort
            batch_count = await db.batches.count_documents({
                "cohortId": {"$in": [ObjectId(cid_str), cid_str]},
                "mentorId": {"$in": [ObjectId(current_user["id"]), current_user["id"]]}
            })
            cohorts.append({
                "id": cid_str,
                "name": cohort.get("name", "Unnamed Cohort"),
                "code": cohort.get("code") or (cid_str[:8].upper()),
                "status": cohort.get("status", "active"),
                "startDate": cohort.get("startDate"),
                "endDate": cohort.get("endDate"),
                "traineeCount": trainee_count,
                "batchCount": batch_count,
            })
    return cohorts

@router.get("/trainees")
async def get_my_trainees(
    cohort_id: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_mentor)
):
    return await ProgressService.get_mentor_trainees(db, current_user, cohort_id=cohort_id)

@router.get("/trainees/{trainee_id}")
async def get_trainee_details(
    trainee_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await ProgressService.get_trainee_details(db, trainee_id, current_user)

@router.patch("/trainees/{trainee_id}/dropout")
async def mark_trainee_dropout(
    trainee_id: str,
    request: TraineeDropoutRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_mentor)
):
    """Mark a trainee assigned to this mentor as having dropped out."""
    try:
        trainee = await db.trainees.find_one({"_id": ObjectId(trainee_id)})
    except Exception:
        trainee = None
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    mentor = None
    if trainee.get("mentorId"):
        try:
            mentor = await db.mentors.find_one({"_id": ObjectId(str(trainee["mentorId"]))})
        except Exception:
            mentor = None
    if not mentor or str(mentor.get("userId")) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="You are not authorized to update this trainee")

    if trainee.get("status") == "dropped_out":
        return {"success": True, "traineeId": trainee_id, "status": "dropped_out"}

    update = {
        "status": "dropped_out",
        "droppedOutAt": datetime.utcnow(),
        "droppedOutBy": current_user["id"],
        "dropoutReason": request.reason.strip() if request.reason and request.reason.strip() else None,
    }
    await db.trainees.update_one({"_id": trainee["_id"]}, {"$set": update})
    # Remove the trainee from future scheduled session rosters while preserving
    # the batch assignment and all completed or historical session records.
    trainee_id_values = [trainee["_id"], trainee_id]
    mentor_batches = await db.batches.find({
        "mentorId": {"$in": [ObjectId(current_user["id"]), current_user["id"]]},
        "traineeIds": {"$in": trainee_id_values},
    }, {"_id": 1}).to_list(length=None)
    batch_ids = [batch["_id"] for batch in mentor_batches]
    if batch_ids:
        await db.sessions.update_many(
            {
                "batchId": {"$in": batch_ids},
                "status": "scheduled",
                "sessionDate": {"$gte": datetime.utcnow()},
            },
            {
                "$pull": {
                    "roster": {"traineeId": trainee_id},
                    "attendance": {"traineeId": trainee_id},
                },
                "$set": {"updatedAt": datetime.utcnow()},
            },
        )
    return {"success": True, "traineeId": trainee_id, "status": "dropped_out", **update}

@router.patch("/trainees/{trainee_id}/progress")
async def update_trainee_progress(
    trainee_id: str,
    req: ProgressUpdateRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await ProgressService.update_progress(db, trainee_id, req, current_user)

@router.patch("/trainees/{trainee_id}/talentnext/{course_id}")
async def update_talentnext_course(
    trainee_id: str,
    course_id: str,
    req: dict,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    """Update TalentNext course completion status for a trainee"""
    completed = req.get("completed", False)
    return await ProgressService.update_talentnext_progress(db, trainee_id, course_id, completed, current_user)

@router.post("/trainees/{trainee_id}/feedback")
async def submit_trainee_feedback(
    trainee_id: str,
    req: FeedbackSubmitRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await FeedbackService.submit_feedback(db, trainee_id, req, current_user)

@router.get("/cohort-plan")
async def get_mentor_cohort_plan(
    cohortId: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_mentor)
):
    if cohortId:
        if current_user.get("role") == "mentor":
            mentor_profile = await db.mentors.find_one({
                "$or": [{"cohortIds": cohortId}, {"cohortId": cohortId}],
                "userId": current_user["id"]
            })
            if not mentor_profile:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view this cohort's plan",
                    headers={"code": "FORBIDDEN"}
                )
            if not current_user.get("isActive", True) or not mentor_profile.get("isActive", True):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is deactivated",
                    headers={"code": "ACCOUNT_INACTIVE"}
                )
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohortId)})
    else:
        # Find first mentor record for current_user
        mentor = await db.mentors.find_one({"userId": current_user["id"]})
        if not mentor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mentor profile not found",
                headers={"code": "NOT_FOUND"}
            )
        c_ids = mentor.get("cohortIds") or ([mentor.get("cohortId")] if mentor.get("cohortId") else [])
        if not c_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No cohort assigned to mentor",
                headers={"code": "NOT_FOUND"}
            )
        cohort = await db.cohorts.find_one({"_id": ObjectId(str(c_ids[0]))})

    if not cohort or not cohort.get("trainingPlanId"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort training plan not found",
            headers={"code": "PLAN_NOT_FOUND"}
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
    plan["cohortName"] = cohort.get("name")
    plan["cohortStatus"] = cohort.get("status")
    plan["cohortDates"] = f"{cohort.get('startDate')} to {cohort.get('endDate')}"
    return plan
