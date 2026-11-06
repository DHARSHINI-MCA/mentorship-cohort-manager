from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.progress import ProgressUpdateRequest

class ProgressService:
    @staticmethod
    async def get_mentor_record(db: AsyncIOMotorDatabase, user_id: str) -> dict:
        # A user can be linked to mentor records across cohorts
        mentor = await db.mentors.find_one({"userId": user_id})
        if not mentor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mentor profile not found for this user",
                headers={"code": "MENTOR_NOT_FOUND"}
            )
        return mentor

    @staticmethod
    async def get_mentor_trainees(db: AsyncIOMotorDatabase, user: dict) -> list:
        # Find mentor IDs associated with this user
        mentor_cursor = db.mentors.find({"userId": user["id"]})
        mentor_ids = [str(m["_id"]) async for m in mentor_cursor]
        if not mentor_ids:
            return []

        # Find trainees assigned to any of these mentor records
        trainees_cursor = db.trainees.find({"mentorId": {"$in": mentor_ids}}).sort("name", 1)
        items = []
        async for t in trainees_cursor:
            trainee_id = str(t["_id"])
            t["id"] = trainee_id

            # Report the trainee's current group so the mentor UI can keep
            # members out of other batch pickers.
            active_batch = await db.batches.find_one({
                "traineeIds": {"$in": [ObjectId(trainee_id), trainee_id]},
                "status": {"$nin": ["completed", "archived"]},
            }, {"_id": 1, "name": 1})
            t["batchId"] = str(active_batch["_id"]) if active_batch else None
            t["batchName"] = active_batch.get("name") if active_batch else None
            
            cohort = None
            cohort_id = t.get("cohortId")
            if cohort_id:
                try:
                    cohort = await db.cohorts.find_one({"_id": ObjectId(str(cohort_id))})
                except Exception:
                    # Keep one stale trainee record from breaking the mentor's
                    # entire assigned-trainees list.
                    cohort = None
            t["cohortName"] = cohort["name"] if cohort else "Unknown Cohort"
            
            prog = await db.progress.find_one({"traineeId": trainee_id})
            t["percentComplete"] = prog.get("percentComplete", 0.0) if prog else 0.0

            # Get latest feedback & total feedback count
            latest_fb = await db.feedbackResponses.find_one(
                {"traineeId": trainee_id},
                sort=[("submittedAt", -1)]
            )
            t["lastFeedbackDate"] = latest_fb["submittedAt"] if latest_fb else None
            t["lastFeedbackWeek"] = latest_fb["weekNumber"] if latest_fb else None
            t["feedbackCount"] = await db.feedbackResponses.count_documents({"traineeId": trainee_id})

            # Get total weeks from cohort training plan
            plan = None
            if cohort and cohort.get("trainingPlanId"):
                try:
                    plan = await db.cohortTrainingPlans.find_one(
                        {"_id": ObjectId(str(cohort["trainingPlanId"]))}
                    )
                except Exception:
                    plan = None
            t["totalWeeks"] = plan.get("totalWeeks", 4) if plan else 4

            # The API returns this document as JSON; expose the string `id`
            # above and omit MongoDB's non-JSON-serializable ObjectId value.
            t.pop("_id", None)
            for field, value in t.items():
                if isinstance(value, ObjectId):
                    t[field] = str(value)
                elif isinstance(value, list):
                    t[field] = [str(item) if isinstance(item, ObjectId) else item for item in value]
            items.append(t)
        return items

    @staticmethod
    async def get_trainee_details(db: AsyncIOMotorDatabase, trainee_id: str, current_user: dict) -> dict:
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

        # Role verification for mentor
        if current_user.get("role") == "mentor":
            mentor = await db.mentors.find_one({"_id": ObjectId(trainee.get("mentorId"))}) if trainee.get("mentorId") else None
            if not mentor or str(mentor.get("userId")) != str(current_user["id"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view this trainee",
                    headers={"code": "FORBIDDEN"}
                )

        trainee["id"] = str(trainee["_id"])
        trainee.pop("_id", None)
        cohort_id = str(trainee["cohortId"])
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        trainee["cohort"] = {
            "id": str(cohort["_id"]),
            "name": cohort["name"],
            "status": cohort["status"],
            "startDate": cohort.get("startDate"),
            "endDate": cohort.get("endDate")
        } if cohort else None

        # Fetch progress
        progress = await db.progress.find_one({"traineeId": trainee_id})
        if progress:
            progress["id"] = str(progress["_id"])
            progress.pop("_id", None)
            
        # Fetch plan
        plan = None
        if progress and progress.get("planId"):
            plan = await db.cohortTrainingPlans.find_one({"_id": ObjectId(progress["planId"])})
        elif cohort and cohort.get("trainingPlanId"):
            plan = await db.cohortTrainingPlans.find_one({"_id": ObjectId(cohort["trainingPlanId"])})
            
        if plan:
            plan["id"] = str(plan["_id"])
            plan.pop("_id", None)

        # Fetch cohort feedback form
        feedback_form = None
        if cohort and cohort.get("feedbackFormId"):
            feedback_form = await db.cohortFeedbackForms.find_one({"_id": ObjectId(cohort["feedbackFormId"])})
            if feedback_form:
                feedback_form["id"] = str(feedback_form["_id"])
                feedback_form.pop("_id", None)

        # Fetch all feedback responses for this trainee
        fb_cursor = db.feedbackResponses.find({"traineeId": trainee_id}).sort("weekNumber", 1)
        feedback_history = []
        async for fb in fb_cursor:
            fb["id"] = str(fb["_id"])
            fb.pop("_id", None)
            feedback_history.append(fb)

        # Fetch TalentNext courses for the cohort
        talent_next_courses = []
        if cohort and cohort.get("talentnextCourses"):
            for course_entry in cohort.get("talentnextCourses", []):
                course_id = str(course_entry.get("courseId"))
                course = await db.talentnextCourses.find_one({"_id": ObjectId(course_id)})
                if course:
                    talent_next_courses.append({
                        "id": str(course["_id"]),
                        "name": course.get("name"),
                        "isMandatory": course_entry.get("isMandatory", False)
                    })

        # Fetch or initialize trainee TalentNext completion tracking
        talent_next_progress = await db.talentnextProgress.find_one({"traineeId": trainee_id})
        if not talent_next_progress:
            # Initialize completion tracking for all courses in cohort
            completion_map = {}
            for course in talent_next_courses:
                completion_map[course["id"]] = {
                    "courseId": course["id"],
                    "completed": False,
                    "completedAt": None,
                    "completedBy": None
                }
            talent_next_progress = {
                "traineeId": trainee_id,
                "cohortId": cohort_id,
                "completionMap": completion_map,
                "createdAt": datetime.now(timezone.utc)
            }
            result = await db.talentnextProgress.insert_one(talent_next_progress)
            talent_next_progress["id"] = str(result.inserted_id)
        else:
            talent_next_progress["id"] = str(talent_next_progress["_id"])
            talent_next_progress.pop("_id", None)

        # Fetch assigned mentor record
        mentor = None
        if trainee.get("mentorId"):
            mentor = await db.mentors.find_one({"_id": ObjectId(trainee["mentorId"])})
            if mentor:
                mentor["id"] = str(mentor["_id"])
                mentor.pop("_id", None)
                if mentor.get("nominatedBy"):
                    nominator = await db.nominators.find_one({"_id": ObjectId(mentor["nominatedBy"])})
                    if not nominator:
                        nominator = await db.users.find_one({"_id": ObjectId(mentor["nominatedBy"])})
                    mentor["nominatorName"] = nominator.get("name", "Platform Administrator") if nominator else "Platform Administrator"

        return {
            "trainee": trainee,
            "mentor": mentor,
            "plan": plan,
            "progress": progress,
            "feedbackForm": feedback_form,
            "feedbackHistory": feedback_history,
            "talentnextCourses": talent_next_courses,
            "talentnextProgress": talent_next_progress
        }

    @staticmethod
    async def update_progress(
        db: AsyncIOMotorDatabase,
        trainee_id: str,
        update_req: ProgressUpdateRequest,
        current_user: dict
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

        if trainee.get("status") == "dropped_out":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Progress cannot be updated for a trainee who has dropped out",
            )

        # Ensure mentor is assigned to trainee if caller is mentor
        if current_user.get("role") == "mentor":
            mentor = await db.mentors.find_one({"_id": ObjectId(trainee.get("mentorId"))}) if trainee.get("mentorId") else None
            if not mentor or str(mentor.get("userId")) != str(current_user["id"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to update progress for this trainee",
                    headers={"code": "FORBIDDEN"}
                )

        progress = await db.progress.find_one({"traineeId": trainee_id})
        if not progress:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Progress document not found for trainee",
                headers={"code": "PROGRESS_NOT_FOUND"}
            )

        items = progress.get("items", [])
        now = datetime.now(timezone.utc)
        mentor_user_id = current_user["id"]

        updated = False
        if update_req.courseId is not None:
            # Update specific course
            for item in items:
                if str(item.get("courseId")) == str(update_req.courseId):
                    item["completed"] = update_req.completed
                    item["completedAt"] = now if update_req.completed else None
                    item["completedBy"] = mentor_user_id if update_req.completed else None
                    updated = True
                    break
        elif update_req.weekNumber is not None:
            # Update entire week
            for item in items:
                if item.get("weekNumber") == update_req.weekNumber:
                    item["completed"] = update_req.completed
                    item["completedAt"] = now if update_req.completed else None
                    item["completedBy"] = mentor_user_id if update_req.completed else None
                    updated = True

        if not updated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No matching course or week found in progress plan",
                headers={"code": "ITEM_NOT_FOUND"}
            )

        # Recalculate percentComplete
        total_items = len(items)
        completed_items = sum(1 for it in items if it.get("completed"))
        percent_complete = round((completed_items / total_items) * 100.0, 1) if total_items > 0 else 0.0

        await db.progress.update_one(
            {"_id": progress["_id"]},
            {"$set": {
                "items": items,
                "percentComplete": percent_complete
            }}
        )

        progress["items"] = items
        progress["percentComplete"] = percent_complete
        progress["id"] = str(progress["_id"])
        progress.pop("_id", None)
        return progress

    @staticmethod
    async def update_talentnext_progress(
        db: AsyncIOMotorDatabase,
        trainee_id: str,
        course_id: str,
        completed: bool,
        current_user: dict
    ) -> dict:
        """Update TalentNext course completion status for a trainee"""
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

        if trainee.get("status") == "dropped_out":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TalentNext progress cannot be updated for a trainee who has dropped out",
            )

        # Ensure mentor is assigned to trainee if caller is mentor
        if current_user.get("role") == "mentor":
            mentor = await db.mentors.find_one({"_id": ObjectId(trainee.get("mentorId"))}) if trainee.get("mentorId") else None
            if not mentor or str(mentor.get("userId")) != str(current_user["id"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to update progress for this trainee",
                    headers={"code": "FORBIDDEN"}
                )

        # Get or create TalentNext progress document
        talent_next_progress = await db.talentnextProgress.find_one({"traineeId": trainee_id})
        if not talent_next_progress:
            # Initialize if doesn't exist
            talent_next_progress = {
                "traineeId": trainee_id,
                "cohortId": str(trainee.get("cohortId")),
                "completionMap": {},
                "createdAt": datetime.now(timezone.utc)
            }
            result = await db.talentnextProgress.insert_one(talent_next_progress)
            talent_next_progress["_id"] = result.inserted_id

        # Update completion status for the course
        completion_map = talent_next_progress.get("completionMap", {})
        now = datetime.now(timezone.utc)
        mentor_user_id = current_user["id"]

        completion_map[course_id] = {
            "courseId": course_id,
            "completed": completed,
            "completedAt": now if completed else None,
            "completedBy": mentor_user_id if completed else None
        }

        # Update document
        await db.talentnextProgress.update_one(
            {"_id": talent_next_progress["_id"]},
            {"$set": {
                "completionMap": completion_map,
                "updatedAt": now
            }}
        )

        talent_next_progress["completionMap"] = completion_map
        talent_next_progress["updatedAt"] = now
        talent_next_progress["id"] = str(talent_next_progress["_id"])
        talent_next_progress.pop("_id", None)
        return talent_next_progress
