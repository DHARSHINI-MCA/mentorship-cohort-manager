from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
import io
import json
from app.core.db import get_database
from app.core.deps import require_admin, require_mentor
from app.services.cohort_service import CohortService
from app.services.progress_service import ProgressService
from app.schemas.dashboards import (
    AdminDashboardStats, MentorDashboardStats, AttendanceMetrics,
    BatchCompletionAnalytics, UserActivityAnalytics, UserActivityRecord,
    CohortPerformanceAnalytics, CohortPerformanceMetric, AttendanceTrendAnalytics,
    AttendanceTrendPoint, AttendanceHeatmapAnalytics, HeatmapDataPoint,
    BatchAnalyticsDetail, AdminDashboardFull, ExportRequest, ExportResponse
)

router = APIRouter(tags=["Dashboards"])

@router.get("/admin/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    total_cohorts = await db.cohorts.count_documents({})
    active_cohorts = await db.cohorts.count_documents({"status": "active"})
    total_mentors = await db.mentors.count_documents({})
    active_mentor_logins = await db.mentors.count_documents({"userId": {"$ne": None}})
    total_trainees = await db.trainees.count_documents({})
    dropped_out_trainees = await db.trainees.count_documents({"status": "dropped_out"})
    active_trainees = total_trainees - dropped_out_trainees
    assigned_trainees = await db.trainees.count_documents({
        "mentorId": {"$ne": None},
        "status": {"$ne": "dropped_out"},
    })
    
    active_ids = [str(t["_id"]) async for t in db.trainees.find({"status": {"$ne": "dropped_out"}}, {"_id": 1})]
    # Exclude withdrawn trainees from active progress averages.
    progress_cursor = db.progress.find({"traineeId": {"$in": active_ids}})
    progresses = [p.get("percentComplete", 0.0) async for p in progress_cursor]
    avg_progress = round(sum(progresses) / len(progresses), 1) if progresses else 0.0

    recent_cohorts_res = await CohortService.get_cohorts(db, page=1, limit=6)

    return AdminDashboardStats(
        totalCohorts=total_cohorts,
        activeCohorts=active_cohorts,
        totalMentors=total_mentors,
        activeMentorLogins=active_mentor_logins,
        totalTrainees=total_trainees,
        activeTrainees=active_trainees,
        droppedOutTrainees=dropped_out_trainees,
        assignedTrainees=assigned_trainees,
        avgProgress=avg_progress,
        recentCohorts=recent_cohorts_res["items"]
    )

@router.get("/mentor/dashboard", response_model=MentorDashboardStats)
async def get_mentor_dashboard(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_mentor)
):
    trainees = await ProgressService.get_mentor_trainees(db, current_user)
    active_trainees = [t for t in trainees if t.get("status") != "dropped_out"]
    dropped_out_trainees = [t for t in trainees if t.get("status") == "dropped_out"]
    
    avg_progress = round(
        sum(t.get("percentComplete", 0.0) for t in active_trainees) / len(active_trainees), 1
    ) if active_trainees else 0.0

    summary_list = []
    for t in trainees:
        summary_list.append({
            "traineeId": t["id"],
            "name": t.get("name", ""),
            "email": t.get("email", ""),
            "department": t.get("department", ""),
            "employeeId": t.get("employeeId", ""),
            "cohortId": t.get("cohortId", ""),
            "cohortName": t.get("cohortName", "Cohort"),
            "percentComplete": t.get("percentComplete", 0.0),
            "status": t.get("status"),
            "lastFeedbackDate": t.get("lastFeedbackDate"),
            "lastFeedbackWeek": t.get("lastFeedbackWeek"),
            "feedbackCount": t.get("feedbackCount", 0),
            "totalWeeks": t.get("totalWeeks", 4)
        })

    return MentorDashboardStats(
        mentorName=current_user.get("name", "Mentor"),
        totalTrainees=len(trainees),
        activeTrainees=len(active_trainees),
        droppedOutTrainees=len(dropped_out_trainees),
        avgProgress=avg_progress,
        trainees=summary_list
    )


