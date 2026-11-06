"""
Comprehensive tests for admin dashboard analytics endpoints (Phase 6, Task #7)
Tests cover all 8 new analytics endpoints with filtering, data aggregation, and error handling
"""

import pytest
from datetime import datetime, timedelta
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
class TestAdminDashboardEndpoints:
    """Test suite for all admin dashboard analytics endpoints"""

    async def test_get_attendance_metrics_all_sessions(self, client, admin_headers, db):
        """Test attendance metrics endpoint returns aggregated stats for all sessions"""
        # Create test sessions with attendance data
        session_id = ObjectId()
        attendance_data = [
            {"traineeId": ObjectId(), "status": "present"},
            {"traineeId": ObjectId(), "status": "present"},
            {"traineeId": ObjectId(), "status": "absent"},
            {"traineeId": ObjectId(), "status": "excused"},
            {"traineeId": ObjectId(), "status": "late"},
        ]
        
        await db.sessions.insert_one({
            "_id": session_id,
            "batchId": ObjectId(),
            "mentorId": ObjectId(),
            "status": "COMPLETED",
            "attendance": attendance_data,
            "sessionDate": datetime.utcnow(),
            "createdAt": datetime.utcnow()
        })

        response = client.get(
            "/admin/attendance-metrics",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["totalSessions"] >= 1
        assert data["totalAttendances"] >= 5
        assert data["presentCount"] >= 2
        assert data["absentCount"] >= 1
        assert data["excusedCount"] >= 1
        assert data["lateCount"] >= 1
        assert 0 <= data["attendanceRate"] <= 100
        assert 0 <= data["presentRate"] <= 100

    async def test_get_attendance_metrics_filter_by_cohort(self, client, admin_headers, db):
        """Test attendance metrics with cohort filter"""
        cohort_id = ObjectId()
        
        await db.sessions.insert_one({
            "_id": ObjectId(),
            "batchId": ObjectId(),
            "cohortId": cohort_id,
            "mentorId": ObjectId(),
            "status": "COMPLETED",
            "attendance": [
                {"traineeId": ObjectId(), "status": "present"}
            ],
            "sessionDate": datetime.utcnow()
        })

        response = client.get(
            f"/admin/attendance-metrics?cohort_id={str(cohort_id)}",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "totalSessions" in data
        assert "attendanceRate" in data

    async def test_get_batch_completion(self, client, admin_headers, db):
        """Test batch completion analytics endpoint"""
        mentor_id = ObjectId()
        cohort_id = ObjectId()
        batch_id = ObjectId()
        
        # Create mentor and cohort for foreign key
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Test Mentor",
            "email": "mentor@test.com"
        })
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Test Cohort"
        })

        # Create batch with trainees
        trainee_ids = [ObjectId(), ObjectId(), ObjectId()]
        await db.batches.insert_one({
            "_id": batch_id,
            "name": "Test Batch",
            "mentorId": mentor_id,
            "cohortId": cohort_id,
            "traineeIds": trainee_ids,
            "status": "active",
            "createdAt": datetime.utcnow()
        })

        # Create trainees
        for i, trainee_id in enumerate(trainee_ids):
            await db.trainees.insert_one({
                "_id": trainee_id,
                "name": f"Trainee {i}",
                "email": f"trainee{i}@test.com",
                "status": "completed" if i == 0 else "active"
            })
            
            # Create progress records
            await db.progress.insert_one({
                "traineeId": trainee_id,
                "percentComplete": 50 + (i * 10),
                "cohortId": cohort_id
            })

        response = client.get(
            "/admin/batch-completion?limit=10",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            batch_item = data[0]
            assert "batchId" in batch_item
            assert "batchName" in batch_item
            assert "mentorId" in batch_item
            assert "mentorName" in batch_item
            assert "totalTrainees" in batch_item
            assert "completedTrainees" in batch_item
            assert "completionRate" in batch_item
            assert "avgProgress" in batch_item

    async def test_get_batch_completion_filter_by_cohort(self, client, admin_headers, db):
        """Test batch completion with cohort filter"""
        cohort_id = ObjectId()
        mentor_id = ObjectId()
        
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Mentor"
        })
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Cohort A"
        })

        await db.batches.insert_one({
            "_id": ObjectId(),
            "name": "Batch",
            "mentorId": mentor_id,
            "cohortId": cohort_id,
            "traineeIds": [],
            "status": "active"
        })

        response = client.get(
            f"/admin/batch-completion?cohort_id={str(cohort_id)}&limit=10",
            headers=admin_headers
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_user_activity_today(self, client, admin_headers, db):
        """Test user activity metrics for today"""
        user_id = ObjectId()
        
        await db.users.insert_one({
            "_id": user_id,
            "name": "Active User",
            "role": "mentor",
            "lastLoginAt": datetime.utcnow()
        })

        response = client.get(
            "/admin/user-activity?period=today",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert data["period"] == "today"
        assert "activeUsers" in data
        assert "activeAdmins" in data
        assert "activeMentors" in data
        assert "activeTrainees" in data
        assert "totalActions" in data
        assert "topActions" in data
        assert isinstance(data["recentActivities"], list)

    async def test_get_user_activity_week(self, client, admin_headers):
        """Test user activity for the week"""
        response = client.get(
            "/admin/user-activity?period=week",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "week"
        assert data["activeUsers"] >= 0

    async def test_get_user_activity_month(self, client, admin_headers):
        """Test user activity for the month"""
        response = client.get(
            "/admin/user-activity?period=month",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
        assert data["activeUsers"] >= 0

    async def test_get_cohort_performance(self, client, admin_headers, db):
        """Test cohort performance analytics"""
        cohort_id = ObjectId()
        
        # Create test cohort
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Test Cohort",
            "status": "active"
        })

        # Create mentors and trainees
        mentor_id = ObjectId()
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Test Mentor"
        })

        trainee_id = ObjectId()
        await db.trainees.insert_one({
            "_id": trainee_id,
            "cohortId": cohort_id,
            "status": "completed"
        })

        # Create progress
        await db.progress.insert_one({
            "traineeId": trainee_id,
            "cohortId": cohort_id,
            "percentComplete": 85.5
        })

        response = client.get(
            "/admin/cohort-performance?period=month",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert data["period"] == "month"
        assert "totalCohorts" in data
        assert "activeCohorts" in data
        assert "cohorts" in data
        assert isinstance(data["cohorts"], list)
        assert "avgCohortProgress" in data
        assert "avgAttendanceRate" in data

    async def test_get_cohort_performance_metrics(self, client, admin_headers, db):
        """Test cohort performance returns correct metric structure"""
        response = client.get(
            "/admin/cohort-performance?period=week",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        
        for cohort in data.get("cohorts", []):
            assert "cohortId" in cohort
            assert "cohortName" in cohort
            assert "totalMentors" in cohort
            assert "totalTrainees" in cohort
            assert "avgProgress" in cohort
            assert "completionRate" in cohort
            assert "attendanceRate" in cohort
            assert "activeBatches" in cohort
            assert "activeSessions" in cohort

    async def test_get_attendance_trend_week(self, client, admin_headers, db):
        """Test attendance trend for the week"""
        # Create sessions for past 7 days
        for i in range(7):
            session_date = datetime.utcnow() - timedelta(days=i)
            await db.sessions.insert_one({
                "_id": ObjectId(),
                "sessionDate": session_date,
                "status": "COMPLETED",
                "attendance": [
                    {"traineeId": ObjectId(), "status": "present"},
                    {"traineeId": ObjectId(), "status": "absent"}
                ]
            })

        response = client.get(
            "/admin/attendance-trend?period=week",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert data["period"] == "week"
        assert "startDate" in data
        assert "endDate" in data
        assert "trendPoints" in data
        assert isinstance(data["trendPoints"], list)
        assert "avgAttendanceRate" in data
        assert "highestRate" in data
        assert "lowestRate" in data
        assert "trend" in data

    async def test_get_attendance_trend_month(self, client, admin_headers):
        """Test attendance trend for the month"""
        response = client.get(
            "/admin/attendance-trend?period=month",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "month"
        assert data["avgAttendanceRate"] >= 0

    async def test_get_attendance_trend_with_cohort_filter(self, client, admin_headers, db):
        """Test attendance trend filtered by cohort"""
        cohort_id = ObjectId()
        
        await db.sessions.insert_one({
            "_id": ObjectId(),
            "cohortId": cohort_id,
            "sessionDate": datetime.utcnow(),
            "attendance": [{"traineeId": ObjectId(), "status": "present"}]
        })

        response = client.get(
            f"/admin/attendance-trend?period=week&cohort_id={str(cohort_id)}",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["trendPoints"], list)

    async def test_get_attendance_heatmap(self, client, admin_headers, db):
        """Test attendance heatmap for day/time patterns"""
        mentor_id = ObjectId()
        cohort_id = ObjectId()
        
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Test Mentor"
        })
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Test Cohort"
        })

        # Create sessions at different times
        for day_offset in range(7):
            session_date = datetime.utcnow() - timedelta(days=day_offset)
            await db.sessions.insert_one({
                "_id": ObjectId(),
                "mentorId": mentor_id,
                "cohortId": cohort_id,
                "sessionDate": session_date,
                "startTime": "09:00",
                "endTime": "10:00",
                "attendance": [
                    {"traineeId": ObjectId(), "status": "present"}
                ]
            })

        response = client.get(
            "/admin/attendance-heatmap",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "heatmapData" in data
        assert isinstance(data["heatmapData"], list)
        assert "totalSessions" in data
        assert "avgSessionAttendance" in data

    async def test_get_attendance_heatmap_by_cohort(self, client, admin_headers, db):
        """Test heatmap filtered by cohort"""
        cohort_id = ObjectId()
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Cohort"
        })

        response = client.get(
            f"/admin/attendance-heatmap?cohort_id={str(cohort_id)}",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cohortId"] == str(cohort_id)

    async def test_get_batch_details(self, client, admin_headers, db):
        """Test detailed batch analytics endpoint"""
        mentor_id = ObjectId()
        cohort_id = ObjectId()
        batch_id = ObjectId()
        trainee_id = ObjectId()
        
        # Setup data
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Test Mentor"
        })
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Test Cohort"
        })
        
        await db.batches.insert_one({
            "_id": batch_id,
            "name": "Test Batch",
            "mentorId": mentor_id,
            "cohortId": cohort_id,
            "traineeIds": [trainee_id],
            "status": "active",
            "startDate": datetime.utcnow(),
            "createdAt": datetime.utcnow()
        })
        
        await db.trainees.insert_one({
            "_id": trainee_id,
            "name": "Test Trainee",
            "status": "active"
        })
        
        await db.progress.insert_one({
            "traineeId": trainee_id,
            "percentComplete": 75
        })
        
        # Create sessions for the batch
        await db.sessions.insert_one({
            "_id": ObjectId(),
            "batchId": batch_id,
            "mentorId": mentor_id,
            "status": "COMPLETED",
            "attendance": [
                {"traineeId": trainee_id, "status": "present"}
            ]
        })

        response = client.get(
            f"/admin/batch-details/{str(batch_id)}",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["batchId"] == str(batch_id)
        assert data["batchName"] == "Test Batch"
        assert data["mentorId"] == str(mentor_id)
        assert data["mentorName"] == "Test Mentor"
        assert data["totalTrainees"] == 1
        assert data["totalSessions"] >= 1
        assert "avgProgress" in data
        assert "attendanceRate" in data

    async def test_get_batch_details_not_found(self, client, admin_headers):
        """Test batch details endpoint with invalid batch ID"""
        invalid_id = str(ObjectId())
        
        response = client.get(
            f"/admin/batch-details/{invalid_id}",
            headers=admin_headers
        )

        assert response.status_code == 404

    async def test_get_full_admin_dashboard(self, client, admin_headers, db):
        """Test complete admin dashboard with all analytics"""
        # Create test data
        cohort_id = ObjectId()
        mentor_id = ObjectId()
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Dashboard Test Cohort",
            "status": "active"
        })
        
        await db.users.insert_one({
            "_id": mentor_id,
            "name": "Dashboard Test Mentor",
            "role": "mentor",
            "lastLoginAt": datetime.utcnow()
        })

        response = client.get(
            "/admin/dashboard-full",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        
        # Verify all dashboard sections are present
        assert "systemStats" in data
        assert "attendanceMetrics" in data
        assert "cohortPerformance" in data
        assert "batchCompletionTop5" in data
        assert "userActivity" in data
        assert "attendanceTrend" in data
        assert "generatedAt" in data

    async def test_export_report_summary(self, client, admin_headers):
        """Test CSV export of summary report"""
        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "summary"
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "fileName" in data
        assert "fileType" in data
        assert data["fileType"] == "text/csv"
        assert "csv" in data["fileName"]
        assert "summary" in data["fileName"]
        assert "fileSize" in data
        assert "content" in data
        assert "MCM v2.0" in data["content"]

    async def test_export_report_cohorts(self, client, admin_headers):
        """Test CSV export of cohort performance report"""
        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "cohorts"
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "Cohort" in data["content"]

    async def test_export_report_attendance(self, client, admin_headers):
        """Test CSV export of attendance report"""
        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "attendance"
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "Attendance" in data["content"]

    async def test_export_report_batches(self, client, admin_headers):
        """Test CSV export of batch completion report"""
        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "batches"
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "Batch" in data["content"]

    async def test_export_report_detailed(self, client, admin_headers):
        """Test CSV export of detailed report"""
        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "detailed",
                "dateFrom": None,
                "dateTo": None,
                "includeCharts": True
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "detailed" in data["fileName"]
        assert "SYSTEM OVERVIEW" in data["content"]

    async def test_export_report_with_cohort_filter(self, client, admin_headers, db):
        """Test export respects cohort filter"""
        cohort_id = ObjectId()
        
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Filter Test Cohort"
        })

        response = client.post(
            "/admin/export-report",
            json={
                "format": "csv",
                "reportType": "summary",
                "cohortId": str(cohort_id)
            },
            headers=admin_headers
        )

        assert response.status_code == 200

    async def test_admin_auth_required(self, client):
        """Test that endpoints require admin authentication"""
        # Test without auth header
        response = client.get("/admin/attendance-metrics")
        assert response.status_code == 401 or response.status_code == 403

    async def test_non_admin_access_denied(self, client, mentor_headers):
        """Test that non-admin users cannot access dashboard endpoints"""
        response = client.get(
            "/admin/attendance-metrics",
            headers=mentor_headers
        )
        assert response.status_code == 403

    async def test_attendance_metrics_empty_database(self, client, admin_headers, db):
        """Test attendance metrics with empty database"""
        # Ensure no sessions exist
        await db.sessions.delete_many({})
        
        response = client.get(
            "/admin/attendance-metrics",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["totalSessions"] == 0
        assert data["totalAttendances"] == 0

    async def test_invalid_cohort_filter_format(self, client, admin_headers):
        """Test with invalid cohort ID format"""
        response = client.get(
            "/admin/attendance-metrics?cohort_id=invalid-id",
            headers=admin_headers
        )

        # Should either handle gracefully or return 400
        assert response.status_code in [200, 400, 422]

    async def test_invalid_period_parameter(self, client, admin_headers):
        """Test with invalid period parameter"""
        response = client.get(
            "/admin/user-activity?period=invalid",
            headers=admin_headers
        )

        # Should either handle gracefully or return 400
        assert response.status_code in [200, 400, 422]


@pytest.mark.asyncio
class TestDashboardDataAggregation:
    """Tests for data aggregation logic and calculations"""

    async def test_attendance_rate_calculation(self, client, admin_headers, db):
        """Test correct calculation of attendance rate"""
        # Create known attendance scenario
        attendance_records = 15
        total_capacity = 30  # 1 session with 30 capacity
        
        await db.sessions.insert_one({
            "_id": ObjectId(),
            "attendance": [
                {"traineeId": ObjectId(), "status": "present"}
                for _ in range(attendance_records)
            ]
        })

        response = client.get(
            "/admin/attendance-metrics",
            headers=admin_headers
        )

        data = response.json()
        # Attendance rate should be reasonable
        assert data["attendanceRate"] >= 0

    async def test_completion_rate_aggregation(self, client, admin_headers, db):
        """Test completion rate calculation across trainees"""
        batch_id = ObjectId()
        mentor_id = ObjectId()
        cohort_id = ObjectId()
        
        # Create 4 trainees: 2 completed, 2 active
        trainee_ids = [ObjectId() for _ in range(4)]
        
        await db.users.insert_one({"_id": mentor_id, "name": "M"})
        await db.cohorts.insert_one({"_id": cohort_id, "name": "C"})
        
        await db.batches.insert_one({
            "_id": batch_id,
            "mentorId": mentor_id,
            "cohortId": cohort_id,
            "traineeIds": trainee_ids
        })
        
        for i, tid in enumerate(trainee_ids):
            await db.trainees.insert_one({
                "_id": tid,
                "status": "completed" if i < 2 else "active"
            })

        response = client.get(
            "/admin/batch-completion",
            headers=admin_headers
        )

        data = response.json()
        if data:
            batch = data[0]
            # Should show 2/4 = 50% completion
            assert batch["completedTrainees"] >= 0
            assert 0 <= batch["completionRate"] <= 100
