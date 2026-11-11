"""
Admin user management endpoints for creating users with temporary passwords.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.core.db import get_database
from app.core.security import get_password_hash, generate_temporary_password
from app.core.deps import require_admin
from app.schemas.users import UserCreateWithTempPassword, UserResponse
from app.services.identity_service import claim_person_identity, release_person_identity

router = APIRouter(prefix="/admin/users", tags=["Admin - Users"])

@router.post("/create-with-temp-password", response_model=dict)
async def create_user_with_temp_password(
    user_data: UserCreateWithTempPassword,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Admin creates a new user account with a temporary password.
    User must reset this password on first login.
    
    Returns:
    - userId: ID of created user
    - tempPassword: Temporary password to share with user
    - message: Success message
    """
    # Validate role
    if user_data.role not in ["nominator", "mentor", "trainee"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'nominator', 'mentor', or 'trainee'",
            headers={"code": "INVALID_ROLE"}
        )

    user_id_obj = ObjectId()
    await claim_person_identity(
        db,
        owner_type=user_data.role,
        owner_id=str(user_id_obj),
        email=str(user_data.email),
        employee_id=user_data.employeeId,
    )

    # Generate temporary password
    temp_password = generate_temporary_password()

    # Create user document
    user_doc = {
        "name": user_data.name,
        "email": user_data.email.lower(),
        "employeeId": user_data.employeeId.strip(),
        "role": user_data.role,
        "passwordHash": get_password_hash(temp_password),
        "firstLoginPasswordReset": True,  # Flag to force password reset on first login
        "isActive": True,
        "createdAt": datetime.utcnow(),
        "createdBy": ObjectId(current_user["id"]),
        "location": user_data.location,
        "timezone": user_data.timezone,
    }

    # Insert user
    user_doc["_id"] = user_id_obj
    try:
        await db.users.insert_one(user_doc)
    except Exception:
        await release_person_identity(db, str(user_id_obj))
        raise
    user_id = str(user_id_obj)

    return {
        "success": True,
        "userId": user_id,
        "tempPassword": temp_password,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "message": f"User created successfully. Share the temporary password with {user_data.name}. They must reset it on first login."
    }

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get user details (admin only)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=str(user["_id"]),
            name=user["name"],
            email=user["email"],
            role=user["role"],
            isActive=user.get("isActive", True),
            createdAt=user["createdAt"],
            firstLoginPasswordReset=user.get("firstLoginPasswordReset", False)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/users", response_model=list)
async def list_users(
    role: str = None,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """List all users, optionally filtered by role"""
    query = {}
    if role:
        query["role"] = role

    users = await db.users.find(query).to_list(length=None)
    
    return [
        {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "isActive": user.get("isActive", True),
            "createdAt": user["createdAt"],
            "firstLoginPasswordReset": user.get("firstLoginPasswordReset", False),
            "lastLoginAt": user.get("lastLoginAt")
        }
        for user in users
    ]

@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Deactivate a user account"""
    try:
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isActive": False}}
        )
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        if await db.mentors.find_one({"userId": user_id}):
            await db.mentors.update_many({"userId": user_id}, {"$set": {"isActive": False}})
        
        return {
            "success": True,
            "message": f"User {user_id} deactivated"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Activate a user account"""
    try:
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isActive": True}}
        )
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        if await db.mentors.find_one({"userId": user_id}):
            await db.mentors.update_many({"userId": user_id}, {"$set": {"isActive": True}})
        
        return {
            "success": True,
            "message": f"User {user_id} activated"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/users/{user_id}/reset-temp-password")
async def reset_user_temp_password(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Admin can reset a user's temporary password.
    This forces the user to go through password reset on next login.
    """
    try:
        temp_password = generate_temporary_password()
        
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "passwordHash": get_password_hash(temp_password),
                    "firstLoginPasswordReset": True
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "success": True,
            "userId": user_id,
            "tempPassword": temp_password,
            "message": "Temporary password reset. User must reset it on next login."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
