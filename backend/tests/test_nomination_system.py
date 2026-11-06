"""
Tests for enhanced nomination system with location/timezone support
"""
import pytest
from bson import ObjectId
from datetime import datetime


@pytest.mark.asyncio
class TestMentorNomination:
    """Test mentor nomination endpoints"""

    async def test_nominate_mentor_success(self, client, db, nominator_user, cohort_id):
        """Test successfully nominating a mentor"""
        response = await client.post(
            f"/api/nominations/mentors?cohort_id={cohort_id}",
            json={
                "name": "Dr. John Mentor",
                "email": "john.mentor@example.com",
                "department": "Engineering",
                "employeeId": "EMP-001",
                "location": "San Francisco, USA",
                "timezone": "PST",
                "experience": "15+ years",
                "skills": ["Python", "JavaScript", "System Design"]
            },
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Dr. John Mentor"
        assert data["email"] == "john.mentor@example.com"
        assert data["location"] == "San Francisco, USA"
        assert data["timezone"] == "PST"
        assert data["status"] == "pending"
        assert len(data["skills"]) == 3

    async def test_nominate_mentor_with_required_fields_only(self, client, db, nominator_user, cohort_id):
        """Test nominating mentor with minimum required fields"""
        response = await client.post(
            f"/api/nominations/mentors?cohort_id={cohort_id}",
            json={
                "name": "Jane Developer",
                "email": "jane@example.com",
                "department": "Product"
            },
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["location"] is None
        assert data["timezone"] is None

    async def test_nominate_mentor_duplicate_error(self, client, db, nominator_user, cohort_id):
        """Test that duplicate nominations are rejected"""
        mentor_data = {
            "name": "Test Mentor",
            "email": "test@example.com",
            "department": "Engineering"
        }
        
        # First nomination
        response1 = await client.post(
            f"/api/nominations/mentors?cohort_id={cohort_id}",
            json=mentor_data,
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        assert response1.status_code == 200
        
        # Duplicate nomination
        response2 = await client.post(
            f"/api/nominations/mentors?cohort_id={cohort_id}",
            json=mentor_data,
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        assert response2.status_code == 409
        assert "DUPLICATE_NOMINATION" in response2.json()["code"]

    async def test_nominate_mentor_invalid_cohort(self, client, nominator_user):
        """Test nominating to non-existent cohort"""
        response = await client.post(
            "/api/nominations/mentors?cohort_id=invalidid",
            json={
                "name": "Test Mentor",
                "email": "test@example.com",
                "department": "Engineering"
            },
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 404

    async def test_nominate_mentor_unauthorized(self, client, db, random_nominator, cohort_id):
        """Test that nominator without cohort access cannot nominate"""
        # Create a cohort NOT assigned to this nominator
        other_cohort = await db.cohorts.insert_one({
            "name": "Other Cohort",
            "nominatorIds": ["other_nominator_id"],
            "createdAt": datetime.utcnow()
        })
        
        response = await client.post(
            f"/api/nominations/mentors?cohort_id={str(other_cohort.inserted_id)}",
            json={
                "name": "Test Mentor",
                "email": "test@example.com",
                "department": "Engineering"
            },
            headers={"Authorization": f"Bearer {random_nominator['token']}"}
        )
        
        assert response.status_code == 403


@pytest.mark.asyncio
class TestTraineeNomination:
    """Test trainee nomination endpoints"""

    async def test_nominate_trainee_success(self, client, nominator_user, cohort_id):
        """Test successfully nominating a trainee"""
        response = await client.post(
            f"/api/nominations/trainees?cohort_id={cohort_id}",
            json={
                "name": "Alice Trainee",
                "email": "alice@example.com",
                "employeeId": "EMP-100",
                "department": "Engineering",
                "location": "New York, USA",
                "timezone": "EST",
                "experience": "2 years in development",
                "skills": ["JavaScript", "React"]
            },
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Alice Trainee"
        assert data["email"] == "alice@example.com"
        assert data["location"] == "New York, USA"
        assert data["timezone"] == "EST"
        assert data["status"] == "pending"

    async def test_nominate_trainee_duplicate_error(self, client, nominator_user, cohort_id):
        """Test that duplicate trainee nominations are rejected"""
        trainee_data = {
            "name": "Bob Trainee",
            "email": "bob@example.com",
            "employeeId": "EMP-200",
            "department": "Product"
        }
        
        # First nomination
        response1 = await client.post(
            f"/api/nominations/trainees?cohort_id={cohort_id}",
            json=trainee_data,
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        assert response1.status_code == 200
        
        # Duplicate
        response2 = await client.post(
            f"/api/nominations/trainees?cohort_id={cohort_id}",
            json=trainee_data,
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        assert response2.status_code == 409


@pytest.mark.asyncio
class TestNominationSearch:
    """Test mentor/trainee search functionality"""

    async def test_search_mentors_by_name(self, client, db, nominator_user, cohort_id):
        """Test searching mentors by name"""
        # Create test mentors
        await db.mentors.insert_one({
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(nominator_user["id"]),
            "name": "Alice Engineer",
            "email": "alice@example.com",
            "department": "Engineering",
            "location": "SF",
            "timezone": "PST",
            "status": "approved"
        })
        
        await db.mentors.insert_one({
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(nominator_user["id"]),
            "name": "Bob Manager",
            "email": "bob@example.com",
            "department": "Management",
            "location": "NYC",
            "timezone": "EST",
            "status": "approved"
        })
        
        # Search for Alice
        response = await client.get(
            f"/api/nominations/mentors/search?cohort_id={cohort_id}&query=Alice",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Alice Engineer"

    async def test_search_mentors_by_location(self, client, db, nominator_user, cohort_id):
        """Test filtering mentors by location"""
        # Create mentors with different locations
        for i, location in enumerate(["San Francisco", "New York", "San Francisco"]):
            await db.mentors.insert_one({
                "cohortId": ObjectId(cohort_id),
                "nominatedBy": ObjectId(nominator_user["id"]),
                "name": f"Mentor {i}",
                "email": f"mentor{i}@example.com",
                "department": "Engineering",
                "location": location,
                "timezone": "PST" if location == "San Francisco" else "EST",
                "status": "approved"
            })
        
        # Filter by location
        response = await client.get(
            f"/api/nominations/mentors/search?cohort_id={cohort_id}&location=San+Francisco",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        for item in data["items"]:
            assert item["location"] == "San Francisco"

    async def test_search_mentors_by_timezone(self, client, db, nominator_user, cohort_id):
        """Test filtering mentors by timezone"""
        # Create mentors with different timezones
        for tz in ["PST", "EST", "PST"]:
            await db.mentors.insert_one({
                "cohortId": ObjectId(cohort_id),
                "nominatedBy": ObjectId(nominator_user["id"]),
                "name": f"Mentor {tz}",
                "email": f"mentor{tz}@example.com",
                "department": "Engineering",
                "timezone": tz,
                "status": "approved"
            })
        
        # Filter by timezone
        response = await client.get(
            f"/api/nominations/mentors/search?cohort_id={cohort_id}&timezone=PST",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    async def test_search_trainees(self, client, db, nominator_user, cohort_id):
        """Test searching trainees"""
        # Create test trainees
        await db.trainees.insert_one({
            "cohortId": ObjectId(cohort_id),
            "nominatedBy": ObjectId(nominator_user["id"]),
            "name": "Charlie Student",
            "email": "charlie@example.com",
            "employeeId": "EMP-300",
            "department": "Product",
            "location": "Boston",
            "timezone": "EST",
            "status": "approved"
        })
        
        # Search
        response = await client.get(
            f"/api/nominations/trainees/search?cohort_id={cohort_id}&query=Charlie",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1


@pytest.mark.asyncio
class TestLocationTimezoneFilters:
    """Test location and timezone filter endpoints"""

    async def test_get_all_locations(self, client, db, nominator_user, cohort_id):
        """Test getting unique locations in a cohort"""
        # Insert mentors and trainees with various locations
        locations = ["San Francisco", "New York", "London", "San Francisco", "Tokyo"]
        for i, location in enumerate(locations):
            if i < 3:
                await db.mentors.insert_one({
                    "cohortId": ObjectId(cohort_id),
                    "location": location,
                    "status": "approved"
                })
            else:
                await db.trainees.insert_one({
                    "cohortId": ObjectId(cohort_id),
                    "location": location,
                    "status": "approved"
                })
        
        # Get locations
        response = await client.get(
            f"/api/nominations/locations?cohort_id={cohort_id}",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["locations"]) == 4  # Unique locations

    async def test_get_all_timezones(self, client, db, nominator_user, cohort_id):
        """Test getting unique timezones in a cohort"""
        # Insert mentors and trainees with various timezones
        timezones = ["PST", "EST", "GMT", "PST", "IST"]
        for i, tz in enumerate(timezones):
            if i < 3:
                await db.mentors.insert_one({
                    "cohortId": ObjectId(cohort_id),
                    "timezone": tz,
                    "status": "approved"
                })
            else:
                await db.trainees.insert_one({
                    "cohortId": ObjectId(cohort_id),
                    "timezone": tz,
                    "status": "approved"
                })
        
        # Get timezones
        response = await client.get(
            f"/api/nominations/timezones?cohort_id={cohort_id}",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["timezones"]) == 4  # Unique timezones


@pytest.mark.asyncio
class TestMentorTraineeMatching:
    """Test mentor-trainee matching based on location/timezone"""

    async def test_get_matching_trainees(self, client, db, nominator_user, cohort_id):
        """Test finding matching trainees for a mentor"""
        # Create a mentor
        mentor_result = await db.mentors.insert_one({
            "cohortId": ObjectId(cohort_id),
            "name": "Expert Mentor",
            "email": "expert@example.com",
            "location": "San Francisco",
            "timezone": "PST",
            "status": "approved"
        })
        mentor_id = str(mentor_result.inserted_id)
        
        # Create trainees with different location/timezone combinations
        # Perfect match (same location and timezone)
        await db.trainees.insert_one({
            "cohortId": ObjectId(cohort_id),
            "name": "Perfect Match",
            "email": "perfect@example.com",
            "location": "San Francisco",
            "timezone": "PST",
            "status": "approved",
            "mentorId": None
        })
        
        # Location match only
        await db.trainees.insert_one({
            "cohortId": ObjectId(cohort_id),
            "name": "Location Match",
            "email": "location@example.com",
            "location": "San Francisco",
            "timezone": "EST",
            "status": "approved",
            "mentorId": None
        })
        
        # Timezone match only
        await db.trainees.insert_one({
            "cohortId": ObjectId(cohort_id),
            "name": "Timezone Match",
            "email": "timezone@example.com",
            "location": "New York",
            "timezone": "PST",
            "status": "approved",
            "mentorId": None
        })
        
        # No match
        await db.trainees.insert_one({
            "cohortId": ObjectId(cohort_id),
            "name": "No Match",
            "email": "nomatch@example.com",
            "location": "London",
            "timezone": "GMT",
            "status": "approved",
            "mentorId": None
        })
        
        # Get matches
        response = await client.get(
            f"/api/nominations/mentor-trainee-matching/{mentor_id}?cohort_id={cohort_id}",
            headers={"Authorization": f"Bearer {nominator_user['token']}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        matches = data["matches"]
        
        # Verify priority: perfect match first, then location, then timezone
        assert matches[0]["name"] == "Perfect Match"
        assert matches[0]["matchPriority"] == 3
        
        assert matches[1]["name"] == "Location Match"
        assert matches[1]["matchPriority"] == 2
        
        assert matches[2]["name"] == "Timezone Match"
        assert matches[2]["matchPriority"] == 1
