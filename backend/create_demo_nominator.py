"""Create or refresh the demo nominator account without resetting the database."""
import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import get_password_hash


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    try:
        db = client[settings.DATABASE_NAME]
        email = "nominator@example.com"
        result = await db.users.update_one(
            {"email": email},
            {
                "$set": {
                    "name": "Demo Nominator",
                    "passwordHash": get_password_hash("Nominator@123"),
                    "role": "nominator",
                    "isActive": True,
                    "firstLoginPasswordReset": False,
                },
                "$setOnInsert": {"createdAt": datetime.now(timezone.utc)},
            },
            upsert=True,
        )
        user = await db.users.find_one({"email": email})
        cohort = await db.cohorts.find_one({}, sort=[("createdAt", -1)])
        if cohort:
            await db.cohorts.update_one(
                {"_id": cohort["_id"]},
                {"$addToSet": {"nominatorIds": str(user["_id"])}},
            )
            print(f"Assigned {email} to {cohort.get('name', 'the latest cohort')}.")
        else:
            print("No cohort found; create one and assign this nominator in the admin page.")
        action = "Created" if result.upserted_id else "Updated"
        print(f"{action} demo login: {email} / Nominator@123")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
