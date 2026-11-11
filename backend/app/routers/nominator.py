"""
Nominator dashboard.

Nominators are independent of cohorts: they only see how many mentors and
trainees *they* nominated and the most recent ones. No cohort, mentor
assignment or progress information is exposed here.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_nominator

router = APIRouter(prefix="/nominator", tags=["Nominator"])


@router.get("/dashboard")
async def get_nominator_dashboard(
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    nominator_id = current_user["id"]
    try:
        query = {"nominatedBy": nominator_id}
        mentors_nominated = await db.mentors.count_documents(query)
        trainees_nominated = await db.trainees.count_documents(query)

        recent = []
        for kind, collection in (("mentor", db.mentors), ("trainee", db.trainees)):
            async for doc in collection.find(query).sort("createdAt", -1).limit(5):
                recent.append({
                    "id": str(doc["_id"]),
                    "type": kind,
                    "name": doc.get("name", ""),
                    "email": doc.get("email", ""),
                    "createdAt": doc.get("createdAt"),
                })
        recent.sort(key=lambda item: item["createdAt"] or 0, reverse=True)

        return {
            "totalMentorsNominated": mentors_nominated,
            "totalTraineesNominated": trainees_nominated,
            "totalNominated": mentors_nominated + trainees_nominated,
            "recentActivity": recent[:5],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard: {str(e)}"
        )
