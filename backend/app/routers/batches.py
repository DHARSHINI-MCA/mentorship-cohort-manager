"""
Batch management endpoints for organizing trainees
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import Optional
from app.core.db import get_database
from app.core.deps import require_roles
from app.schemas.batches import (
    BatchCreate, BatchUpdate, BatchResponse, BatchListItem,
    BatchAddTraineesRequest, BatchRemoveTraineesRequest,
    BatchAnalytics, BatchStatus, TraineeInBatch
)

router = APIRouter(prefix="/batches", tags=["Batches"])

# Role requirements
require_mentor = require_roles(["mentor", "admin"])
require_authenticated = require_roles(["admin", "mentor", "trainee"])


@router.post("/", response_model=BatchResponse)
async def create_batch(
    data: BatchCreate,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Create a new batch for organizing trainees
    Only mentors can create batches in their assigned cohorts
    """
    try:
        # Verify cohort exists and mentor has access
        cohort = await db.cohorts.find_one({"_id": ObjectId(data.cohortId)})
        if not cohort:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cohort not found"
            )
        
        # Check mentor has access to this cohort
        mentor_profile_ids = []
        if current_user.get("role") == "mentor":
            mentor_profiles = await db.mentors.find({
                "cohortId": data.cohortId,
                "userId": current_user["id"]
            }).to_list(length=None)
            mentor_profile_ids = [str(profile["_id"]) for profile in mentor_profiles]
            if not mentor_profile_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this cohort"
                )

        selected_ids = list(dict.fromkeys(data.traineeIds))
        if not selected_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select at least one assigned trainee for this batch"
            )
        if data.maxTrainees and len(selected_ids) > data.maxTrainees:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected trainees exceed the batch capacity"
            )

        try:
            selected_object_ids = [ObjectId(trainee_id) for trainee_id in selected_ids]
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more trainee IDs are invalid"
            )

        trainee_query = {
            "_id": {"$in": selected_object_ids},
            "cohortId": data.cohortId,
            "status": {"$ne": "dropped_out"},
        }
        if current_user.get("role") == "mentor":
            trainee_query["mentorId"] = {"$in": mentor_profile_ids}
        selected_trainees = await db.trainees.find(trainee_query).to_list(length=None)
        if len(selected_trainees) != len(selected_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only add trainees assigned to you in this cohort"
            )

        existing_groups = await db.batches.find({
            "traineeIds": {"$in": selected_object_ids + selected_ids},
            "status": {"$nin": [BatchStatus.COMPLETED.value, BatchStatus.ARCHIVED.value]},
        }, {"name": 1}).to_list(length=None)
        if existing_groups:
            group_names = ", ".join(group.get("name", "Unnamed batch") for group in existing_groups)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A trainee can only belong to one active batch at a time. Remove them from: {group_names}"
            )
        
        # Create batch document
        batch_doc = {
            "mentorId": ObjectId(current_user["id"]),
            "cohortId": ObjectId(data.cohortId),
            "name": data.name,
            "description": data.description,
            "timezone": data.timezone,
            "trainingLevel": data.trainingLevel,
            "maxTrainees": data.maxTrainees,
            "startDate": data.startDate,
            "endDate": data.endDate,
            "status": BatchStatus.ACTIVE,
            "traineeIds": selected_object_ids,
            "createdAt": datetime.utcnow(),
            "updatedAt": None
        }
        
        result = await db.batches.insert_one(batch_doc)
        batch_id = str(result.inserted_id)
        
        batch_trainees = []
        for trainee in selected_trainees:
            trainee_id = str(trainee["_id"])
            progress = await db.progress.find_one({"traineeId": trainee_id})
            batch_trainees.append(TraineeInBatch(
                traineeId=trainee_id,
                name=trainee.get("name", ""),
                email=trainee.get("email"),
                employeeId=trainee.get("employeeId"),
                location=trainee.get("location"),
                timezone=trainee.get("timezone"),
                percentComplete=progress.get("percentComplete", 0.0) if progress else 0.0
            ))

        return BatchResponse(
            id=batch_id,
            mentorId=current_user["id"],
            mentorName=current_user.get("name"),
            cohortId=data.cohortId,
            name=data.name,
            description=data.description,
            timezone=data.timezone,
            trainingLevel=data.trainingLevel,
            maxTrainees=data.maxTrainees,
            traineeCount=len(batch_trainees),
            trainees=batch_trainees,
            status=BatchStatus.ACTIVE,
            progress=0.0,
            startDate=data.startDate,
            endDate=data.endDate,
            createdAt=datetime.utcnow()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create batch: {str(e)}"
        )


