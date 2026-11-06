import pytest
from bson import ObjectId

@pytest.mark.asyncio
async def test_role_based_access_control(
    client, admin_headers, nominator_headers, nominator_user,
    mentor_headers, mentor_user, test_db
):
    # 1. Unauthenticated requests should be rejected
    unauth_res = await client.get("/api/cohorts")
    assert unauth_res.status_code == 401
    assert unauth_res.json()["code"] == "UNAUTHORIZED"

    # 2. Nominator cannot create a cohort (admin only)
    c_nom_res = await client.post("/api/cohorts", json={
        "name": "Nominator Cohort",
        "startDate": "2026-05-01",
        "endDate": "2026-05-31",
        "nominatorIds": []
    }, headers=nominator_headers)
    assert c_nom_res.status_code == 403
    assert c_nom_res.json()["code"] == "FORBIDDEN"

    # 3. Admin creates two cohorts: Cohort A (nominator assigned) and Cohort B (nominator NOT assigned)
    c_a_res = await client.post("/api/cohorts", json={
        "name": "Cohort A (Assigned)",
        "startDate": "2026-05-01",
        "endDate": "2026-05-31",
        "nominatorIds": [nominator_user["id"]]
    }, headers=admin_headers)
    cohort_a_id = c_a_res.json()["id"]

    c_b_res = await client.post("/api/cohorts", json={
        "name": "Cohort B (Unassigned)",
        "startDate": "2026-05-01",
        "endDate": "2026-05-31",
        "nominatorIds": []
    }, headers=admin_headers)
    cohort_b_id = c_b_res.json()["id"]

    # 4. Nominator lists cohorts -> sees only Cohort A
    nom_cohorts_res = await client.get("/api/cohorts", headers=nominator_headers)
    assert nom_cohorts_res.status_code == 200
    cohort_ids_seen = [c["id"] for c in nom_cohorts_res.json()["items"]]
    assert cohort_a_id in cohort_ids_seen
    assert cohort_b_id not in cohort_ids_seen

    # 5. Nominator tries to access Cohort B details -> 403 Forbidden
    nom_access_b = await client.get(f"/api/cohorts/{cohort_b_id}", headers=nominator_headers)
    assert nom_access_b.status_code == 403

    # 6. Nominator cannot nominate in Cohort B
    nom_nominate_b = await client.post(f"/api/cohorts/{cohort_b_id}/mentors", json={
        "name": "Unauthorized Nominee",
        "email": "unauth@example.com",
        "department": "Security"
    }, headers=nominator_headers)
    assert nom_nominate_b.status_code == 403

    # 7. Nominator nominates in Cohort A -> Success
    nom_nominate_a = await client.post(f"/api/cohorts/{cohort_a_id}/mentors", json={
        "name": "Authorized Mentor Nominee",
        "email": "auth.mentor@example.com",
        "department": "Engineering"
    }, headers=nominator_headers)
    assert nom_nominate_a.status_code == 200

    # 8. Mentor can only see their own trainees
    # Create another mentor user
    m2_user = {
        "name": "Other Mentor",
        "email": "other.mentor@test.com",
        "role": "mentor",
        "isActive": True
    }
    m2_res = await test_db.users.insert_one(m2_user)
    m2_user_id = str(m2_res.inserted_id)

    # Nominate m1 and m2 in cohort A
    m1_nom = await test_db.mentors.insert_one({
        "cohortId": cohort_a_id, "nominatedBy": nominator_user["id"],
        "name": "M1", "email": mentor_user["email"], "department": "Dev",
        "userId": mentor_user["id"]
    })
    m1_id = str(m1_nom.inserted_id)

    m2_nom = await test_db.mentors.insert_one({
        "cohortId": cohort_a_id, "nominatedBy": nominator_user["id"],
        "name": "M2", "email": m2_user["email"], "department": "Dev",
        "userId": m2_user_id
    })
    m2_id = str(m2_nom.inserted_id)

    # Create trainee assigned to M2
    t2 = await test_db.trainees.insert_one({
        "cohortId": cohort_a_id, "nominatedBy": nominator_user["id"],
        "name": "Trainee of M2", "email": "t2@example.com",
        "employeeId": "EMP-2", "department": "Dev", "mentorId": m2_id
    })
    t2_id = str(t2.inserted_id)

    # Logged in mentor M1 attempts to view T2 details -> 403 Forbidden!
    m1_view_t2 = await client.get(f"/api/mentor/trainees/{t2_id}", headers=mentor_headers)
    assert m1_view_t2.status_code == 403
    assert m1_view_t2.json()["code"] == "FORBIDDEN"
