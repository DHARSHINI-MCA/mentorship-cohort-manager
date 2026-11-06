import pytest
from httpx import AsyncClient
from app.main import app
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_update_cohort_plan_with_edited_weeks():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        admin_token = create_access_token(data={"sub": "admin", "role": "admin"})
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # 1. Get cohorts
        res = await ac.get("/api/cohorts", headers=headers)
        assert res.status_code == 200
        cohorts = res.json()
        if not cohorts:
            return
        cohort = cohorts[0]
        cohort_id = cohort["id"]
        
        # 2. Get active plan
        plan_res = await ac.get(f"/api/cohorts/{cohort_id}/plan", headers=headers)
        if plan_res.status_code != 200:
            return
        plan = plan_res.json()
        current_weeks = plan.get("weeks", [])
        assert len(current_weeks) >= 1
        
        # 3. Modify week 1 title and add a course module
        modified_weeks = []
        for w in current_weeks:
            courses = [
                {"title": c["title"], "durationHrs": c.get("durationHrs", 1.0), "description": c.get("description", "")}
                for c in w.get("courses", [])
            ]
            if w["weekNumber"] == 1:
                courses.append({
                    "title": "Custom Edited Module 101",
                    "durationHrs": 2.5,
                    "description": "Added via Edit Weeks modal"
                })
            modified_weeks.append({
                "weekNumber": w["weekNumber"],
                "title": f"Updated Week {w['weekNumber']}",
                "isBuffer": w.get("isBuffer", False),
                "courses": courses
            })
        
        # 4. PUT updated plan
        update_res = await ac.put(
            f"/api/cohorts/{cohort_id}/plan",
            headers=headers,
            json={
                "name": plan["name"],
                "totalWeeks": len(modified_weeks),
                "weeks": modified_weeks
            }
        )
        assert update_res.status_code == 200
        updated_data = update_res.json()
        assert updated_data["weeks"][0]["title"] == "Updated Week 1"
        assert any(c["title"] == "Custom Edited Module 101" for c in updated_data["weeks"][0]["courses"])
