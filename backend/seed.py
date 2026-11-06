"""Reset the configured MongoDB database and populate current demo data.

Run explicitly with ``python seed.py`` or the Compose ``demo-seed`` profile.
This script is destructive: it clears the application collections first.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import get_password_hash


def oid() -> ObjectId:
    return ObjectId()


async def run_seed() -> None:
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=10_000,
    )
    try:
        await client.admin.command("ping")
        db = client[settings.DATABASE_NAME]
        print(f"Connected to MongoDB database '{settings.DATABASE_NAME}'.")

        # Clear every collection populated by this script, including data added
        # by newer features, so reruns do not leave orphaned sessions or batches.
        reset_collections = [
            "users", "cohorts", "mentors", "trainees", "nominators", "nominees",
            "trainingTemplates", "cohortTrainingPlans", "feedbackTemplates",
            "cohortFeedbackForms", "progress", "feedbackResponses",
            "talentnextCourses", "talentnextProgress", "batches", "sessions",
            "attendance", "activity_logs",
        ]
        for collection in reset_collections:
            await db[collection].delete_many({})
        print("Cleared demo collections.")

        now = datetime.now(timezone.utc)
        cohort_id = oid()
        training_template_id = oid()
        feedback_template_id = oid()

        admin_id = oid()
        nominator_id = oid()
        users = [
            {
                "_id": admin_id,
                "name": "Platform Administrator",
                "email": "admin@example.com",
                "passwordHash": get_password_hash("Admin@123"),
                "role": "admin",
                "isActive": True,
                "firstLoginPasswordReset": False,
                "createdAt": now,
            },
            {
                "_id": nominator_id,
                "name": "Demo Nominator",
                "email": "nominator@example.com",
                "employeeId": "EMP-NOM-01",
                "passwordHash": get_password_hash("Nominator@123"),
                "role": "nominator",
                "isActive": True,
                "firstLoginPasswordReset": False,
                "createdAt": now,
            },
        ]

        mentors_data = [
            {"name": "Sarah Jenkins", "email": "sarah.jenkins@example.com", "employeeId": "EMP-MTR-01", "department": "Frontend Engineering", "location": "Bengaluru, India", "timezone": "Asia/Kolkata"},
            {"name": "David Chen", "email": "david.chen@example.com", "employeeId": "EMP-MTR-02", "department": "Backend Core", "location": "San Francisco, USA", "timezone": "America/Los_Angeles"},
            {"name": "Elena Rodriguez", "email": "elena.rodriguez@example.com", "employeeId": "EMP-MTR-03", "department": "Data & Machine Learning", "location": "New York, USA", "timezone": "America/New_York"},
        ]
        mentor_profiles = []
        mentor_users = []
        for index, values in enumerate(mentors_data):
            user_id = oid()
            profile_id = oid()
            mentor_users.append(user_id)
            mentor_profiles.append(profile_id)
            users.append({
                "_id": user_id,
                "name": values["name"],
                "email": values["email"],
                "employeeId": values["employeeId"],
                "passwordHash": get_password_hash("Mentor@123"),
                "role": "mentor",
                "isActive": True,
                "firstLoginPasswordReset": False,
                "createdAt": now,
            })

        await db.users.insert_many(users)

        # Course definitions with stable IDs referenced by progress and reports.
        curriculum = [
            ("Week 1: Architecture & Git Workflows", False, [
                ("Dev Environment & Repository Setup", "Configure the development environment and repositories.", 3.0),
                ("Git Flow, Code Reviews & Pull Requests", "Branching, pull requests, and peer review.", 4.0),
                ("High-Level Architecture Overview", "Services, APIs, caching, and data architecture.", 5.0),
            ]),
            ("Week 2: Backend APIs & Data Pipelines", False, [
                ("RESTful API Standards & Validation", "REST design, response codes, and validation.", 4.5),
                ("Database Optimization & Indexes", "Query performance and index design.", 6.0),
                ("Asynchronous Processing & Background Tasks", "Async work and background processing.", 4.0),
            ]),
            ("Week 3: Testing & Quality Assurance", False, [
                ("Unit & Integration Testing", "Fixtures, integration tests, and coverage.", 5.0),
                ("Automated CI/CD Workflows", "Builds, linting, and deployment pipelines.", 4.0),
                ("Security, Auth & Secret Hygiene", "Authentication and secure secret handling.", 4.5),
            ]),
            ("Week 4: Capstone & Reflection", True, [
                ("Capstone Project Presentation", "Present and review a small engineering project.", 6.0),
                ("Learning Reflection & Next Steps", "Reflect on progress and define next steps.", 2.0),
            ]),
        ]
        template_weeks = []
        plan_weeks = []
        flat_courses = []
        for week_number, (week_title, is_buffer, courses) in enumerate(curriculum, start=1):
            template_courses = []
            plan_courses = []
            for title, description, hours in courses:
                course_id = str(oid())
                template_courses.append({
                    "courseId": course_id,
                    "title": title,
                    "description": description,
                    "durationHrs": hours,
                })
                plan_courses.append({
                    "courseId": course_id,
                    "title": title,
                    "description": description,
                    "durationHrs": hours,
                })
                flat_courses.append((week_number, course_id, title))
            week = {
                "weekNumber": week_number,
                "title": week_title,
                "isBuffer": is_buffer,
                "courses": template_courses,
            }
            template_weeks.append(week)
            plan_weeks.append({**week, "courses": plan_courses})

        await db.trainingTemplates.insert_one({
            "_id": training_template_id,
            "name": "Software Engineering Foundations",
            "totalWeeks": 4,
            "weeks": template_weeks,
            "createdAt": now,
        })

        feedback_fields = [
            {"key": "rating_technical", "label": "Technical Competence & Execution (1-5)", "type": "rating", "options": [], "required": True},
            {"key": "rating_velocity", "label": "Learning Velocity & Autonomy (1-5)", "type": "rating", "options": [], "required": True},
            {"key": "collaboration_status", "label": "Team Collaboration & Communication", "type": "select", "options": ["Exceeding Expectations", "Meeting Expectations", "Needs Improvement"], "required": True},
            {"key": "text_strengths", "label": "Key Highlights & Accomplishments", "type": "text", "options": [], "required": True},
            {"key": "text_growth_areas", "label": "Focus Areas & Recommended Action Items", "type": "text", "options": [], "required": False},
        ]
        await db.feedbackTemplates.insert_one({
            "_id": feedback_template_id,
            "name": "Weekly Mentorship Progress & Growth Evaluation",
            "fields": feedback_fields,
            "createdAt": now,
        })

        talent_courses = [
            {"_id": oid(), "name": name, "createdAt": now}
            for name in ["DevOps Basics", "Java Fundamentals", "Spring Boot Masterclass", "Microservices Architecture", "Kubernetes Essentials", "AWS Cloud Services"]
        ]
        await db.talentnextCourses.insert_many(talent_courses)

        plan_id = oid()
        feedback_form_id = oid()
        await db.cohortTrainingPlans.insert_one({
            "_id": plan_id,
            "cohortId": str(cohort_id),
            "name": "Software Engineering Foundations",
            "totalWeeks": 4,
            "coreWeeks": 3,
            "bufferWeeks": 1,
            "weeks": plan_weeks,
            "createdAt": now,
        })
        await db.cohortFeedbackForms.insert_one({
            "_id": feedback_form_id,
            "cohortId": str(cohort_id),
            "name": "Weekly Mentorship Progress & Growth Evaluation",
            "fields": feedback_fields,
            "createdAt": now,
        })

        course_assignments = [
            {"courseId": str(talent_courses[0]["_id"]), "isMandatory": True},
            {"courseId": str(talent_courses[1]["_id"]), "isMandatory": True},
            {"courseId": str(talent_courses[3]["_id"]), "isMandatory": False},
        ]
        await db.cohorts.insert_one({
            "_id": cohort_id,
            "name": "Fall 2026 Engineering Cohort",
            "description": "Accelerated onboarding mentorship cohort for newly hired software engineers across product squads.",
            "startDate": "2026-11-01",
            "endDate": "2026-11-28",
            "status": "active",
            "nominatorIds": [str(nominator_id)],
            "trainingPlanId": str(plan_id),
            "feedbackFormId": str(feedback_form_id),
            "talentnextCourses": course_assignments,
            "createdBy": str(admin_id),
            "createdAt": now,
        })

        for profile_id, user_id, values in zip(mentor_profiles, mentor_users, mentors_data):
            await db.mentors.insert_one({
                "_id": profile_id,
                "cohortId": str(cohort_id),
                "nominatedBy": str(nominator_id),
                "userId": str(user_id),
                "name": values["name"],
                "email": values["email"],
                "employeeId": values["employeeId"],
                "department": values["department"],
                "location": values["location"],
                "timezone": values["timezone"],
                "experience": "Experienced mentor",
                "skills": [],
                "status": "approved",
                "createdAt": now,
                "approvedAt": now,
            })

        trainees_data = [
            ("Liam Scott", "liam.scott@example.com", "EMP-TRN-101", "Frontend UI", "Bengaluru, India", "Asia/Kolkata", 0),
            ("Sophia Martinez", "sophia.martinez@example.com", "EMP-TRN-102", "Web Platforms", "Chennai, India", "Asia/Kolkata", 0),
            ("Noah Patel", "noah.patel@example.com", "EMP-TRN-103", "Design Systems", "Pune, India", "Asia/Kolkata", 0),
            ("Emma Wilson", "emma.wilson@example.com", "EMP-TRN-104", "Payments API", "San Francisco, USA", "America/Los_Angeles", 1),
            ("James Anderson", "james.anderson@example.com", "EMP-TRN-105", "Auth & Identity", "New York, USA", "America/New_York", 1),
            ("Olivia Taylor", "olivia.taylor@example.com", "EMP-TRN-106", "Distributed Systems", "Austin, USA", "America/Chicago", 1),
            ("Lucas Hernandez", "lucas.hernandez@example.com", "EMP-TRN-107", "Analytics Engineering", "Hyderabad, India", "Asia/Kolkata", 2),
            ("Mia Robinson", "mia.robinson@example.com", "EMP-TRN-108", "Data Science", "Seattle, USA", "America/Los_Angeles", 2),
        ]
        trainee_ids = []
        progress_by_trainee = {}
        for index, (name, email, employee_id, department, location, tz, mentor_index) in enumerate(trainees_data):
            trainee_id = oid()
            trainee_ids.append(trainee_id)
            assigned_user_id = mentor_users[mentor_index]
            completed_count = min(index + 1, len(flat_courses))
            status = "dropped_out" if index == 7 else "active"
            trainee_doc = {
                "_id": trainee_id,
                "cohortId": str(cohort_id),
                "nominatedBy": str(nominator_id),
                "mentorId": str(mentor_profiles[mentor_index]),
                "name": name,
                "email": email,
                "employeeId": employee_id,
                "department": department,
                "location": location,
                "timezone": tz,
                "experience": "New hire",
                "skills": [],
                "status": status,
                "createdAt": now,
            }
            if status == "dropped_out":
                trainee_doc.update({
                    "droppedOutAt": now - timedelta(days=1),
                    "droppedOutBy": str(mentor_users[mentor_index]),
                    "dropoutReason": "Demo record: trainee left the program",
                })
            await db.trainees.insert_one(trainee_doc)

            progress_items = []
            for item_index, (week_number, course_id, title) in enumerate(flat_courses):
                complete = item_index < completed_count
                progress_items.append({
                    "weekNumber": week_number,
                    "courseId": course_id,
                    "title": title,
                    "completed": complete,
                    "completedAt": now - timedelta(days=completed_count - item_index) if complete else None,
                    "completedBy": str(assigned_user_id) if complete else None,
                })
            percent = round(completed_count / len(flat_courses) * 100, 1)
            progress_by_trainee[str(trainee_id)] = percent
            await db.progress.insert_one({
                "cohortId": str(cohort_id),
                "traineeId": str(trainee_id),
                "mentorId": str(mentor_profiles[mentor_index]),
                "planId": str(plan_id),
                "items": progress_items,
                "percentComplete": percent,
                "createdAt": now,
                "updatedAt": now,
            })

            # Seed one representative feedback response for trainees with some progress.
            if index in (2, 4):
                await db.feedbackResponses.insert_one({
                    "cohortId": str(cohort_id),
                    "traineeId": str(trainee_id),
                    "mentorId": str(mentor_profiles[mentor_index]),
                    "formId": str(feedback_form_id),
                    "weekNumber": 1,
                    "answers": {
                        "rating_technical": 4,
                        "rating_velocity": 4 if index == 2 else 5,
                        "collaboration_status": "Meeting Expectations",
                        "text_strengths": f"{name} is making steady progress through the onboarding plan.",
                        "text_growth_areas": "Continue practicing testing and code review workflows.",
                    },
                    "submittedAt": now - timedelta(days=2),
                })

        # TalentNext progress uses a map keyed by course ID in the current app.
        for index, trainee_id in enumerate(trainee_ids):
            completion = {}
            for course_index, assignment in enumerate(course_assignments):
                is_complete = course_index == 0 and index % 2 == 0
                completion[assignment["courseId"]] = {
                    "completed": is_complete,
                    "completedAt": now - timedelta(days=2) if is_complete else None,
                    "completedBy": str(mentor_users[index % len(mentor_users)]) if is_complete else None,
                }
            await db.talentnextProgress.insert_one({
                "cohortId": str(cohort_id),
                "traineeId": str(trainee_id),
                "completionMap": completion,
                "createdAt": now,
                "updatedAt": now,
            })

        # Demo groups use disjoint rosters: no trainee is in two active batches.
        batch_specs = [
            ("India Engineering Group", 0, [0, 1, 2]),
            ("US Platform Group", 1, [3, 4, 5]),
            ("Data Group", 2, [6, 7]),
        ]
        batch_ids = []
        for name, mentor_index, member_indexes in batch_specs:
            batch_id = oid()
            batch_ids.append(batch_id)
            batch_trainee_ids = [trainee_ids[item] for item in member_indexes]
            await db.batches.insert_one({
                "_id": batch_id,
                "mentorId": mentor_users[mentor_index],
                "cohortId": cohort_id,
                "name": name,
                "description": "Demo mentor group for scheduled mentorship sessions.",
                "timezone": mentors_data[mentor_index]["timezone"],
                "trainingLevel": "intermediate",
                "maxTrainees": 6,
                "startDate": now,
                "endDate": now + timedelta(days=23),
                "status": "active",
                "traineeIds": batch_trainee_ids,
                "createdAt": now,
                "updatedAt": now,
            })

        def roster_for(indexes):
            return [
                {
                    "traineeId": str(trainee_ids[index]),
                    "name": trainees_data[index][0],
                    "email": trainees_data[index][1],
                    "location": trainees_data[index][4],
                    "status": "dropped_out" if index == 7 else "active",
                    "droppedOutAt": now - timedelta(days=1) if index == 7 else None,
                    "dropoutReason": "Demo record: trainee left the program" if index == 7 else None,
                }
                for index in indexes
            ]

        group_a_indexes = [0, 1, 2]
        group_b_indexes = [3, 4, 5]
        sessions = [
            {
                "batchId": batch_ids[0], "mentorId": mentor_users[0],
                "sessionDate": now - timedelta(days=1), "startTime": "10:00", "endTime": "11:00",
                "title": "Welcome and Engineering Foundations", "description": "Kickoff and learning goals.",
                "format": "online", "location": None, "meetingLink": "https://example.com/demo-session-india",
                "maxAttendees": 6, "roster": roster_for(group_a_indexes), "status": "completed",
                "attendance": [
                    {"traineeId": str(trainee_ids[index]), "status": "present" if index != 1 else "absent", "markedAt": now - timedelta(days=1), "markedBy": str(mentor_users[0])}
                    for index in group_a_indexes
                ],
                "createdAt": now - timedelta(days=3), "updatedAt": now - timedelta(days=1),
            },
            {
                "batchId": batch_ids[0], "mentorId": mentor_users[0],
                "sessionDate": now + timedelta(days=1), "startTime": "10:00", "endTime": "11:00",
                "title": "Git and Collaboration Workshop", "description": "Practice pull requests and code review.",
                "format": "online", "location": None, "meetingLink": "https://example.com/demo-session-upcoming",
                "maxAttendees": 6, "roster": roster_for(group_a_indexes), "status": "scheduled",
                "attendance": [], "createdAt": now, "updatedAt": None,
            },
            {
                "batchId": batch_ids[1], "mentorId": mentor_users[1],
                "sessionDate": now + timedelta(days=2), "startTime": "13:00", "endTime": "14:00",
                "title": "API Design Review", "description": "Review API design and validation patterns.",
                "format": "online", "location": None, "meetingLink": "https://example.com/demo-session-api",
                "maxAttendees": 6, "roster": roster_for(group_b_indexes), "status": "scheduled",
                "attendance": [], "createdAt": now, "updatedAt": None,
            },
        ]
        await db.sessions.insert_many(sessions)

        # Initialize indexes in the same way as the application startup.
        from app.core.db import db_instance, init_indexes
        db_instance.db = db
        await init_indexes()

        print("Seed complete.")
        print("Admin:     admin@example.com / Admin@123")
        print("Nominator: nominator@example.com / Nominator@123")
        print("Mentors:   sarah.jenkins@example.com, david.chen@example.com, elena.rodriguez@example.com / Mentor@123")
        print("Demo data includes nominee locations/timezones, assigned trainees, one dropout, progress, feedback, TalentNext, three batches, and scheduled/completed sessions with attendance.")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(run_seed())
