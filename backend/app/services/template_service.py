from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.templates import (
    TrainingTemplateCreate, FeedbackTemplateCreate
)

class TemplateService:
    @staticmethod
    async def create_training_template(db: AsyncIOMotorDatabase, data: TrainingTemplateCreate) -> dict:
        doc = data.model_dump()
        doc["createdAt"] = datetime.now(timezone.utc)
        result = await db.trainingTemplates.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def get_training_templates(db: AsyncIOMotorDatabase, page: int = 1, limit: int = 20) -> dict:
        skip = (page - 1) * limit
        cursor = db.trainingTemplates.find().sort("createdAt", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
            items.append(doc)
        total = await db.trainingTemplates.count_documents({})
        pages = (total + limit - 1) // limit if limit > 0 else 1
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    @staticmethod
    async def get_training_template_by_id(db: AsyncIOMotorDatabase, template_id: str) -> dict:
        try:
            doc = await db.trainingTemplates.find_one({"_id": ObjectId(template_id)})
        except Exception:
            doc = None
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training template not found",
                headers={"code": "NOT_FOUND"}
            )
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return doc

    @staticmethod
    async def update_training_template(db: AsyncIOMotorDatabase, template_id: str, data: TrainingTemplateCreate) -> dict:
        try:
            doc = await db.trainingTemplates.find_one({"_id": ObjectId(template_id)})
        except Exception:
            doc = None
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training template not found",
                headers={"code": "NOT_FOUND"}
            )
        update_data = data.model_dump()
        update_data["totalWeeks"] = len(update_data.get("weeks", []))
        await db.trainingTemplates.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": update_data}
        )
        updated = await db.trainingTemplates.find_one({"_id": ObjectId(template_id)})
        updated["id"] = str(updated["_id"])
        updated.pop("_id", None)
        if "createdAt" not in updated or not updated["createdAt"]:
            updated["createdAt"] = doc.get("createdAt") or datetime.now(timezone.utc)
        return updated

    @staticmethod
    async def delete_training_template(db: AsyncIOMotorDatabase, template_id: str) -> bool:
        try:
            result = await db.trainingTemplates.delete_one({"_id": ObjectId(template_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    async def create_feedback_template(db: AsyncIOMotorDatabase, data: FeedbackTemplateCreate) -> dict:
        doc = data.model_dump()
        doc["createdAt"] = datetime.now(timezone.utc)
        result = await db.feedbackTemplates.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        return doc

    @staticmethod
    async def get_feedback_templates(db: AsyncIOMotorDatabase, page: int = 1, limit: int = 20) -> dict:
        skip = (page - 1) * limit
        cursor = db.feedbackTemplates.find().sort("createdAt", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        total = await db.feedbackTemplates.count_documents({})
        pages = (total + limit - 1) // limit if limit > 0 else 1
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    @staticmethod
    async def get_feedback_template_by_id(db: AsyncIOMotorDatabase, template_id: str) -> dict:
        try:
            doc = await db.feedbackTemplates.find_one({"_id": ObjectId(template_id)})
        except Exception:
            doc = None
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback template not found",
                headers={"code": "NOT_FOUND"}
            )
        doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def delete_feedback_template(db: AsyncIOMotorDatabase, template_id: str) -> bool:
        try:
            result = await db.feedbackTemplates.delete_one({"_id": ObjectId(template_id)})
            return result.deleted_count > 0
        except Exception:
            return False