@router.get("/", response_model=list)
async def list_batches(
    cohort_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    List batches for authenticated user
    - Mentors see only their batches
    - Trainees see only batches they're assigned to
    - Admins see all batches
    """
    try:
        query = {}
        
        # Build query based on user role
        if current_user.get("role") == "mentor":
            query["mentorId"] = ObjectId(current_user["id"])
        elif current_user.get("role") == "trainee":
            # Get trainee ID
            trainee = await db.trainees.find_one({"userId": ObjectId(current_user["id"])})
            if trainee:
                query["traineeIds"] = ObjectId(str(trainee["_id"]))
        
        # Apply optional filters
        if cohort_id:
            query["cohortId"] = ObjectId(cohort_id)
        if status:
            query["status"] = status
        
        # Get total count
        total = await db.batches.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * limit
        batches = await db.batches.find(query).skip(skip).limit(limit).to_list(length=None)
        
        items = []
        for batch in batches:
            batch_id = str(batch["_id"])
            trainee_count = len(batch.get("traineeIds", []))
            
            # Calculate average progress
            progress = 0.0
            if trainee_count > 0:
                progresses = []
                for trainee_id in batch.get("traineeIds", []):
                    prog_doc = await db.progress.find_one({"traineeId": str(trainee_id)})
                    if prog_doc:
                        progresses.append(prog_doc.get("percentComplete", 0.0))
                if progresses:
                    progress = sum(progresses) / len(progresses)
            
            items.append(BatchListItem(
                id=batch_id,
                name=batch.get("name"),
                cohortId=str(batch.get("cohortId")),
                timezone=batch.get("timezone"),
                trainingLevel=batch.get("trainingLevel"),
                traineeCount=trainee_count,
                maxTrainees=batch.get("maxTrainees"),
                status=batch.get("status", BatchStatus.DRAFT),
                progress=progress,
                startDate=batch.get("startDate"),
                endDate=batch.get("endDate"),
                createdAt=batch.get("createdAt")
            ))
        
        return items
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list batches: {str(e)}"
        )


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: str,
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get detailed batch information"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check access
        if current_user.get("role") == "mentor":
            if str(batch["mentorId"]) != current_user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        
        # Build trainee list
        trainees = []
        for trainee_id in batch.get("traineeIds", []):
            trainee = await db.trainees.find_one({"_id": ObjectId(trainee_id)})
            if trainee:
                prog = await db.progress.find_one({"traineeId": str(trainee_id)})
                trainees.append(TraineeInBatch(
                    traineeId=str(trainee_id),
                    name=trainee.get("name"),
                    email=trainee.get("email"),
                    employeeId=trainee.get("employeeId"),
                    location=trainee.get("location"),
                    timezone=trainee.get("timezone"),
                    percentComplete=prog.get("percentComplete", 0.0) if prog else 0.0,
                    status=trainee.get("status"),
                    droppedOutAt=trainee.get("droppedOutAt"),
                    dropoutReason=trainee.get("dropoutReason"),
                ))
        
        # Calculate average progress
        progress = 0.0
        if trainees:
            progress = sum(t.percentComplete for t in trainees) / len(trainees)
        
        # Get mentor name
        mentor = await db.users.find_one({"_id": batch["mentorId"]})
        mentor_name = mentor.get("name") if mentor else "Unknown"
        
        return BatchResponse(
            id=batch_id,
            mentorId=str(batch["mentorId"]),
            mentorName=mentor_name,
            cohortId=str(batch["cohortId"]),
            name=batch.get("name"),
            description=batch.get("description"),
            timezone=batch.get("timezone"),
            trainingLevel=batch.get("trainingLevel"),
            maxTrainees=batch.get("maxTrainees"),
            traineeCount=len(trainees),
            trainees=trainees,
            status=batch.get("status", BatchStatus.DRAFT),
            progress=progress,
            startDate=batch.get("startDate"),
            endDate=batch.get("endDate"),
            createdAt=batch.get("createdAt"),
            updatedAt=batch.get("updatedAt")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch batch: {str(e)}"
        )


@router.put("/{batch_id}", response_model=BatchResponse)
async def update_batch(
    batch_id: str,
    data: BatchUpdate,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update batch details"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check ownership
        if str(batch["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        if data.status is not None and data.status.value not in [
            BatchStatus.COMPLETED.value,
            BatchStatus.ARCHIVED.value,
        ]:
            active_groups = await db.batches.find({
                "_id": {"$ne": ObjectId(batch_id)},
                "traineeIds": {"$in": batch.get("traineeIds", [])},
                "status": {"$nin": [BatchStatus.COMPLETED.value, BatchStatus.ARCHIVED.value]},
            }, {"name": 1}).to_list(length=None)
            if active_groups:
                group_names = ", ".join(group.get("name", "Unnamed batch") for group in active_groups)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"This batch cannot be reactivated while its trainees belong to: {group_names}"
                )
        
        # Build update document
        update_data = {"updatedAt": datetime.utcnow()}
        if data.name is not None:
            update_data["name"] = data.name
        if data.description is not None:
            update_data["description"] = data.description
        if data.timezone is not None:
            update_data["timezone"] = data.timezone
        if data.trainingLevel is not None:
            update_data["trainingLevel"] = data.trainingLevel
        if data.maxTrainees is not None:
            update_data["maxTrainees"] = data.maxTrainees
        if data.startDate is not None:
            update_data["startDate"] = data.startDate
        if data.endDate is not None:
            update_data["endDate"] = data.endDate
        if data.status is not None:
            update_data["status"] = data.status
        
        await db.batches.update_one(
            {"_id": ObjectId(batch_id)},
            {"$set": update_data}
        )
        
        # Fetch updated batch
        updated_batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        
        # Build trainee list
        trainees = []
        for trainee_id in updated_batch.get("traineeIds", []):
            trainee = await db.trainees.find_one({"_id": ObjectId(trainee_id)})
            if trainee:
                prog = await db.progress.find_one({"traineeId": str(trainee_id)})
                trainees.append(TraineeInBatch(
                    traineeId=str(trainee_id),
                    name=trainee.get("name"),
                    email=trainee.get("email"),
                    location=trainee.get("location"),
                    timezone=trainee.get("timezone"),
                    percentComplete=prog.get("percentComplete", 0.0) if prog else 0.0
                ))
        
        progress = sum(t.percentComplete for t in trainees) / len(trainees) if trainees else 0.0
        
        return BatchResponse(
            id=batch_id,
            mentorId=str(updated_batch["mentorId"]),
            cohortId=str(updated_batch["cohortId"]),
            name=updated_batch.get("name"),
            description=updated_batch.get("description"),
            timezone=updated_batch.get("timezone"),
            trainingLevel=updated_batch.get("trainingLevel"),
            maxTrainees=updated_batch.get("maxTrainees"),
            traineeCount=len(trainees),
            trainees=trainees,
            status=updated_batch.get("status"),
            progress=progress,
            startDate=updated_batch.get("startDate"),
            endDate=updated_batch.get("endDate"),
            createdAt=updated_batch.get("createdAt"),
            updatedAt=updated_batch.get("updatedAt")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update batch: {str(e)}"
        )


@router.post("/{batch_id}/trainees")
async def add_trainees_to_batch(
    batch_id: str,
    request: BatchAddTraineesRequest,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Add trainees to a batch"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check ownership
        if str(batch["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Only allow adding trainees already assigned to this mentor and cohort.
        trainee_ids = list(dict.fromkeys(request.traineeIds))
        try:
            trainee_object_ids = [ObjectId(tid) for tid in trainee_ids]
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more trainee IDs are invalid"
            )

        trainee_query = {
            "_id": {"$in": trainee_object_ids},
            "cohortId": str(batch["cohortId"]),
            "status": {"$ne": "dropped_out"},
        }
        if current_user.get("role") == "mentor":
            mentor_profiles = await db.mentors.find({
                "cohortId": str(batch["cohortId"]),
                "userId": current_user["id"],
            }).to_list(length=None)
            mentor_profile_ids = [str(profile["_id"]) for profile in mentor_profiles]
            if not mentor_profile_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this cohort"
                )
            trainee_query["mentorId"] = {"$in": mentor_profile_ids}

        assigned_trainees = await db.trainees.find(trainee_query).to_list(length=None)
        if len(assigned_trainees) != len(trainee_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can only add trainees assigned to you in this cohort"
            )

        # Check capacity based on genuinely new members, ignoring duplicates.
        existing_ids = {str(trainee_id) for trainee_id in batch.get("traineeIds", [])}
        new_trainee_ids = [
            trainee_id for trainee_id in trainee_ids if trainee_id not in existing_ids
        ]
        current_count = len(existing_ids)
        if new_trainee_ids:
            already_grouped = await db.batches.find({
                "_id": {"$ne": ObjectId(batch_id)},
                "traineeIds": {"$in": [ObjectId(tid) for tid in new_trainee_ids] + new_trainee_ids},
                "status": {"$nin": [BatchStatus.COMPLETED.value, BatchStatus.ARCHIVED.value]},
            }, {"name": 1}).to_list(length=None)
            if already_grouped:
                group_names = ", ".join(group.get("name", "Unnamed batch") for group in already_grouped)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A trainee can only belong to one active batch at a time. Remove them from: {group_names}"
                )

        max_trainees = batch.get("maxTrainees")
        if max_trainees and current_count + len(new_trainee_ids) > max_trainees:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Adding {len(new_trainee_ids)} trainees would exceed batch capacity"
            )

        if new_trainee_ids:
            await db.batches.update_one(
                {"_id": ObjectId(batch_id)},
                {
                    "$addToSet": {"traineeIds": {"$each": [ObjectId(tid) for tid in new_trainee_ids]}},
                    "$set": {"updatedAt": datetime.utcnow()}
                }
            )
        
        return {
            "success": True,
            "message": f"Added {len(new_trainee_ids)} trainees to batch",
            "traineeCount": current_count + len(new_trainee_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add trainees: {str(e)}"
        )


@router.delete("/{batch_id}/trainees")
async def remove_trainees_from_batch(
    batch_id: str,
    request: BatchRemoveTraineesRequest,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Remove trainees from a batch"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check ownership
        if str(batch["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Remove trainees
        trainee_object_ids = [ObjectId(tid) for tid in request.traineeIds]
        
        await db.batches.update_one(
            {"_id": ObjectId(batch_id)},
            {
                "$pull": {"traineeIds": {"$in": trainee_object_ids}},
                "$set": {"updatedAt": datetime.utcnow()}
            }
        )
        
        return {
            "success": True,
            "message": f"Removed {len(request.traineeIds)} trainees from batch"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove trainees: {str(e)}"
        )


@router.delete("/{batch_id}")
async def delete_batch(
    batch_id: str,
    current_user: dict = Depends(require_mentor),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a batch"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        # Check ownership
        if str(batch["mentorId"]) != current_user["id"] and current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Keep session history intact: a group can be deleted only if no
        # training sessions have been created for it.
        if await db.sessions.count_documents({"batchId": ObjectId(batch_id)}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This batch has training sessions and cannot be deleted"
            )
        
        await db.batches.delete_one({"_id": ObjectId(batch_id)})
        
        return {
            "success": True,
            "message": "Batch deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete batch: {str(e)}"
        )


@router.get("/{batch_id}/analytics", response_model=BatchAnalytics)
async def get_batch_analytics(
    batch_id: str,
    current_user: dict = Depends(require_authenticated),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get analytics for a batch"""
    try:
        batch = await db.batches.find_one({"_id": ObjectId(batch_id)})
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Batch not found"
            )
        
        trainee_ids = batch.get("traineeIds", [])
        object_ids = []
        for trainee_id in trainee_ids:
            try:
                object_ids.append(ObjectId(str(trainee_id)))
            except Exception:
                continue
        eligible_trainees = await db.trainees.find({
            "_id": {"$in": object_ids},
            "status": {"$ne": "dropped_out"},
        }).to_list(length=None)
        dropped_out_trainees = await db.trainees.count_documents({
            "_id": {"$in": object_ids},
            "status": "dropped_out",
        })
        total_trainees = len(eligible_trainees)
        
        # Calculate statistics
        completed_count = 0
        progress_values = []
        on_track = 0
        behind = 0
        
        for trainee in eligible_trainees:
            trainee_id = str(trainee["_id"])
            prog = await db.progress.find_one({"traineeId": str(trainee_id)})
            if prog:
                pct = prog.get("percentComplete", 0.0)
                progress_values.append(pct)
                if pct >= 100:
                    completed_count += 1
                if pct >= 50:
                    on_track += 1
                else:
                    behind += 1
        
        avg_progress = sum(progress_values) / len(progress_values) if progress_values else 0.0
        
        # Calculate duration
        duration_days = None
        if batch.get("startDate") and batch.get("endDate"):
            delta = batch["endDate"] - batch["startDate"]
            duration_days = delta.days
        
        return BatchAnalytics(
            batchId=batch_id,
            batchName=batch.get("name"),
            totalTrainees=total_trainees,
            droppedOutTrainees=dropped_out_trainees,
            completedTrainees=completed_count,
            averageProgress=avg_progress,
            onTrackTrainees=on_track,
            behindTrainees=behind,
            status=batch.get("status"),
            trainingLevel=batch.get("trainingLevel"),
            durationDays=duration_days
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics: {str(e)}"
        )
