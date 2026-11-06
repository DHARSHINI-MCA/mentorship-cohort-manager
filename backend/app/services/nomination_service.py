from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.security import get_password_hash, generate_temporary_password
from app.schemas.nominees import MentorNomineeCreate, TraineeNomineeCreate

class NominationService:
    @staticmethod
    async def nominate_mentor(
        db: AsyncIOMotorDatabase,
        cohort_id: str,
        data: MentorNomineeCreate,
        nominated_by_user: dict
    ) -> dict:
        # Check cohort exists
        try:
            cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        except Exception:
            cohort = None
        if not cohort:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort not found",
                headers={"code": "NOT_FOUND"}
            )
            
        # Role check: If nominator, must be assigned to cohort
        if nominated_by_user.get("role") == "nominator":
            if nominated_by_user["id"] not in cohort.get("nominatorIds", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned as a nominator for this cohort",
                    headers={"code": "FORBIDDEN"}
                )

        doc = data.model_dump()
        doc["cohortId"] = cohort_id
        doc["nominatedBy"] = nominated_by_user["id"]
        doc["userId"] = None
        doc["createdAt"] = datetime.now(timezone.utc)

        result = await db.mentors.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc["isLoginActive"] = False
        doc["assignedTraineesCount"] = 0
        doc["assignedTrainees"] = []
        doc["nominatorName"] = nominated_by_user.get("name", "Platform Administrator")
        return doc

    @staticmethod
    async def get_cohort_mentors(
        db: AsyncIOMotorDatabase,
        cohort_id: str,
        current_user: dict,
        page: int = 1,
        limit: int = 50
    ) -> dict:
        query = {"cohortId": cohort_id}
        if current_user.get("role") == "nominator":
            query["nominatedBy"] = current_user["id"]

        skip = (page - 1) * limit
        cursor = db.mentors.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            mentor_id = str(doc["_id"])
            doc["id"] = mentor_id
            doc["isLoginActive"] = bool(doc.get("userId"))
            if doc.get("userId"):
                try:
                    mentor_user = await db.users.find_one(
                        {"_id": ObjectId(doc["userId"])},
                        {"firstLoginPasswordReset": 1, "isActive": 1},
                    )
                    doc["firstLoginPasswordReset"] = bool(mentor_user and mentor_user.get("firstLoginPasswordReset", False))
                    doc["isAccountActive"] = bool(mentor_user and mentor_user.get("isActive", True))
                except Exception:
                    doc["firstLoginPasswordReset"] = False
                    doc["isAccountActive"] = False
            else:
                doc["firstLoginPasswordReset"] = False
                doc["isAccountActive"] = False
            
            # Fetch assigned trainees for this mentor
            trainees_cursor = db.trainees.find({"mentorId": mentor_id, "cohortId": cohort_id}).sort("name", 1)
            assigned_trainees = []
            async for t in trainees_cursor:
                t_id = str(t["_id"])
                prog = await db.progress.find_one({"traineeId": t_id})
                pct = prog.get("percentComplete", 0.0) if prog else 0.0
                assigned_trainees.append({
                    "id": t_id,
                    "name": t.get("name"),
                    "email": t.get("email"),
                    "employeeId": t.get("employeeId", ""),
                    "department": t.get("department", ""),
                    "percentComplete": pct,
                    "status": t.get("status"),
                    "location": t.get("location"),
                    "droppedOutAt": t.get("droppedOutAt"),
                    "dropoutReason": t.get("dropoutReason"),
                })
            doc["assignedTrainees"] = assigned_trainees
            doc["assignedTraineesCount"] = sum(1 for trainee in assigned_trainees if trainee.get("status") != "dropped_out")

            # Fetch nominator name (admission info)
            if doc.get("nominatedBy"):
                try:
                    nominator = await db.users.find_one({"_id": ObjectId(doc["nominatedBy"])})
                    doc["nominatorName"] = nominator["name"] if nominator else "Platform Administrator"
                except Exception:
                    doc["nominatorName"] = "Platform Administrator"
            else:
                doc["nominatorName"] = "Platform Administrator"

            doc["employeeId"] = doc.get("employeeId", "")
            doc["cohortId"] = str(doc.get("cohortId", cohort_id))
            if doc.get("nominatedBy"):
                doc["nominatedBy"] = str(doc["nominatedBy"])
            if doc.get("userId"):
                doc["userId"] = str(doc["userId"])
            doc.pop("_id", None)
            items.append(doc)

        total = await db.mentors.count_documents(query)
        pages = (total + limit - 1) // limit if limit > 0 else 1
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    @staticmethod
    async def activate_mentor_login(
        db: AsyncIOMotorDatabase,
        mentor_id: str
    ) -> dict:
        try:
            mentor = await db.mentors.find_one({"_id": ObjectId(mentor_id)})
        except Exception:
            mentor = None
        if not mentor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mentor nominee not found",
                headers={"code": "NOT_FOUND"}
            )

        temporary_password = generate_temporary_password()

        # Check if a user with this email already exists
        existing_user = await db.users.find_one({"email": mentor["email"]})
        if existing_user:
            user_id = str(existing_user["_id"])
            # Update password and ensure role is mentor
            await db.users.update_one(
                {"_id": existing_user["_id"]},
                {"$set": {
                    "passwordHash": get_password_hash(temporary_password),
                    "role": "mentor",
                    "isActive": True,
                    "firstLoginPasswordReset": True,
                    "temporaryPassword": None,
                }}
            )
        else:
            # Create new user
            user_doc = {
                "name": mentor["name"],
                "email": mentor["email"],
                "passwordHash": get_password_hash(temporary_password),
                "role": "mentor",
                "isActive": True,
                "firstLoginPasswordReset": True,
                "createdAt": datetime.now(timezone.utc)
            }
            res = await db.users.insert_one(user_doc)
            user_id = str(res.inserted_id)

        # Update mentor nominee record with userId
        await db.mentors.update_one(
            {"_id": ObjectId(mentor_id)},
            {"$set": {"userId": user_id}}
        )

        return {
            "mentorId": mentor_id,
            "userId": user_id,
            "temporaryPassword": temporary_password,
            "firstLoginPasswordReset": True,
        }

    @staticmethod
    async def nominate_trainee(
        db: AsyncIOMotorDatabase,
        cohort_id: str,
        data: TraineeNomineeCreate,
        nominated_by_user: dict
    ) -> dict:
        # Check cohort exists
        try:
            cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        except Exception:
            cohort = None
        if not cohort:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort not found",
                headers={"code": "NOT_FOUND"}
            )
            
        # Role check: If nominator, must be assigned to cohort
        if nominated_by_user.get("role") == "nominator":
            if nominated_by_user["id"] not in cohort.get("nominatorIds", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned as a nominator for this cohort",
                    headers={"code": "FORBIDDEN"}
                )

        doc = data.model_dump()
        doc["cohortId"] = cohort_id
        doc["nominatedBy"] = nominated_by_user["id"]
        doc["mentorId"] = None
        doc["createdAt"] = datetime.now(timezone.utc)

        result = await db.trainees.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc["nominatorName"] = nominated_by_user.get("name", "Unknown")
        doc["mentorName"] = None
        doc["percentComplete"] = 0.0
        return doc

    @staticmethod
    async def get_cohort_trainees(
        db: AsyncIOMotorDatabase,
        cohort_id: str,
        current_user: dict,
        page: int = 1,
        limit: int = 50
    ) -> dict:
        query = {"cohortId": cohort_id}
        if current_user.get("role") == "nominator":
            query["nominatedBy"] = current_user["id"]

        skip = (page - 1) * limit
        cursor = db.trainees.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            trainee_id = str(doc["_id"])
            doc["id"] = trainee_id
            
            # Fetch mentor name if assigned
            mentor_id = doc.get("mentorId")
            if mentor_id:
                try:
                    mentor = await db.mentors.find_one({"_id": ObjectId(mentor_id)})
                    doc["mentorName"] = mentor["name"] if mentor else None
                except Exception:
                    doc["mentorName"] = None
            else:
                doc["mentorName"] = None

            # Fetch nominator name
            if doc.get("nominatedBy"):
                try:
                    nominator = await db.users.find_one({"_id": ObjectId(doc["nominatedBy"])})
                    doc["nominatorName"] = nominator["name"] if nominator else "Unknown"
                except Exception:
                    doc["nominatorName"] = "Unknown"
            else:
                doc["nominatorName"] = "Admin"

            # Fetch percentComplete from progress
            prog = await db.progress.find_one({"traineeId": trainee_id})
            doc["percentComplete"] = prog.get("percentComplete", 0.0) if prog else 0.0

            doc.pop("_id", None)
            items.append(doc)

        total = await db.trainees.count_documents(query)
        pages = (total + limit - 1) // limit if limit > 0 else 1
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    @staticmethod
    async def get_mentor_trainees_in_cohort(
        db: AsyncIOMotorDatabase,
        cohort_id: str,
        mentor_id: str
    ) -> list:
        """Fetch all trainees assigned to a specific mentor within a cohort."""
        cursor = db.trainees.find({
            "cohortId": cohort_id,
            "mentorId": mentor_id
        }).sort("name", 1)

        items = []
        async for doc in cursor:
            trainee_id = str(doc["_id"])
            doc["id"] = trainee_id
            doc.pop("_id", None)

            # Fetch progress
            prog = await db.progress.find_one({"traineeId": trainee_id})
            doc["percentComplete"] = prog.get("percentComplete", 0.0) if prog else 0.0

            items.append(doc)

        return items
