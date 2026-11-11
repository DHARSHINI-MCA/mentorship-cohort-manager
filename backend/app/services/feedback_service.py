from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.feedback import FeedbackSubmitRequest

class FeedbackService:
    @staticmethod
    async def submit_feedback(
        db: AsyncIOMotorDatabase,
        trainee_id: str,
        feedback_data: FeedbackSubmitRequest,
        current_user: dict,
        cohort_id: str = None,
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
                detail="Feedback cannot be submitted for a trainee who has dropped out",
            )

        # Mentor authorization
        if current_user.get("role") == "mentor":
            mentor = await db.mentors.find_one({"_id": ObjectId(trainee.get("mentorId"))}) if trainee.get("mentorId") else None
            trainee_cohort_id = str(trainee.get("cohortId")) if trainee.get("cohortId") else None
            if not mentor or str(mentor.get("userId")) != str(current_user["id"]) or (cohort_id and str(cohort_id) != trainee_cohort_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to submit feedback for this trainee",
                    headers={"code": "FORBIDDEN"}
                )
            mentor_profile = await db.mentors.find_one({"userId": current_user["id"], "$or": [{"cohortIds": cohort_id or trainee_cohort_id}, {"cohortId": cohort_id or trainee_cohort_id}]})
            if not mentor_profile:
                raise HTTPException(status_code=403, detail="You are not authorized to access this cohort", headers={"code": "FORBIDDEN"})
            if (mentor_profile.get("cohortAccess") or {}).get(str(cohort_id or trainee_cohort_id), True) is False:
                raise HTTPException(status_code=403, detail="Your access to this cohort is deactivated", headers={"code": "COHORT_ACCESS_INACTIVE"})

        cohort_id = str(trainee["cohortId"])
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        if not cohort or not cohort.get("feedbackFormId"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cohort does not have a feedback form configured",
                headers={"code": "FORM_NOT_CONFIGURED"}
            )

        form_id = cohort["feedbackFormId"]
        form = await db.cohortFeedbackForms.find_one({"_id": ObjectId(form_id)})
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort feedback form not found",
                headers={"code": "FORM_NOT_FOUND"}
            )

        # Validate answers against form fields
        fields = form.get("fields", [])
        answers = feedback_data.answers

        for f in fields:
            key = f.get("key")
            label = f.get("label", key)
            f_type = f.get("type")
            is_req = f.get("required", True)
            val = answers.get(key)

            if is_req and (val is None or (isinstance(val, str) and not val.strip())):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field '{label}' is required",
                    headers={"code": "VALIDATION_ERROR"}
                )

            if val is not None:
                if f_type == "rating":
                    if not isinstance(val, (int, float)) or int(val) < 1 or int(val) > 5:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Rating for '{label}' must be an integer between 1 and 5",
                            headers={"code": "VALIDATION_ERROR"}
                        )
                elif f_type == "select":
                    options = f.get("options", [])
                    if str(val) not in options:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Value '{val}' for '{label}' must be one of {options}",
                            headers={"code": "VALIDATION_ERROR"}
                        )
                elif f_type == "text":
                    if not isinstance(val, str):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Value for '{label}' must be text",
                            headers={"code": "VALIDATION_ERROR"}
                        )

        # Store feedback response (upsert by traineeId + weekNumber)
        now = datetime.now(timezone.utc)
        mentor_id = trainee.get("mentorId")

        response_doc = {
            "cohortId": cohort_id,
            "traineeId": trainee_id,
            "mentorId": mentor_id,
            "formId": form_id,
            "weekNumber": feedback_data.weekNumber,
            "answers": answers,
            "submittedAt": now
        }

        result = await db.feedbackResponses.update_one(
            {"traineeId": trainee_id, "weekNumber": feedback_data.weekNumber},
            {"$set": response_doc},
            upsert=True
        )

        saved = await db.feedbackResponses.find_one({"traineeId": trainee_id, "weekNumber": feedback_data.weekNumber})
        saved["id"] = str(saved["_id"])
        saved.pop("_id", None)
        return saved
