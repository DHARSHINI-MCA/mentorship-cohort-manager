from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.db import get_database
from app.core.deps import require_admin, require_any_authenticated
from app.services.template_service import TemplateService
from app.schemas.templates import (
    TrainingTemplateCreate, TrainingTemplateResponse,
    FeedbackTemplateCreate, FeedbackTemplateResponse
)
from app.schemas.common import PaginatedResponse

router = APIRouter(tags=["Templates"])

# Training Templates
@router.post("/training-templates", response_model=TrainingTemplateResponse)
async def create_training_template(
    data: TrainingTemplateCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await TemplateService.create_training_template(db, data)

@router.get("/training-templates", response_model=PaginatedResponse[TrainingTemplateResponse])
async def list_training_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await TemplateService.get_training_templates(db, page, limit)

@router.get("/training-templates/{template_id}", response_model=TrainingTemplateResponse)
async def get_training_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await TemplateService.get_training_template_by_id(db, template_id)

@router.put("/training-templates/{template_id}", response_model=TrainingTemplateResponse)
async def update_training_template(
    template_id: str,
    data: TrainingTemplateCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await TemplateService.update_training_template(db, template_id, data)

@router.delete("/training-templates/{template_id}")
async def delete_training_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    success = await TemplateService.delete_training_template(db, template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training template not found",
            headers={"code": "NOT_FOUND"}
        )
    return {"success": True, "message": "Training template deleted"}

# Feedback Templates
@router.post("/feedback-templates", response_model=FeedbackTemplateResponse)
async def create_feedback_template(
    data: FeedbackTemplateCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    return await TemplateService.create_feedback_template(db, data)

@router.get("/feedback-templates", response_model=PaginatedResponse[FeedbackTemplateResponse])
async def list_feedback_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await TemplateService.get_feedback_templates(db, page, limit)

@router.get("/feedback-templates/{template_id}", response_model=FeedbackTemplateResponse)
async def get_feedback_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_any_authenticated)
):
    return await TemplateService.get_feedback_template_by_id(db, template_id)

@router.delete("/feedback-templates/{template_id}")
async def delete_feedback_template(
    template_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_admin)
):
    success = await TemplateService.delete_feedback_template(db, template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback template not found",
            headers={"code": "NOT_FOUND"}
        )
    return {"success": True, "message": "Feedback template deleted"}
