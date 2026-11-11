"""
Session management and attendance tracking endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import Optional
from app.core.db import get_database
from app.core.deps import require_roles, ensure_mentor_cohort_access
from app.schemas.sessions import (
    SessionCreate, SessionUpdate, SessionResponse, SessionListItem,
    MarkAttendanceRequest, AttendanceReportItem,
    SessionAnalytics, SessionStatus, AttendanceStatus, AttendanceRecord,
    SessionRosterTrainee
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# Role requirements
require_mentor = require_roles(["mentor", "admin"])
require_authenticated = require_roles(["admin", "mentor", "trainee"])
require_admin = require_roles(["admin"])


async def get_batch_roster(db: AsyncIOMotorDatabase, trainee_ids: list, include_dropped_out: bool = True) -> list:
    """Build a JSON-safe trainee snapshot in batch order."""
    object_ids = []
    for trainee_id in trainee_ids:
        try:
            object_ids.append(ObjectId(str(trainee_id)))
        except Exception:
            continue
    if not object_ids:
        return []

    trainees = await db.trainees.find({"_id": {"$in": object_ids}}).to_list(length=None)
    by_id = {str(trainee["_id"]): trainee for trainee in trainees}
    roster = []
    for trainee_id in trainee_ids:
        trainee = by_id.get(str(trainee_id))
        if trainee and (include_dropped_out or trainee.get("status") != "dropped_out"):
            roster.append({
                "traineeId": str(trainee["_id"]),
                "name": trainee.get("name", "Trainee"),
                "email": trainee.get("email", "unknown@example.com"),
                "location": trainee.get("location"),
                "status": trainee.get("status"),
                "droppedOutAt": trainee.get("droppedOutAt"),
                "dropoutReason": trainee.get("dropoutReason"),
            })
    return roster


@router.post("/", response_model=SessionResponse)
async def create_session(
    data: SessionCreate,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create a new training session for a batch
    Only mentors can create sessions in their batches
    """
    try:
        # Verify batch exists and mentor owns it
        batch = await db.batches.find_one({"_id": ObjectId(data.batchId)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check ownership
        if str(batch["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))

        roster = await get_batch_roster(db, batch.get("traineeIds", []), include_dropped_out=False)
        if not roster:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Add trainees to this batch before scheduling a session"
            )
        
        # Create session document
        session_doc = {
            "batchId": ObjectId(data.batchId),
            "mentorId": ObjectId(current_user["id"]),
            "sessionDate": data.sessionDate,
            "startTime": data.startTime,
            "endTime": data.endTime,
            "title": data.title,
            "description": data.description,
            "format": data.format,
            "location": data.location,
            "meetingLink": data.meetingLink,
            "maxAttendees": data.maxAttendees,
            "roster": roster,
            "status": SessionStatus.SCHEDULED,
            "attendance": [],  # Will be populated when attendance is marked
            "createdAt": datetime.utcnow(),
            "updatedAt": None
        }
        
        result = await db.sessions.insert_one(session_doc)
        session_id = str(result.inserted_id)
        
        # Get mentor and batch names
        mentor = await db.users.find_one({"_id": batch["mentorId"]})
        mentor_name = mentor.get("name") if mentor else "Unknown"
        
        return SessionResponse(
            id=session_id,
            batchId=data.batchId,
            batchName=batch.get("name"),
            mentorId=current_user["id"],
            mentorName=mentor_name,
            sessionDate=data.sessionDate,
            startTime=data.startTime,
            endTime=data.endTime,
            title=data.title,
            description=data.description,
            format=data.format,
            location=data.location,
            meetingLink=data.meetingLink,
            maxAttendees=data.maxAttendees,
            status=SessionStatus.SCHEDULED,
            roster=[SessionRosterTrainee(**trainee) for trainee in roster],
            attendance=[],
            attendanceCount=0,
            presentCount=0,
            absentCount=0,
            excusedCount=0,
            lateCount=0,
            createdAt=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )


@router.get("/", response_model=list)
async def list_sessions(
    cohort_id: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List sessions with optional filters
    Mentors see only their sessions
    """
    try:
        if current_user.get("role") == "mentor" and not cohort_id:
            raise HTTPException(status_code=400, detail="Select a cohort to view sessions", headers={"code": "COHORT_REQUIRED"})
        query = {}
        
        # Role-based filtering
        if current_user.get("role") == "mentor":
            query["mentorId"] = ObjectId(current_user["id"])
        
        # Cohort filter
        if cohort_id:
            if current_user.get("role") == "mentor":
                await ensure_mentor_cohort_access(db, current_user, cohort_id)
            cohort_batches = await db.batches.find({
                "cohortId": {"$in": [ObjectId(cohort_id), cohort_id]}
            }, {"_id": 1}).to_list(length=None)
            cohort_batch_ids = [b["_id"] for b in cohort_batches]
            if batch_id:
                query["batchId"] = ObjectId(batch_id)
            else:
                query["batchId"] = {"$in": cohort_batch_ids}
        elif batch_id:
            query["batchId"] = ObjectId(batch_id)
        if status:
            query["status"] = status
        
        # Date range filter
        date_query = {}
        if from_date:
            date_query["$gte"] = from_date
        if to_date:
            date_query["$lte"] = to_date
        if date_query:
            query["sessionDate"] = date_query
        
        # Get total count
        total = await db.sessions.count_documents(query)
        
        # Get paginated results sorted by date
        skip = (page - 1) * limit
        sessions = await db.sessions.find(query).sort("sessionDate", -1).skip(skip).limit(limit).to_list(length=None)
        
        items = []
        for session in sessions:
            session_id = str(session["_id"])
            batch = await db.batches.find_one({"_id": session["batchId"]})
            
            attendance = session.get("attendance", [])
            present_count = len([a for a in attendance if a.get("status") == "present"])
            
            items.append(SessionListItem(
                id=session_id,
                batchId=str(session["batchId"]),
                batchName=batch.get("name") if batch else "Unknown",
                title=session.get("title"),
                sessionDate=session.get("sessionDate"),
                startTime=session.get("startTime"),
                endTime=session.get("endTime"),
                format=session.get("format"),
                location=session.get("location"),
                meetingLink=session.get("meetingLink"),
                status=session.get("status"),
                attendanceCount=len(attendance),
                presentCount=present_count,
                totalTrainees=(
                    len(session["roster"])
                    if "roster" in session
                    else len(batch.get("traineeIds", [])) if batch else 0
                ),
                createdAt=session.get("createdAt")
            ))
        
        return items
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {str(e)}"
        )


@router.get("/cohort/{cohort_id}/overview")
async def get_admin_cohort_session_overview(
    cohort_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Return mentor batches, their session schedules, and attendance for admins."""
    try:
        cohort_object_id = ObjectId(cohort_id)
        batches = await db.batches.find({
            "cohortId": {"$in": [cohort_object_id, cohort_id]}
        }).sort("createdAt", -1).to_list(length=None)

        mentor_groups = {}
        for batch in batches:
            mentor_id = str(batch.get("mentorId", ""))
            mentor = None
            try:
                mentor = await db.users.find_one({"_id": ObjectId(mentor_id)})
            except Exception:
                pass

            batch_roster = await get_batch_roster(db, batch.get("traineeIds", []))
            sessions = await db.sessions.find({"batchId": batch["_id"]}).sort(
                "sessionDate", -1
            ).to_list(length=None)
            session_items = []

            for session in sessions:
                roster = session.get("roster")
                if roster is None:
                    roster = batch_roster
                current_roster_by_id = {str(trainee["traineeId"]): trainee for trainee in batch_roster}
                attendance_by_trainee = {
                    str(record.get("traineeId")): record
                    for record in session.get("attendance", [])
                }
                attendance = []
                for trainee in roster:
                    current_trainee = current_roster_by_id.get(str(trainee["traineeId"]), {})
                    marked = attendance_by_trainee.get(str(trainee["traineeId"]))
                    attendance.append({
                        **trainee,
                        "status": marked.get("status") if marked else "not_marked",
                        "traineeStatus": current_trainee.get("status", trainee.get("traineeStatus")),
                        "markedAt": marked.get("markedAt") if marked else None,
                    })

                session_items.append({
                    "id": str(session["_id"]),
                    "title": session.get("title", "Session"),
                    "sessionDate": session.get("sessionDate"),
                    "startTime": session.get("startTime"),
                    "endTime": session.get("endTime"),
                    "format": session.get("format"),
                    "location": session.get("location"),
                    "meetingLink": session.get("meetingLink"),
                    "status": session.get("status", SessionStatus.SCHEDULED),
                    "attendance": attendance,
                    "attendanceCount": len(session.get("attendance", [])),
                    "presentCount": sum(1 for item in attendance if item["status"] == AttendanceStatus.PRESENT.value),
                })

            batch_item = {
                "id": str(batch["_id"]),
                "name": batch.get("name", "Unnamed batch"),
                "status": batch.get("status", "active"),
                "traineeCount": sum(1 for trainee in batch_roster if trainee.get("status") != "dropped_out"),
                "droppedOutTraineeCount": sum(1 for trainee in batch_roster if trainee.get("status") == "dropped_out"),
                "totalTraineeCount": len(batch_roster),
                "trainees": batch_roster,
                "sessions": session_items,
            }
            group = mentor_groups.setdefault(mentor_id, {
                "mentorId": mentor_id,
                "mentorName": mentor.get("name") if mentor else "Unknown mentor",
                "batches": [],
            })
            group["batches"].append(batch_item)

        return list(mentor_groups.values())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch cohort session overview: {str(e)}"
        )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get detailed session information"""
    try:
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check access
        if current_user.get("role") == "mentor":
            if str(session["mentorId"]) != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Get batch and mentor info
        batch = await db.batches.find_one({"_id": session["batchId"]})
        if batch:
            await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))
        mentor = await db.users.find_one({"_id": session["mentorId"]})
        roster = session.get("roster")
        if roster is None:
            roster = await get_batch_roster(db, batch.get("traineeIds", []) if batch else [])
        
        # Build attendance records with names
        attendance = []
        for att in session.get("attendance", []):
            trainee = await db.trainees.find_one({"_id": ObjectId(att.get("traineeId"))})
            if trainee:
                attendance.append(AttendanceRecord(
                    traineeId=att.get("traineeId"),
                    name=trainee.get("name"),
                    email=trainee.get("email"),
                    status=att.get("status"),
                    markedAt=att.get("markedAt"),
                    markedBy=att.get("markedBy")
                ))
        
        # Count attendance statuses
        present_count = len([a for a in attendance if a.status == "present"])
        absent_count = len([a for a in attendance if a.status == "absent"])
        excused_count = len([a for a in attendance if a.status == "excused"])
        late_count = len([a for a in attendance if a.status == "late"])
        
        return SessionResponse(
            id=session_id,
            batchId=str(session["batchId"]),
            batchName=batch.get("name") if batch else "Unknown",
            mentorId=str(session["mentorId"]),
            mentorName=mentor.get("name") if mentor else "Unknown",
            sessionDate=session.get("sessionDate"),
            startTime=session.get("startTime"),
            endTime=session.get("endTime"),
            title=session.get("title"),
            description=session.get("description"),
            format=session.get("format"),
            location=session.get("location"),
            meetingLink=session.get("meetingLink"),
            maxAttendees=session.get("maxAttendees"),
            status=session.get("status"),
            roster=[SessionRosterTrainee(**trainee) for trainee in roster],
            attendance=attendance,
            attendanceCount=len(attendance),
            presentCount=present_count,
            absentCount=absent_count,
            excusedCount=excused_count,
            lateCount=late_count,
            createdAt=session.get("createdAt"),
            updatedAt=session.get("updatedAt")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch session: {str(e)}"
        )


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    data: SessionUpdate,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update session details (before it starts)"""
    try:
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check ownership
        if str(session["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        batch = await db.batches.find_one({"_id": session["batchId"]})
        if batch:
            await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))
        
        # Prevent updating completed sessions
        if session.get("status") in ["completed", "cancelled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update completed or cancelled sessions"
            )
        
        # Build update data
        update_fields = {"updatedAt": datetime.utcnow()}
        if data.sessionDate is not None:
            update_fields["sessionDate"] = data.sessionDate
        if data.startTime is not None:
            update_fields["startTime"] = data.startTime
        if data.endTime is not None:
            update_fields["endTime"] = data.endTime
        if data.title is not None:
            update_fields["title"] = data.title
        if data.description is not None:
            update_fields["description"] = data.description
        if data.format is not None:
            update_fields["format"] = data.format
        if data.location is not None:
            update_fields["location"] = data.location
        if data.meetingLink is not None:
            update_fields["meetingLink"] = data.meetingLink
        if data.status is not None:
            update_fields["status"] = data.status
        
        await db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_fields}
        )
        
        # Fetch and return updated session
        return await get_session(session_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update session: {str(e)}"
        )


@router.post("/{session_id}/attendance")
async def mark_attendance(
    session_id: str,
    request: MarkAttendanceRequest,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Mark attendance for a session"""
    try:
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Check ownership
        if str(session["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        batch = await db.batches.find_one({"_id": session["batchId"]})
        if batch:
            await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))
        roster = session.get("roster")
        if roster is None:
            roster = await get_batch_roster(db, batch.get("traineeIds", []) if batch else [])
        roster_ids = {trainee["traineeId"] for trainee in roster}
        submitted_ids = [str(record.get("traineeId", "")) for record in request.attendanceRecords]
        # Attendance entry is intentionally binary in the mentor workflow.
        allowed_statuses = {AttendanceStatus.PRESENT.value, AttendanceStatus.ABSENT.value}
        if (
            len(submitted_ids) != len(set(submitted_ids))
            or set(submitted_ids) != roster_ids
            or any(record.get("status") not in allowed_statuses for record in request.attendanceRecords)
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mark each trainee in this session roster exactly once with a valid attendance status"
            )
        
        # Build attendance records
        attendance_records = []
        for record in request.attendanceRecords:
            attendance_records.append({
                "traineeId": record.get("traineeId"),
                "status": record.get("status"),
                "markedAt": datetime.utcnow(),
                "markedBy": current_user["id"]
            })
        
        # Update session with attendance
        await db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "attendance": attendance_records,
                    "status": SessionStatus.COMPLETED,
                    "updatedAt": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Marked attendance for {len(attendance_records)} trainees",
            "sessionId": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark attendance: {str(e)}"
        )


@router.get("/{batch_id}/attendance-report", response_model=list)
async def get_attendance_report(
    batch_id: str,
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get attendance report for all trainees in a batch"""
    try:
        # Get batch
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check access
        if current_user.get("role") == "mentor":
            if str(batch["mentorId"]) != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))
        
        # Get all sessions for batch
        sessions = await db.sessions.find({"batchId": ObjectId(batch_id)}).to_list(length=None)
        
        # Build attendance report per trainee
        report = {}
        for trainee_id in batch.get("traineeIds", []):
            trainee = await db.trainees.find_one({"_id": ObjectId(trainee_id)})
            if trainee:
                # Count attendance across all sessions
                attended = 0
                absent = 0
                excused = 0
                late = 0
                
                for session in sessions:
                    for att in session.get("attendance", []):
                        if att.get("traineeId") == str(trainee_id):
                            if att.get("status") == "present":
                                attended += 1
                            elif att.get("status") == "absent":
                                absent += 1
                            elif att.get("status") == "excused":
                                excused += 1
                            elif att.get("status") == "late":
                                late += 1
                
                total = attended + absent + excused + late
                rate = (attended / total * 100) if total > 0 else 0
                
                report[str(trainee_id)] = AttendanceReportItem(
                    traineeId=str(trainee_id),
                    traineeName=trainee.get("name"),
                    traineeEmail=trainee.get("email"),
                    sessionsAttended=attended,
                    sessionsAbsent=absent,
                    sessionsExcused=excused,
                    sessionsLate=late,
                    totalSessions=total,
                    attendanceRate=round(rate, 2)
                )
        
        return list(report.values())
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a session (only scheduled sessions)"""
    try:
        session = await db.sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        # Check ownership
        if str(session["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        batch = await db.batches.find_one({"_id": session["batchId"]})
        if batch:
            await ensure_mentor_cohort_access(db, current_user, str(batch.get("cohortId")))
        
        # Only allow deleting scheduled sessions
        if session.get("status") != SessionStatus.SCHEDULED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only delete scheduled sessions"
            )
        
        await db.sessions.delete_one({"_id": ObjectId(session_id)})
        
        return {
            "success": True,
            "message": "Session deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )
