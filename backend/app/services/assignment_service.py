from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

class AssignmentService:
    @staticmethod
    async def get_unassigned_trainees(db: AsyncIOMotorDatabase, cohort_id: str) -> list:
        cursor = db.trainees.find({"cohortId": cohort_id, "mentorId": None}).sort("createdAt", -1)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            doc["mentorName"] = None
            doc["percentComplete"] = 0.0
            items.append(doc)
        return items

    @staticmethod
    async def assign_mentor(
        db: AsyncIOMotorDatabase,
        trainee_id: str,
        mentor_id: str
    ) -> dict:
        try:
            trainee = await db.trainees.find_one({"_id": ObjectId(trainee_id)})
        except Exception:
            trainee = None
        if not trainee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trainee not found",
                headers={"code": "NOT_FOUND"}
            )
            
        try:
            mentor = await db.mentors.find_one({"_id": ObjectId(mentor_id)})
        except Exception:
            mentor = None
        if not mentor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mentor not found",
                headers={"code": "NOT_FOUND"}
            )

        # Keep existing assignments intact, but reject any new or changed
        # assignment to a mentor whose login account has been deactivated.
        if mentor.get("userId"):
            try:
                mentor_user_id = ObjectId(mentor["userId"])
            except Exception:
                mentor_user_id = None
            if mentor_user_id:
                mentor_user = await db.users.find_one({"_id": mentor_user_id}, {"isActive": 1})
                if mentor_user and not mentor_user.get("isActive", True):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This mentor is deactivated and cannot be assigned to trainees",
                        headers={"code": "MENTOR_DEACTIVATED"}
                    )

        if str(mentor["cohortId"]) != str(trainee["cohortId"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mentor and Trainee must belong to the same cohort",
                headers={"code": "COHORT_MISMATCH"}
            )

        cohort_id = str(trainee["cohortId"])

        # Update trainee mentorId
        await db.trainees.update_one(
            {"_id": ObjectId(trainee_id)},
            {"$set": {"mentorId": mentor_id}}
        )

        # Handle Progress document
        existing_progress = await db.progress.find_one({"traineeId": trainee_id})
        if existing_progress:
            # Reassignment: update mentorId, keep completion history intact
            await db.progress.update_one(
                {"_id": existing_progress["_id"]},
                {"$set": {"mentorId": mentor_id}}
            )
        else:
            # Create progress document if cohort has a training plan
            cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
            if cohort and cohort.get("trainingPlanId"):
                plan_id = cohort["trainingPlanId"]
                plan = await db.cohortTrainingPlans.find_one({"_id": ObjectId(plan_id)})
                if plan:
                    items = []
                    for w in plan.get("weeks", []):
                        for c in w.get("courses", []):
                            items.append({
                                "weekNumber": w.get("weekNumber"),
                                "courseId": c.get("courseId"),
                                "completed": False,
                                "completedAt": None,
                                "completedBy": None
                            })
                    await db.progress.insert_one({
                        "cohortId": cohort_id,
                        "traineeId": trainee_id,
                        "mentorId": mentor_id,
                        "planId": plan_id,
                        "items": items,
                        "percentComplete": 0.0,
                        "createdAt": datetime.now(timezone.utc)
                    })

        trainee["id"] = trainee_id
        trainee["mentorId"] = mentor_id
        trainee["mentorName"] = mentor["name"]
        return trainee
