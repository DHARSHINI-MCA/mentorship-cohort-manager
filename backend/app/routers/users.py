from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.security import get_password_hash, generate_nominator_temporary_password
from app.core.deps import require_admin
from app.services.nomination_service import NominationService
from app.schemas.users import NominatorCreate, CohortNominatorCreate, UserResponse, ActivateMentorLoginRequest
from app.schemas.nominees import MentorNomineeResponse

router = APIRouter(tags=["Users & Nominators"])

@router.get("/users/cohorts/{cohort_id}/nominators")
async def list_cohort_nominators(
    cohort_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    try:
        cohort_object_id = ObjectId(cohort_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cohort ID", headers={"code": "INVALID_ID"})

    cohort = await db.cohorts.find_one({"_id": cohort_object_id})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found", headers={"code": "NOT_FOUND"})

    nominator_ids = []
    for nominator_id in cohort.get("nominatorIds", []):
        try:
            nominator_ids.append(ObjectId(nominator_id))
        except Exception:
            continue

    nominators = []
    if nominator_ids:
        cursor = db.users.find({"_id": {"$in": nominator_ids}, "role": "nominator"}).sort("createdAt", -1)
        async for user in cursor:
            nominators.append({
                "id": str(user["_id"]),
                "name": user.get("name", ""),
                "employeeId": user.get("employeeId", ""),
                "email": user.get("email", ""),
                "createdAt": user.get("createdAt"),
                "firstLoginPasswordReset": user.get("firstLoginPasswordReset", False),
                "isActive": user.get("isActive", True),
            })
    return nominators

@router.post("/users/cohorts/{cohort_id}/nominators", status_code=status.HTTP_201_CREATED)
async def create_cohort_nominator(
    cohort_id: str,
    data: CohortNominatorCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    try:
        cohort_object_id = ObjectId(cohort_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cohort ID", headers={"code": "INVALID_ID"})

    cohort = await db.cohorts.find_one({"_id": cohort_object_id})
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found", headers={"code": "NOT_FOUND"})

    normalized_email = str(data.email).lower()
    if await db.users.find_one({"email": normalized_email}):
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists",
            headers={"code": "EMAIL_EXISTS"}
        )

    name = data.name.strip()
    employee_id = data.employeeId.strip()
    if not name or not employee_id:
        raise HTTPException(status_code=422, detail="Name and employee ID are required")
    temporary_password = generate_nominator_temporary_password(name, employee_id)
    now = datetime.now(timezone.utc)
    user_doc = {
        "name": name,
        "employeeId": employee_id,
        "email": normalized_email,
        "passwordHash": get_password_hash(temporary_password),
        "role": "nominator",
        "isActive": True,
        "firstLoginPasswordReset": True,
        "createdAt": now,
        "createdBy": ObjectId(current_user["id"]),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    await db.cohorts.update_one(
        {"_id": cohort_object_id},
        {"$addToSet": {"nominatorIds": user_id}}
    )

    return {
        "nominator": {
            "id": user_id,
            "name": name,
            "employeeId": employee_id,
            "email": normalized_email,
            "createdAt": now,
            "firstLoginPasswordReset": True,
        },
        "temporaryPassword": temporary_password,
    }

@router.get("/users/nominators", response_model=List[UserResponse])
async def list_nominators(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    cursor = db.users.find({"role": "nominator"}).sort("createdAt", -1)
    nominators = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        nominators.append(doc)
    return nominators

@router.post("/users/nominators", response_model=UserResponse)
async def create_nominator(
    data: NominatorCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
            headers={"code": "EMAIL_EXISTS"}
        )

    user_doc = {
        "name": data.name,
        "email": data.email.lower(),
        "passwordHash": get_password_hash(data.password),
        "role": "nominator",
        "isActive": True,
        "createdAt": datetime.now(timezone.utc)
    }
    res = await db.users.insert_one(user_doc)
    user_id = str(res.inserted_id)
    user_doc["id"] = user_id

    # If assigned to cohorts initially, update those cohorts
    if data.assignedCohortIds:
        for cid in data.assignedCohortIds:
            try:
                await db.cohorts.update_one(
                    {"_id": ObjectId(cid)},
                    {"$addToSet": {"nominatorIds": user_id}}
                )
            except Exception:
                pass

    return user_doc

@router.delete("/users/nominators/{nominator_id}")
async def delete_nominator(
    nominator_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    try:
        res = await db.users.delete_one({"_id": ObjectId(nominator_id), "role": "nominator"})
        if res.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nominator not found",
                headers={"code": "NOT_FOUND"}
            )
        # Pull from cohorts
        await db.cohorts.update_many(
            {"nominatorIds": nominator_id},
            {"$pull": {"nominatorIds": nominator_id}}
        )
        return {"success": True, "message": "Nominator deleted"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid nominator ID",
            headers={"code": "INVALID_ID"}
        )

@router.post("/mentors/{mentor_id}/activate-login", response_model=dict)
async def activate_mentor_login(
    mentor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await NominationService.activate_mentor_login(db, mentor_id)
