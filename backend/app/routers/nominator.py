"""
Nominator-specific endpoints for dashboard and nomination management
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.core.db import get_database
from app.core.deps import require_roles
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/nominator", tags=["Nominator"])

# Dependency for nominator role check
require_nominator = require_roles(["nominator", "admin"])

@router.get("/dashboard")
async def get_nominator_dashboard(
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get nominator dashboard with:
    - Assigned cohorts
    - Nomination counts
    - Recent activity
    - Quick stats
    """
    nominator_id = current_user["id"]
    
    try:
        # Get assigned cohorts for this nominator
        cohorts = await db.cohorts.find(
            {"nominatorIds": nominator_id}
        ).to_list(length=None)
        
        # Build response with stats
        dashboard = {
            "assignedCohorts": len(cohorts),
            "cohortsList": [],
            "totalMentorsNominated": 0,
            "totalTraineesNominated": 0,
            "pendingReviews": 0,
            "recentActivity": []
        }
        
        # Process each cohort
        for cohort in cohorts:
            cohort_id = str(cohort["_id"])
            
            # Nominator submissions are stored in the same collections used by
            # the admin assignment workflow.
            nominee_query = {
                "cohortId": cohort_id,
                "nominatedBy": nominator_id,
            }
            mentor_count = await db.mentors.count_documents(nominee_query)
            trainee_count = await db.trainees.count_documents(nominee_query)
            unassigned_count = await db.trainees.count_documents({
                **nominee_query,
                "mentorId": None,
            })
            
            dashboard["cohortsList"].append({
                "cohortId": cohort_id,
                "cohortName": cohort.get("name", "Unknown"),
                "status": cohort.get("status", "active"),
                "startDate": cohort.get("startDate"),
                "endDate": cohort.get("endDate"),
                "mentorsNominated": mentor_count,
                "traineesNominated": trainee_count,
                "pendingNominations": unassigned_count
            })
            
            dashboard["totalMentorsNominated"] += mentor_count
            dashboard["totalTraineesNominated"] += trainee_count
            dashboard["pendingReviews"] += unassigned_count
        
        # Get recent activity (last 5 nominations)
        recent = await db.nominees.find(
            {"nominatedBy": ObjectId(nominator_id)}
        ).sort("createdAt", -1).limit(5).to_list(length=None)
        
        for item in recent:
            dashboard["recentActivity"].append({
                "id": str(item["_id"]),
                "type": item.get("type", "unknown"),
                "name": item.get("name", ""),
                "email": item.get("email", ""),
                "status": item.get("status", "pending"),
                "cohortId": str(item.get("cohortId", "")),
                "createdAt": item.get("createdAt")
            })
        
        return dashboard
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard: {str(e)}"
        )

@router.get("/cohorts")
async def get_nominator_cohorts(
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get all cohorts assigned to this nominator
    """
    nominator_id = current_user["id"]
    
    try:
        cohorts = await db.cohorts.find(
            {"nominatorIds": nominator_id}
        ).to_list(length=None)
        
        cohort_list = []
        for cohort in cohorts:
            cohort_list.append({
                "id": str(cohort["_id"]),
                "name": cohort.get("name", ""),
                "description": cohort.get("description", ""),
                "startDate": cohort.get("startDate"),
                "endDate": cohort.get("endDate"),
                "status": cohort.get("status", "active"),
                "createdAt": cohort.get("createdAt")
            })
        
        return {
            "total": len(cohort_list),
            "cohorts": cohort_list
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch cohorts: {str(e)}"
        )

@router.get("/cohorts/{cohort_id}/nominations")
async def get_cohort_nominations(
    cohort_id: str,
    type_filter: str = Query(None, regex="^(mentor|trainee)$"),
    status_filter: str = Query(None, regex="^(pending|approved|rejected)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get nominations for a specific cohort
    Filters by:
    - type: mentor or trainee
    - status: pending, approved, rejected
    """
    nominator_id = current_user["id"]
    
    try:
        # Verify nominator has access to this cohort
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        if not cohort or nominator_id not in cohort.get("nominatorIds", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this cohort"
            )
        
        # Build query
        query = {
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(nominator_id)
        }
        
        if type_filter:
            query["type"] = type_filter
        if status_filter:
            query["status"] = status_filter
        
        # Get total count
        total = await db.nominees.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * limit
        nominees = await db.nominees.find(query).skip(skip).limit(limit).to_list(length=None)
        
        items = []
        for nominee in nominees:
            items.append({
                "id": str(nominee["_id"]),
                "name": nominee.get("name", ""),
                "email": nominee.get("email", ""),
                "type": nominee.get("type", ""),
                "location": nominee.get("location", ""),
                "timezone": nominee.get("timezone", ""),
                "status": nominee.get("status", "pending"),
                "createdAt": nominee.get("createdAt"),
                "approvedAt": nominee.get("approvedAt"),
                "notes": nominee.get("notes", "")
            })
        
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch nominations: {str(e)}"
        )

