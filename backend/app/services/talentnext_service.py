from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class TalentNextService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.talentnextCourses

    async def create(self, name: str) -> dict:
        """Create a new TalentNext course"""
        now = datetime.now(timezone.utc)
        doc = {
            "name": name,
            "createdAt": now
        }
        result = await self.collection.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        return doc

    async def list_all(self) -> List[dict]:
        """List all TalentNext courses"""
        courses = []
        async for course in self.collection.find().sort("createdAt", -1):
            course["id"] = str(course.pop("_id"))
            courses.append(course)
        return courses

    async def get_by_id(self, course_id: str) -> Optional[dict]:
        """Get TalentNext course by ID"""
        try:
            course = await self.collection.find_one({"_id": ObjectId(course_id)})
            if course:
                course["id"] = str(course.pop("_id"))
            return course
        except Exception:
            return None

    async def get_by_ids(self, course_ids: List[str]) -> List[dict]:
        """Get multiple TalentNext courses by IDs"""
        try:
            oid_list = [ObjectId(cid) for cid in course_ids]
            courses = []
            async for course in self.collection.find({"_id": {"$in": oid_list}}):
                course["id"] = str(course.pop("_id"))
                courses.append(course)
            return courses
        except Exception:
            return []

    async def update(self, course_id: str, name: Optional[str] = None) -> Optional[dict]:
        """Update TalentNext course"""
        try:
            update_data = {}
            if name is not None:
                update_data["name"] = name

            if not update_data:
                return await self.get_by_id(course_id)

            result = await self.collection.find_one_and_update(
                {"_id": ObjectId(course_id)},
                {"$set": update_data},
                return_document=True
            )
            if result:
                result["id"] = str(result.pop("_id"))
            return result
        except Exception:
            return None

    async def delete(self, course_id: str) -> bool:
        """Delete TalentNext course"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(course_id)})
            return result.deleted_count > 0
        except Exception:
            return False
