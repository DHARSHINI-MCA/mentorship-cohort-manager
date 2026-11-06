"""
Enhanced nomination system for mentors and trainees with location/timezone support
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.core.db import get_database
from app.core.deps import require_roles
from app.schemas.nominees import (
    MentorNomineeCreate, MentorNomineeResponse,
    TraineeNomineeCreate, TraineeNomineeResponse
)

router = APIRouter(prefix="/nominations", tags=["Nominations v2"])

# Role requirements
require_nominator = require_roles(["nominator", "admin"])
require_authenticated = require_roles(["admin", "nominator", "mentor", "trainee"])

@router.post("/mentors", response_model=MentorNomineeResponse)
async def nominate_mentor(
    cohort_id: str = Query(...),
    data: MentorNomineeCreate = None,
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Nominate a mentor with location and timezone fields
    
    Required fields:
    - name, email, department
    - cohort_id (query param)
    
    Optional fields:
    - location, timezone
    - experience, skills
    """
    try:
        # Verify cohort exists
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        if not cohort:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort not found",
                headers={"code": "NOT_FOUND"}
            )
        
        # Check nominator access
        if current_user.get("role") == "nominator":
            if current_user["id"] not in cohort.get("nominatorIds", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned as a nominator for this cohort",
                    headers={"code": "FORBIDDEN"}
                )
        
        # Check for duplicate nomination (same email in same cohort)
        existing = await db.mentors.find_one({
            "cohortId": ObjectId(cohort_id),
            "email": data.email.lower(),
            "nominatedBy": ObjectId(current_user["id"])
        })
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already nominated this person as a mentor in this cohort",
                headers={"code": "DUPLICATE_NOMINATION"}
            )
        
        # Create mentor nominee document
        mentor_doc = {
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(current_user["id"]),
            "name": data.name,
            "email": data.email.lower(),
            "department": data.department,
            "employeeId": data.employeeId or None,
            "location": data.location,
            "timezone": data.timezone,
            "experience": data.experience,
            "skills": data.skills or [],
            "status": "pending",  # Start as pending
            "userId": None,
            "createdAt": datetime.utcnow(),
            "approvedAt": None,
        }
        
        result = await db.mentors.insert_one(mentor_doc)
        mentor_id = str(result.inserted_id)
        
        # Add index if first nomination
        await db.mentors.create_index([("cohortId", 1), ("email", 1)])
        
        return MentorNomineeResponse(
            id=mentor_id,
            cohortId=cohort_id,
            nominatedBy=current_user["id"],
            nominatorName=current_user.get("name", "Admin"),
            name=data.name,
            email=data.email,
            department=data.department,
            employeeId=data.employeeId,
            location=data.location,
            timezone=data.timezone,
            experience=data.experience,
            skills=data.skills or [],
            status="pending",
            userId=None,
            isLoginActive=False,
            assignedTraineesCount=0,
            assignedTrainees=[],
            createdAt=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to nominate mentor: {str(e)}"
        )