@router.put("/nominations/{nomination_id}/status")
async def update_nomination_status(
    nomination_id: str,
    status_update: dict,
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Update nomination status (pending, approved, rejected)
    Only the nominator who created it can update it
    """
    nominator_id = current_user["id"]
    
    try:
        new_status = status_update.get("status")
        notes = status_update.get("notes", "")
        
        if new_status not in ["pending", "approved", "rejected"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status value"
            )
        
        # Verify ownership and update
        update_data = {
            "status": new_status,
            "updatedAt": datetime.utcnow()
        }
        
        if notes:
            update_data["notes"] = notes
        
        if new_status == "approved":
            update_data["approvedAt"] = datetime.utcnow()
        
        result = await db.nominees.update_one(
            {
                "_id": ObjectId(nomination_id),
                "nominatedBy": ObjectId(nominator_id)
            },
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nomination not found or you don't have permission to update it"
            )
        
        return {
            "success": True,
            "message": f"Nomination status updated to {new_status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update nomination: {str(e)}"
        )

@router.get("/nominations/{nomination_id}")
async def get_nomination_details(
    nomination_id: str,
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get detailed information about a specific nomination
    """
    nominator_id = current_user["id"]
    
    try:
        nominee = await db.nominees.find_one({
            "_id": ObjectId(nomination_id),
            "nominatedBy": ObjectId(nominator_id)
        })
        
        if not nominee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nomination not found"
            )
        
        return {
            "id": str(nominee["_id"]),
            "name": nominee.get("name", ""),
            "email": nominee.get("email", ""),
            "type": nominee.get("type", ""),
            "location": nominee.get("location", ""),
            "timezone": nominee.get("timezone", ""),
            "status": nominee.get("status", "pending"),
            "createdAt": nominee.get("createdAt"),
            "approvedAt": nominee.get("approvedAt"),
            "notes": nominee.get("notes", ""),
            "experience": nominee.get("experience", ""),
            "skills": nominee.get("skills", []),
            "cohortId": str(nominee.get("cohortId", ""))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch nomination: {str(e)}"
        )

@router.get("/statistics")
async def get_nominator_statistics(
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get comprehensive statistics for nominator
    """
    nominator_id = current_user["id"]
    
    try:
        # Total nominations
        total_nominations = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id)
        })
        
        # By type
        mentor_nominations = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id),
            "type": "mentor"
        })
        
        trainee_nominations = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id),
            "type": "trainee"
        })
        
        # By status
        pending = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id),
            "status": "pending"
        })
        
        approved = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id),
            "status": "approved"
        })
        
        rejected = await db.nominees.count_documents({
            "nominatedBy": ObjectId(nominator_id),
            "status": "rejected"
        })
        
        return {
            "totalNominations": total_nominations,
            "byType": {
                "mentors": mentor_nominations,
                "trainees": trainee_nominations
            },
            "byStatus": {
                "pending": pending,
                "approved": approved,
                "rejected": rejected
            },
            "approvalRate": round((approved / total_nominations * 100), 2) if total_nominations > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}"
        )