# ============================================================================
# NEW ANALYTICS ENDPOINTS (Task #6)
# ============================================================================

@router.get("/admin/attendance-metrics", response_model=AttendanceMetrics)
async def get_attendance_metrics(
    cohort_id: str = Query(None, description="Filter by cohort ID"),
    date_from: datetime = Query(None, description="Filter from date"),
    date_to: datetime = Query(None, description="Filter to date"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get attendance metrics for system or specific cohort
    Returns: attendance rates, present/absent/excused/late counts
    """
    try:
        query = {}
        if cohort_id:
            query["cohortId"] = ObjectId(cohort_id)
        
        sessions = await db.sessions.find(query).to_list(None)
        
        total_sessions = len(sessions)
        total_attendances = 0
        present_count = 0
        absent_count = 0
        excused_count = 0
        late_count = 0
        
        for session in sessions:
            attendance = session.get("attendance", [])
            total_attendances += len(attendance)
            
            for record in attendance:
                status = record.get("status", "absent")
                if status == "present":
                    present_count += 1
                elif status == "absent":
                    absent_count += 1
                elif status == "excused":
                    excused_count += 1
                elif status == "late":
                    late_count += 1
        
        total_valid_records = present_count + absent_count + excused_count + late_count
        
        attendance_rate = (total_attendances / total_sessions / 30) * 100 if total_sessions > 0 else 0
        present_rate = (present_count / total_valid_records * 100) if total_valid_records > 0 else 0
        absent_rate = (absent_count / total_valid_records * 100) if total_valid_records > 0 else 0
        excused_rate = (excused_count / total_valid_records * 100) if total_valid_records > 0 else 0
        late_rate = (late_count / total_valid_records * 100) if total_valid_records > 0 else 0
        
        return AttendanceMetrics(
            totalSessions=total_sessions,
            totalAttendances=total_attendances,
            presentCount=present_count,
            absentCount=absent_count,
            excusedCount=excused_count,
            lateCount=late_count,
            attendanceRate=round(attendance_rate, 2),
            presentRate=round(present_rate, 2),
            absentRate=round(absent_rate, 2),
            excusedRate=round(excused_rate, 2),
            lateRate=round(late_rate, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance metrics: {str(e)}")


@router.get("/admin/batch-completion", response_model=list[BatchCompletionAnalytics])
async def get_batch_completion(
    cohort_id: str = Query(None),
    limit: int = Query(10, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get batch completion analytics
    Returns: completion rates and progress for all/filtered batches
    """
    try:
        query = {}
        if cohort_id:
            query["cohortId"] = ObjectId(cohort_id)
        
        batches = await db.batches.find(query).sort("_id", -1).limit(limit).to_list(None)
        
        results = []
        for batch in batches:
            mentor = await db.users.find_one({"_id": batch.get("mentorId")})
            cohort = await db.cohorts.find_one({"_id": batch.get("cohortId")})
            trainee_ids = batch.get("traineeIds", [])
            
            trainees = await db.trainees.find(
                {"_id": {"$in": trainee_ids}}
            ).to_list(None)
            
            completed_trainees = sum(
                1 for t in trainees if t.get("status") == "completed"
            )
            
            total_progress = 0
            for trainee in trainees:
                progress = await db.progress.find_one({"traineeId": trainee["_id"]})
                if progress:
                    total_progress += progress.get("percentComplete", 0)
            
            avg_progress = (total_progress / len(trainees) * 100) if trainees else 0
            completion_rate = (completed_trainees / len(trainees) * 100) if trainees else 0
            
            results.append(BatchCompletionAnalytics(
                batchId=str(batch["_id"]),
                batchName=batch.get("name", "Batch"),
                mentorId=str(batch.get("mentorId", "")),
                mentorName=mentor.get("name", "Unknown") if mentor else "Unknown",
                cohortId=str(batch.get("cohortId", "")),
                cohortName=cohort.get("name", "Cohort") if cohort else "Cohort",
                totalTrainees=len(trainees),
                completedTrainees=completed_trainees,
                completionRate=round(completion_rate, 2),
                avgProgress=round(avg_progress, 2),
                status=batch.get("status", "active"),
                startDate=batch.get("startDate"),
                endDate=batch.get("endDate")
            ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching batch completion: {str(e)}")


@router.get("/admin/user-activity", response_model=UserActivityAnalytics)
async def get_user_activity(
    period: str = Query("today", description="today|week|month"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get user activity and engagement metrics for the specified period
    """
    try:
        if period == "today":
            start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = datetime.utcnow() - timedelta(days=7)
        else:  # month
            start_date = datetime.utcnow() - timedelta(days=30)
        
        # Get active users by role (simplified - based on recent login)
        active_admins = await db.users.count_documents({
            "role": "admin",
            "lastLoginAt": {"$gte": start_date}
        })
        active_mentors = await db.users.count_documents({
            "role": "mentor",
            "lastLoginAt": {"$gte": start_date}
        })
        active_trainees = await db.users.count_documents({
            "role": "trainee",
            "lastLoginAt": {"$gte": start_date}
        })
        
        active_users = active_admins + active_mentors + active_trainees
        
        # Get activity logs (if available)
        recent_activities = []
        activity_log = db.activity_logs if hasattr(db, "activity_logs") else None
        
        if activity_log:
            logs = await activity_log.find({
                "timestamp": {"$gte": start_date}
            }).sort("timestamp", -1).limit(20).to_list(None)
            
            for log in logs:
                user = await db.users.find_one({"_id": log.get("userId")})
                recent_activities.append(UserActivityRecord(
                    userId=str(log.get("userId", "")),
                    userName=user.get("name", "Unknown") if user else "Unknown",
                    userRole=log.get("userRole", "unknown"),
                    action=log.get("action", "unknown"),
                    timestamp=log.get("timestamp"),
                    details=log.get("details")
                ))
        
        # Count top actions
        top_actions = {
            "login": active_users,
            "create_batch": await db.batches.count_documents({"createdAt": {"$gte": start_date}}) if hasattr(db, "batches") else 0,
            "create_session": await db.sessions.count_documents({"createdAt": {"$gte": start_date}}) if hasattr(db, "sessions") else 0,
        }
        
        return UserActivityAnalytics(
            period=period,
            activeUsers=active_users,
            activeAdmins=active_admins,
            activeMentors=active_mentors,
            activeTrainees=active_trainees,
            totalActions=sum(top_actions.values()),
            topActions=top_actions,
            recentActivities=recent_activities
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user activity: {str(e)}")


@router.get("/admin/cohort-performance", response_model=CohortPerformanceAnalytics)
async def get_cohort_performance(
    period: str = Query("month", description="week|month|quarter"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get comparative cohort performance metrics
    """
    try:
        cohorts = await db.cohorts.find({"status": "active"}).to_list(None)
        
        cohort_metrics = []
        best_cohort = None
        worst_cohort = None
        best_score = -1
        worst_score = float('inf')
        
        total_progress = 0
        total_attendance = 0
        
        for cohort in cohorts:
            mentors = await db.mentors.count_documents({"cohortId": cohort["_id"]})
            trainees = await db.trainees.count_documents({"cohortId": cohort["_id"], "status": {"$ne": "dropped_out"}})
            dropped_out_trainees = await db.trainees.count_documents({"cohortId": cohort["_id"], "status": "dropped_out"})
            
            active_trainee_docs = await db.trainees.find(
                {"cohortId": cohort["_id"], "status": {"$ne": "dropped_out"}},
                {"_id": 1},
            ).to_list(None)
            active_trainee_ids = [str(trainee["_id"]) for trainee in active_trainee_docs]
            progress_docs = await db.progress.find({
                "cohortId": cohort["_id"],
                "traineeId": {"$in": active_trainee_ids},
            }).to_list(None)
            
            avg_progress = (
                sum(p.get("percentComplete", 0) for p in progress_docs) / len(progress_docs)
                if progress_docs else 0
            )
            
            completed_trainees = await db.trainees.count_documents({
                "cohortId": cohort["_id"],
                "status": "completed"
            })
            completion_rate = (completed_trainees / trainees * 100) if trainees > 0 else 0
            
            sessions = await db.sessions.find({
                "cohortId": cohort["_id"]
            }).to_list(None)
            
            total_attendance_records = sum(len(s.get("attendance", [])) for s in sessions)
            session_count = len(sessions)
            attendance_rate = (
                (total_attendance_records / (session_count * 30)) * 100
                if session_count > 0 else 0
            )
            
            batches = await db.batches.count_documents({"cohortId": cohort["_id"]})
            active_batches = await db.batches.count_documents({
                "cohortId": cohort["_id"],
                "status": "active"
            })
            
            metric = CohortPerformanceMetric(
                cohortId=str(cohort["_id"]),
                cohortName=cohort.get("name", "Cohort"),
                totalMentors=mentors,
                totalTrainees=trainees,
                droppedOutTrainees=dropped_out_trainees,
                avgProgress=round(avg_progress, 2),
                completionRate=round(completion_rate, 2),
                attendanceRate=round(attendance_rate, 2),
                activeMentors=mentors,
                activeBatches=active_batches,
                activeSessions=session_count,
                status=cohort.get("status", "active")
            )
            
            cohort_metrics.append(metric)
            total_progress += avg_progress
            total_attendance += attendance_rate
            
            # Track best/worst
            combined_score = avg_progress + completion_rate + attendance_rate
            if combined_score > best_score:
                best_score = combined_score
                best_cohort = metric
            if combined_score < worst_score:
                worst_score = combined_score
                worst_cohort = metric
        
        avg_progress_all = total_progress / len(cohorts) if cohorts else 0
        avg_attendance_all = total_attendance / len(cohorts) if cohorts else 0
        
        return CohortPerformanceAnalytics(
            period=period,
            totalCohorts=len(cohorts),
            activeCohorts=sum(1 for c in cohorts if c.get("status") == "active"),
            cohorts=cohort_metrics,
            bestPerformingCohort=best_cohort,
            lowestPerformingCohort=worst_cohort,
            avgCohortProgress=round(avg_progress_all, 2),
            avgAttendanceRate=round(avg_attendance_all, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cohort performance: {str(e)}")


@router.get("/admin/attendance-trend", response_model=AttendanceTrendAnalytics)
async def get_attendance_trend(
    period: str = Query("month", description="week|month|quarter"),
    cohort_id: str = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get attendance trends over time
    """
    try:
        if period == "week":
            start_date = datetime.utcnow() - timedelta(days=7)
            date_format = "%Y-%m-%d"
        elif period == "quarter":
            start_date = datetime.utcnow() - timedelta(days=90)
            date_format = "%Y-W%U"
        else:  # month
            start_date = datetime.utcnow() - timedelta(days=30)
            date_format = "%Y-%m-%d"
        
        end_date = datetime.utcnow()
        
        query = {"sessionDate": {"$gte": start_date, "$lte": end_date}}
        if cohort_id:
            query["cohortId"] = ObjectId(cohort_id)
        
        sessions = await db.sessions.find(query).sort("sessionDate", 1).to_list(None)
        
        # Group by date
        date_groups = {}
        for session in sessions:
            session_date = session.get("sessionDate", datetime.utcnow())
            date_key = session_date.strftime("%Y-%m-%d")
            
            if date_key not in date_groups:
                date_groups[date_key] = {
                    "sessionCount": 0,
                    "attendanceCount": 0,
                    "presentCount": 0,
                    "absentCount": 0,
                    "excusedCount": 0,
                    "lateCount": 0
                }
            
            date_groups[date_key]["sessionCount"] += 1
            attendance = session.get("attendance", [])
            date_groups[date_key]["attendanceCount"] += len(attendance)
            
            for record in attendance:
                status = record.get("status", "absent")
                if status == "present":
                    date_groups[date_key]["presentCount"] += 1
                elif status == "absent":
                    date_groups[date_key]["absentCount"] += 1
                elif status == "excused":
                    date_groups[date_key]["excusedCount"] += 1
                elif status == "late":
                    date_groups[date_key]["lateCount"] += 1
        
        trend_points = []
        rates = []
        
        for date_str in sorted(date_groups.keys()):
            data = date_groups[date_str]
            attendance_records = (
                data["presentCount"] + data["absentCount"] +
                data["excusedCount"] + data["lateCount"]
            )
            
            attendance_rate = (
                (attendance_records / (data["sessionCount"] * 30)) * 100
                if data["sessionCount"] > 0 else 0
            )
            rates.append(attendance_rate)
            
            trend_points.append(AttendanceTrendPoint(
                date=date_str,
                sessionCount=data["sessionCount"],
                attendanceCount=data["attendanceCount"],
                attendanceRate=round(attendance_rate, 2),
                presentCount=data["presentCount"],
                absentCount=data["absentCount"],
                excusedCount=data["excusedCount"],
                lateCount=data["lateCount"]
            ))
        
        avg_rate = sum(rates) / len(rates) if rates else 0
        highest_rate = max(rates) if rates else 0
        lowest_rate = min(rates) if rates else 0
        
        # Determine trend
        if len(rates) > 1:
            recent_avg = sum(rates[-5:]) / len(rates[-5:])
            older_avg = sum(rates[:-5]) / len(rates[:-5]) if len(rates) > 5 else 0
            if recent_avg > older_avg:
                trend = "improving"
            elif recent_avg < older_avg:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        return AttendanceTrendAnalytics(
            period=period,
            startDate=start_date,
            endDate=end_date,
            trendPoints=trend_points,
            avgAttendanceRate=round(avg_rate, 2),
            highestRate=round(highest_rate, 2),
            lowestRate=round(lowest_rate, 2),
            trend=trend
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance trend: {str(e)}")


@router.get("/admin/attendance-heatmap", response_model=AttendanceHeatmapAnalytics)
async def get_attendance_heatmap(
    cohort_id: str = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get attendance heatmap by day of week and time slot
    """
    try:
        query = {}
        if cohort_id:
            query["cohortId"] = ObjectId(cohort_id)
        
        sessions = await db.sessions.find(query).to_list(None)
        
        # Map sessions to day/time slots
        heatmap_data = {}
        
        for session in sessions:
            session_date = session.get("sessionDate", datetime.utcnow())
            day_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
                session_date.weekday()
            ]
            
            start_time = session.get("startTime", "09:00")
            end_time = session.get("endTime", "10:00")
            time_slot = f"{start_time}-{end_time}"
            
            mentor = await db.users.find_one({"_id": session.get("mentorId")})
            mentor_name = mentor.get("name", "Unknown") if mentor else "Unknown"
            
            cohort = await db.cohorts.find_one({"_id": session.get("cohortId")})
            cohort_name = cohort.get("name", "Cohort") if cohort else "Cohort"
            
            key = f"{day_of_week}_{time_slot}_{cohort_name}_{mentor_name}"
            
            if key not in heatmap_data:
                heatmap_data[key] = {
                    "cohortId": str(session.get("cohortId", "")),
                    "cohortName": cohort_name,
                    "mentorId": str(session.get("mentorId", "")),
                    "mentorName": mentor_name,
                    "dayOfWeek": day_of_week,
                    "timeSlot": time_slot,
                    "sessionCount": 0,
                    "totalAttendance": 0,
                    "presentCount": 0
                }
            
            heatmap_data[key]["sessionCount"] += 1
            attendance = session.get("attendance", [])
            heatmap_data[key]["totalAttendance"] += len(attendance)
            heatmap_data[key]["presentCount"] += sum(
                1 for r in attendance if r.get("status") == "present"
            )
        
        heatmap_points = []
        total_sessions = 0
        total_attendance = 0
        
        for key, data in heatmap_data.items():
            attendance_rate = (
                (data["presentCount"] / data["totalAttendance"] * 100)
                if data["totalAttendance"] > 0 else 0
            )
            
            avg_trainee_count = (
                data["totalAttendance"] / data["sessionCount"]
                if data["sessionCount"] > 0 else 0
            )
            
            heatmap_points.append(HeatmapDataPoint(
                cohortId=data["cohortId"],
                cohortName=data["cohortName"],
                mentorId=data["mentorId"],
                mentorName=data["mentorName"],
                dayOfWeek=data["dayOfWeek"],
                timeSlot=data["timeSlot"],
                sessionCount=data["sessionCount"],
                attendanceRate=round(attendance_rate, 2),
                avgTraineeCount=round(avg_trainee_count, 1)
            ))
            
            total_sessions += data["sessionCount"]
            total_attendance += data["totalAttendance"]
        
        avg_session_attendance = (
            total_attendance / total_sessions if total_sessions > 0 else 0
        )
        
        cohort_name = None
        if cohort_id:
            cohort = await db.cohorts.find_one({"_id": ObjectId(cohort_id)})
            cohort_name = cohort.get("name") if cohort else None
        
        return AttendanceHeatmapAnalytics(
            cohortId=cohort_id,
            cohortName=cohort_name,
            heatmapData=heatmap_points,
            totalSessions=total_sessions,
            avgSessionAttendance=round(avg_session_attendance, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance heatmap: {str(e)}")


@router.get("/admin/batch-details/{batch_id}", response_model=BatchAnalyticsDetail)
async def get_batch_details(
    batch_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get detailed analytics for a specific batch
    """
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        mentor = await db.users.find_one({"_id": batch.get("mentorId")})
        cohort = await db.cohorts.find_one({"_id": batch.get("cohortId")})
        
        trainee_ids = batch.get("traineeIds", [])
        trainees = await db.trainees.find({"_id": {"$in": trainee_ids}}).to_list(None)
        dropped_out_trainees = [t for t in trainees if t.get("status") == "dropped_out"]
        active_trainees = [t for t in trainees if t.get("status") != "dropped_out"]
        
        trainee_details = []
        total_progress = 0
        
        for trainee in trainees:
            progress = await db.progress.find_one({"traineeId": trainee["_id"]})
            percent = progress.get("percentComplete", 0) if progress else 0
            if trainee.get("status") != "dropped_out":
                total_progress += percent
            
            trainee_details.append({
                "traineeId": str(trainee["_id"]),
                "name": trainee.get("name"),
                "email": trainee.get("email"),
                "percentComplete": percent,
                "status": trainee.get("status")
            })
        
        avg_progress = total_progress / len(active_trainees) if active_trainees else 0
        
        sessions = await db.sessions.find({
            "batchId": batch["_id"]
        }).to_list(None)
        
        completed_sessions = sum(
            1 for s in sessions if s.get("status") == "COMPLETED"
        )
        upcoming_sessions = sum(
            1 for s in sessions if s.get("status") == "SCHEDULED"
        )
        
        total_attendance = sum(len(s.get("attendance", [])) for s in sessions)
        total_session_capacity = len(sessions) * batch.get("maxCapacity", 30)
        
        attendance_rate = (
            (total_attendance / total_session_capacity * 100)
            if total_session_capacity > 0 else 0
        )
        
        avg_session_attendance = (
            total_attendance / len(sessions) if sessions else 0
        )
        
        return BatchAnalyticsDetail(
            batchId=str(batch["_id"]),
            batchName=batch.get("name", "Batch"),
            mentorId=str(batch.get("mentorId", "")),
            mentorName=mentor.get("name", "Unknown") if mentor else "Unknown",
            cohortId=str(batch.get("cohortId", "")),
            cohortName=cohort.get("name", "Cohort") if cohort else "Cohort",
            totalTrainees=len(active_trainees),
            droppedOutTrainees=len(dropped_out_trainees),
            trainees=trainee_details,
            totalSessions=len(sessions),
            completedSessions=completed_sessions,
            upcomingSessions=upcoming_sessions,
            avgSessionAttendance=round(avg_session_attendance, 2),
            attendanceRate=round(attendance_rate, 2),
            avgProgress=round(avg_progress, 2),
            createdAt=batch.get("createdAt", datetime.utcnow()),
            startDate=batch.get("startDate"),
            endDate=batch.get("endDate"),
            status=batch.get("status", "active")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching batch details: {str(e)}")


@router.get("/admin/dashboard-full", response_model=AdminDashboardFull)
async def get_full_admin_dashboard(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Get complete admin dashboard with all analytics
    """
    try:
        # Get system stats
        system_stats = await get_admin_dashboard(db=db, current_user=current_user)
        
        # Get attendance metrics
        attendance_metrics = await get_attendance_metrics(db=db, current_user=current_user)
        
        # Get cohort performance
        cohort_performance = await get_cohort_performance(db=db, current_user=current_user)
        
        # Get batch completion top 5
        batches = await db.batches.find({}).sort("_id", -1).limit(5).to_list(None)
        batch_completion_list = []
        
        for batch in batches:
            mentor = await db.users.find_one({"_id": batch.get("mentorId")})
            cohort = await db.cohorts.find_one({"_id": batch.get("cohortId")})
            trainee_ids = batch.get("traineeIds", [])
            
            trainees = await db.trainees.find(
                {"_id": {"$in": trainee_ids}, "status": {"$ne": "dropped_out"}}
            ).to_list(None)
            
            completed = sum(1 for t in trainees if t.get("status") == "completed")
            total_prog = 0
            for t in trainees:
                prog = await db.progress.find_one({"traineeId": t["_id"]})
                if prog:
                    total_prog += prog.get("percentComplete", 0)
            
            avg_prog = (total_prog / len(trainees) * 100) if trainees else 0
            completion_rate = (completed / len(trainees) * 100) if trainees else 0
            
            batch_completion_list.append(BatchCompletionAnalytics(
                batchId=str(batch["_id"]),
                batchName=batch.get("name", "Batch"),
                mentorId=str(batch.get("mentorId", "")),
                mentorName=mentor.get("name", "Unknown") if mentor else "Unknown",
                cohortId=str(batch.get("cohortId", "")),
                cohortName=cohort.get("name", "Cohort") if cohort else "Cohort",
                totalTrainees=len(trainees),
                completedTrainees=completed,
                completionRate=round(completion_rate, 2),
                avgProgress=round(avg_prog, 2),
                status=batch.get("status", "active"),
                startDate=batch.get("startDate"),
                endDate=batch.get("endDate")
            ))
        
        # Get user activity
        user_activity = await get_user_activity(db=db, current_user=current_user)
        
        # Get attendance trend
        attendance_trend = await get_attendance_trend(db=db, current_user=current_user)
        
        return AdminDashboardFull(
            systemStats=system_stats,
            attendanceMetrics=attendance_metrics,
            cohortPerformance=cohort_performance,
            batchCompletionTop5=batch_completion_list,
            userActivity=user_activity,
            attendanceTrend=attendance_trend,
            generatedAt=datetime.utcnow()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating full dashboard: {str(e)}")


@router.post("/admin/export-report")
async def export_report(
    request: ExportRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    """
    Generate and export dashboard report as CSV or PDF
    Returns: file content with appropriate headers
    """
    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        if request.format == "csv":
            # Generate CSV content
            csv_content = generate_csv_report(
                db=db,
                report_type=request.reportType,
                cohort_id=request.cohortId,
                date_from=request.dateFrom,
                date_to=request.dateTo,
                include_charts=request.includeCharts
            )
            
            file_name = f"mcm_report_{request.reportType}_{timestamp}.csv"
            return {
                "fileName": file_name,
                "fileType": "text/csv",
                "fileSize": len(csv_content.encode()),
                "generatedAt": datetime.utcnow().isoformat(),
                "expiresAt": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "content": csv_content  # Return content for download
            }
        else:  # PDF
            file_name = f"mcm_report_{request.reportType}_{timestamp}.pdf"
            return {
                "fileName": file_name,
                "fileType": "application/pdf",
                "fileSize": 0,  # Would be calculated from actual PDF
                "generatedAt": datetime.utcnow().isoformat(),
                "expiresAt": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "message": "PDF export coming soon"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting report: {str(e)}")


def generate_csv_report(
    db,
    report_type: str,
    cohort_id: str = None,
    date_from: datetime = None,
    date_to: datetime = None,
    include_charts: bool = False
) -> str:
    """
    Generate CSV report content based on report type
    """
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    
    if report_type == "summary":
        # Summary report
        writer.writerow(["MCM v2.0 - Admin Dashboard Summary Report"])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([])
        
        writer.writerow(["System Metrics"])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Cohorts", "-"])
        writer.writerow(["Active Cohorts", "-"])
        writer.writerow(["Total Mentors", "-"])
        writer.writerow(["Active Mentors", "-"])
        writer.writerow(["Total Trainees", "-"])
        writer.writerow(["Assigned Trainees", "-"])
        
    elif report_type == "cohorts":
        # Cohort performance report
        writer.writerow(["MCM v2.0 - Cohort Performance Report"])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([])
        
        writer.writerow(["Cohort Name", "Total Trainees", "Completion Rate", "Avg Progress", "Attendance Rate", "Status"])
        
    elif report_type == "attendance":
        # Attendance report
        writer.writerow(["MCM v2.0 - Attendance Report"])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"])
        if cohort_id:
            writer.writerow([f"Cohort ID: {cohort_id}"])
        writer.writerow([])
        
        writer.writerow(["Date", "Sessions", "Attendance Count", "Present %", "Absent %", "Excused %", "Late %"])
        
    elif report_type == "batches":
        # Batch completion report
        writer.writerow(["MCM v2.0 - Batch Completion Report"])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([])
        
        writer.writerow(["Batch Name", "Mentor", "Cohort", "Total Trainees", "Completed", "Completion %", "Avg Progress"])
        
    elif report_type == "detailed":
        # Detailed combined report
        writer.writerow(["MCM v2.0 - Detailed Analytics Report"])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([])
        
        writer.writerow(["SYSTEM OVERVIEW"])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Report Period", f"{date_from or 'All'} to {date_to or 'Now'}"])
        writer.writerow([])
        
        writer.writerow(["COHORT PERFORMANCE"])
        writer.writerow(["Cohort", "Mentors", "Trainees", "Progress", "Completion", "Attendance"])
        writer.writerow([])
        
        writer.writerow(["USER ACTIVITY"])
        writer.writerow(["Period", "Active Users", "Active Mentors", "Active Trainees", "Total Actions"])
    
    # Add footer
    writer.writerow([])
    writer.writerow(["Report Generated By: MCM Admin Dashboard"])
    writer.writerow(["Data may be subject to confidentiality agreements"])
    
    return output.getvalue()
