from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.security import get_password_hash, generate_nominator_temporary_password
from app.core.deps import require_admin
from app.services.nomination_service import NominationService
from app.schemas.users import NominatorCreate
from app.services.identity_service import claim_person_identity, release_person_identity

router = APIRouter(tags=["Users & Nominators"])


@router.get("/users/nominators")
async def list_nominators(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """All nominator accounts with how many mentors/trainees each has nominated."""
    nominators = []
    async for user in db.users.find({"role": "nominator"}).sort("createdAt", -1):
        user_id = str(user["_id"])
        nominators.append({
            "id": user_id,
            "name": user.get("name", ""),
            "employeeId": user.get("employeeId", ""),
            "email": user.get("email", ""),
            "isActive": user.get("isActive", True),
            "firstLoginPasswordReset": user.get("firstLoginPasswordReset", False),
            "createdAt": user.get("createdAt"),
            "mentorsNominated": await db.mentors.count_documents({"nominatedBy": user_id}),
            "traineesNominated": await db.trainees.count_documents({"nominatedBy": user_id}),
        })
    return nominators


@router.post("/users/nominators", status_code=status.HTTP_201_CREATED)
async def create_nominator(
    data: NominatorCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """Create a nominator login. Nominators are not tied to any cohort."""
    normalized_email = str(data.email).lower()
    name = data.name.strip()
    employee_id = data.employeeId.strip()
    if not name or not employee_id:
        raise HTTPException(status_code=422, detail="Name and employee ID are required")

    temporary_password = generate_nominator_temporary_password(name, employee_id)
    now = datetime.now(timezone.utc)
    nominator_id = ObjectId()
    await claim_person_identity(
        db,
        owner_type="nominator",
        owner_id=str(nominator_id),
        email=normalized_email,
        employee_id=employee_id,
    )
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
    user_doc["_id"] = nominator_id
    try:
        await db.users.insert_one(user_doc)
    except Exception:
        await release_person_identity(db, str(nominator_id))
        raise

    return {
        "nominator": {
            "id": str(nominator_id),
            "name": name,
            "employeeId": employee_id,
            "email": normalized_email,
            "createdAt": now,
            "firstLoginPasswordReset": True,
        },
        "temporaryPassword": temporary_password,
    }


@router.delete("/users/nominators/{nominator_id}")
async def delete_nominator(
    nominator_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """Delete a nominator login. Mentors/trainees they nominated are kept."""
    try:
        object_id = ObjectId(nominator_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid nominator ID",
            headers={"code": "INVALID_ID"}
        )
    res = await db.users.delete_one({"_id": object_id, "role": "nominator"})
    if res.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nominator not found",
            headers={"code": "NOT_FOUND"}
        )
    return {"success": True, "message": "Nominator deleted"}


@router.post("/mentors/{mentor_id}/activate-login", response_model=dict)
async def activate_mentor_login(
    mentor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await NominationService.activate_mentor_login(db, mentor_id)