@router.post("/trainees", response_model=TraineeNomineeResponse)
async def nominate_trainee(
    cohort_id: str = Query(...),
    data: TraineeNomineeCreate = None,
    current_user: dict = Depends(require_nominator),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Nominate a trainee with location and timezone fields
    
    Required fields:
    - name, email, employeeId, department
    - cohort_id (query param)
    
    Optional fields:
    - location, timezone
    - experience, skills
    """
    try:
        # Verify cohort exists
        cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
        if not cohort:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort not found",
                headers={"code": "NOT_FOUND"}
            )
        
        # Check nominator access
        if current_user.get("role") == "nominator":
            if current_user["id"] not in cohort.get("nominatorIds", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned as a nominator for this cohort",
                    headers={"code": "FORBIDDEN"}
                )
        
        # Check for duplicate nomination
        existing = await db.trainees.find_one({
            "cohortId": ObjectId(cohort_id),
            "email": data.email.lower(),
            "nominatedBy": ObjectId(current_user["id"])
        })
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already nominated this person as a trainee in this cohort",
                headers={"code": "DUPLICATE_NOMINATION"}
            )
        
        # Create trainee nominee document
        trainee_doc = {
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(current_user["id"]),
            "name": data.name,
            "email": data.email.lower(),
            "employeeId": data.employeeId,
            "department": data.department,
            "location": data.location,
            "timezone": data.timezone,
            "experience": data.experience,
            "skills": data.skills or [],
            "status": "pending",  # Start as pending
            "mentorId": None,
            "createdAt": datetime.utcnow(),
            "approvedAt": None,
        }
        
        result = await db.trainees.insert_one(trainee_doc)
        trainee_id = str(result.inserted_id)
        
        return TraineeNomineeResponse(
            id=trainee_id,
            cohortId=cohort_id,
            nominatedBy=current_user["id"],
            nominatorName=current_user.get("name", "Admin"),
            name=data.name,
            email=data.email,
            employeeId=data.employeeId,
            department=data.department,
            location=data.location,
            timezone=data.timezone,
            experience=data.experience,
            skills=data.skills or [],
            status="pending",
            mentorId=None,
            mentorName=None,
            percentComplete=0.0,
            createdAt=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to nominate trainee: {str(e)}"
        )

@router.get("/mentors/search")
async def search_mentors(
    cohort_id: str = Query(...),
    query: str = Query(None, min_length=1),
    location: str = Query(None),
    timezone: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Search/list mentors in a cohort with optional filters
    Filters: location, timezone, search by name/email
    """
    try:
        # Build search query
        search_query = {"cohortId": ObjectId(cohort_id)}
        
        if query:
            search_query["$or"] = [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ]
        
        if location:
            search_query["location"] = location
        
        if timezone:
            search_query["timezone"] = timezone
        
        # Get total count
        total = await db.mentors.count_documents(search_query)
        
        # Get paginated results
        skip = (page - 1) * limit
        mentors = await db.mentors.find(search_query).skip(skip).limit(limit).to_list(length=None)
        
        items = []
        for mentor in mentors:
            items.append({
                "id": str(mentor["_id"]),
                "name": mentor.get("name"),
                "email": mentor.get("email"),
                "department": mentor.get("department"),
                "employeeId": mentor.get("employeeId"),
                "location": mentor.get("location"),
                "timezone": mentor.get("timezone"),
                "experience": mentor.get("experience"),
                "skills": mentor.get("skills", []),
                "status": mentor.get("status", "pending"),
                "createdAt": mentor.get("createdAt")
            })
        
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@router.get("/trainees/search")
async def search_trainees(
    cohort_id: str = Query(...),
    query: str = Query(None, min_length=1),
    location: str = Query(None),
    timezone: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Search/list trainees in a cohort with optional filters
    Filters: location, timezone, search by name/email
    """
    try:
        # Build search query
        search_query = {"cohortId": ObjectId(cohort_id)}
        
        if query:
            search_query["$or"] = [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ]
        
        if location:
            search_query["location"] = location
        
        if timezone:
            search_query["timezone"] = timezone
        
        # Get total count
        total = await db.trainees.count_documents(search_query)
        
        # Get paginated results
        skip = (page - 1) * limit
        trainees = await db.trainees.find(search_query).skip(skip).limit(limit).to_list(length=None)
        
        items = []
        for trainee in trainees:
            items.append({
                "id": str(trainee["_id"]),
                "name": trainee.get("name"),
                "email": trainee.get("email"),
                "department": trainee.get("department"),
                "employeeId": trainee.get("employeeId"),
                "location": trainee.get("location"),
                "timezone": trainee.get("timezone"),
                "experience": trainee.get("experience"),
                "skills": trainee.get("skills", []),
                "status": trainee.get("status", "pending"),
                "createdAt": trainee.get("createdAt")
            })
        
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@router.get("/locations")
async def get_all_locations(
    cohort_id: str = Query(...),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get unique locations for mentors and trainees in a cohort
    """
    try:
        # Get unique locations from both mentors and trainees
        mentor_locations = await db.mentors.distinct(
            "location",
            {"cohortId": ObjectId(cohort_id), "location": {"$ne": None}}
        )
        
        trainee_locations = await db.trainees.distinct(
            "location",
            {"cohortId": ObjectId(cohort_id), "location": {"$ne": None}}
        )
        
        # Combine and remove duplicates
        all_locations = sorted(set(mentor_locations + trainee_locations))
        
        return {
            "locations": all_locations,
            "count": len(all_locations)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch locations: {str(e)}"
        )

@router.get("/timezones")
async def get_all_timezones(
    cohort_id: str = Query(...),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get unique timezones for mentors and trainees in a cohort
    """
    try:
        # Get unique timezones from both mentors and trainees
        mentor_timezones = await db.mentors.distinct(
            "timezone",
            {"cohortId": ObjectId(cohort_id), "timezone": {"$ne": None}}
        )
        
        trainee_timezones = await db.trainees.distinct(
            "timezone",
            {"cohortId": ObjectId(cohort_id), "timezone": {"$ne": None}}
        )
        
        # Combine and remove duplicates
        all_timezones = sorted(set(mentor_timezones + trainee_timezones))
        
        return {
            "timezones": all_timezones,
            "count": len(all_timezones)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch timezones: {str(e)}"
        )

@router.get("/mentor-trainee-matching/{mentor_id}")
async def get_matching_trainees(
    mentor_id: str,
    cohort_id: str = Query(...),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get trainees that match a mentor's timezone/location for optimal pairing
    """
    try:
        # Get mentor details
        mentor = await db.mentors.find_one({
            "_id": ObjectId(mentor_id),
            "cohortId": ObjectId(cohort_id)
        })
        
        if not mentor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mentor not found"
            )
        
        # Find trainees in same timezone/location
        query = {
            "cohortId": ObjectId(cohort_id),
            "mentorId": None,  # Not yet assigned
            "status": "approved"  # Only approved trainees
        }
        
        # Prioritize same location and timezone
        matches = []
        
        # Perfect match (same location and timezone)
        if mentor.get("timezone"):
            perfect_matches = await db.trainees.find({
                **query,
                "timezone": mentor.get("timezone"),
                "location": mentor.get("location")
            }).to_list(length=None)
            matches.extend([(t, 3) for t in perfect_matches])
        
        # Location match only
        if mentor.get("location"):
            location_matches = await db.trainees.find({
                **query,
                "location": mentor.get("location")
            }).to_list(length=None)
            matches.extend([(t, 2) for t in location_matches])
        
        # Timezone match only
        if mentor.get("timezone"):
            timezone_matches = await db.trainees.find({
                **query,
                "timezone": mentor.get("timezone")
            }).to_list(length=None)
            matches.extend([(t, 1) for t in timezone_matches])
        
        # Remove duplicates and sort by priority
        seen = set()
        unique_matches = []
        for trainee, priority in sorted(matches, key=lambda x: -x[1]):
            trainee_id = str(trainee["_id"])
            if trainee_id not in seen:
                seen.add(trainee_id)
                unique_matches.append({
                    "id": trainee_id,
                    "name": trainee.get("name"),
                    "email": trainee.get("email"),
                    "location": trainee.get("location"),
                    "timezone": trainee.get("timezone"),
                    "experience": trainee.get("experience"),
                    "skills": trainee.get("skills", []),
                    "matchPriority": priority
                })
        
        return {
            "mentorId": mentor_id,
            "mentorLocation": mentor.get("location"),
            "mentorTimezone": mentor.get("timezone"),
            "matches": unique_matches,
            "totalMatches": len(unique_matches)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find matches: {str(e)}"
        )
