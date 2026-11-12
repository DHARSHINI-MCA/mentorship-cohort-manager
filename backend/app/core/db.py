from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = MongoDB()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    await init_indexes()

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()

async def _ensure_unique_trainee_employee_id_index(db: AsyncIOMotorDatabase) -> None:
    """Trim trainee employeeIds, safely disambiguate any legacy duplicates, and create unique CI index."""
    seen_keys: set[str] = set()
    cursor = db.trainees.find(
        {"employeeId": {"$type": "string"}},
        {"_id": 1, "employeeId": 1, "createdAt": 1, "legacyDuplicateEmployeeId": 1},
    ).sort([("createdAt", pymongo.ASCENDING), ("_id", pymongo.ASCENDING)])

    async for doc in cursor:
        raw_val = doc.get("employeeId") or ""
        trimmed = raw_val.strip()
        if not trimmed:
            if raw_val != "":
                await db.trainees.update_one({"_id": doc["_id"]}, {"$set": {"employeeId": ""}})
            continue

        key = trimmed.casefold()
        if key in seen_keys:
            disambiguated = f"{trimmed}__DUP_{str(doc['_id'])[-6:]}"
            update_fields = {"employeeId": disambiguated}
            if not doc.get("legacyDuplicateEmployeeId"):
                update_fields["legacyDuplicateEmployeeId"] = trimmed
            await db.trainees.update_one({"_id": doc["_id"]}, {"$set": update_fields})
            seen_keys.add(disambiguated.casefold())
        else:
            seen_keys.add(key)
            if trimmed != raw_val:
                await db.trainees.update_one({"_id": doc["_id"]}, {"$set": {"employeeId": trimmed}})

    await db.trainees.create_index(
        [("employeeId", pymongo.ASCENDING)],
        unique=True,
        name="uniq_trainee_employee_id_ci",
        collation=pymongo.collation.Collation(locale="en", strength=2),
        partialFilterExpression={"employeeId": {"$type": "string", "$gt": ""}},
    )


async def init_indexes():
    db = db_instance.db
    if db is None:
        return
    # Users email unique index
    await db.users.create_index([("email", pymongo.ASCENDING)], unique=True)

    await _ensure_unique_trainee_employee_id_index(db)

    # Cross-role identity claims enforce one email and employee ID per person.
    await db.personIdentityClaims.create_index([("claim", pymongo.ASCENDING)], unique=True)
    await db.personIdentityClaims.create_index([("ownerType", pymongo.ASCENDING), ("ownerId", pymongo.ASCENDING)])
    from app.services.identity_service import backfill_existing_person_identity_claims
    await backfill_existing_person_identity_claims(db)
    
    # Users temporary password index for first login reset
    await db.users.create_index([("temporaryPassword", pymongo.ASCENDING)])
    
    # Users firstLoginPasswordReset index for queries
    await db.users.create_index([("firstLoginPasswordReset", pymongo.ASCENDING)])
    
    # Trainees index {cohortId, mentorId}
    await db.trainees.create_index([("cohortId", pymongo.ASCENDING), ("mentorId", pymongo.ASCENDING)])
    
    # Progress traineeId unique index
    await db.progress.create_index([("traineeId", pymongo.ASCENDING)], unique=True)
    
    # FeedbackResponses index {traineeId, weekNumber}
    await db.feedbackResponses.create_index(
        [("traineeId", pymongo.ASCENDING), ("weekNumber", pymongo.ASCENDING)],
        unique=True
    )
    
    # Batches indexes
    await db.batches.create_index([("mentorId", pymongo.ASCENDING)])
    await db.batches.create_index([("cohortId", pymongo.ASCENDING)])
    await db.batches.create_index([("mentorId", pymongo.ASCENDING), ("cohortId", pymongo.ASCENDING)])
    await db.batches.create_index([("status", pymongo.ASCENDING)])
    await db.batches.create_index([("traineeIds", pymongo.ASCENDING)])
    
    # Mentors and trainees indexes for location/timezone filtering
    await db.mentors.create_index(
    [
        ("cohortId", pymongo.ASCENDING),
        ("email", pymongo.ASCENDING)
    ],
    unique=True
)
    await db.mentors.create_index([("cohortIds", pymongo.ASCENDING)])
    await db.mentors.create_index([("userId", pymongo.ASCENDING)])
    await db.trainees.create_index([("cohortId", pymongo.ASCENDING), ("email", pymongo.ASCENDING)])
    await db.mentors.create_index([("cohortId", pymongo.ASCENDING), ("location", pymongo.ASCENDING)])
    await db.mentors.create_index([("cohortId", pymongo.ASCENDING), ("timezone", pymongo.ASCENDING)])
    await db.trainees.create_index([("cohortId", pymongo.ASCENDING), ("location", pymongo.ASCENDING)])
    await db.trainees.create_index([("cohortId", pymongo.ASCENDING), ("timezone", pymongo.ASCENDING)])
    
    # Sessions index {batchId, sessionDate}
    await db.sessions.create_index([("batchId", pymongo.ASCENDING)])
    await db.sessions.create_index([("batchId", pymongo.ASCENDING), ("sessionDate", pymongo.DESCENDING)])
    
    # Attendance index {sessionId, traineeId} unique
    await db.attendance.create_index(
        [("sessionId", pymongo.ASCENDING), ("traineeId", pymongo.ASCENDING)],
        unique=True
    )

def get_database() -> AsyncIOMotorDatabase:
    return db_instance.db
