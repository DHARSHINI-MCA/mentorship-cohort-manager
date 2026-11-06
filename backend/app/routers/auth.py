from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.core.db import get_database
from app.core.security import (
    verify_password, 
    create_access_token, 
    get_password_hash,
    validate_password_strength
)
from app.core.deps import get_current_user, require_admin
from app.schemas.auth import LoginRequest, Token, CurrentUserResponse
from app.schemas.users import ResetPasswordRequest, ChangePasswordRequest, FirstLoginResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Standard login endpoint.
    If user has temporary password set, they must reset it first.
    """
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"code": "INVALID_CREDENTIALS"}
        )
    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
            headers={"code": "ACCOUNT_INACTIVE"}
        )

    # Check if user has temporary password (first login)
    if user.get("firstLoginPasswordReset", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must reset your temporary password on first login",
            headers={"code": "TEMPORARY_PASSWORD_RESET_REQUIRED"}
        )

    user_id = str(user["_id"])
    role = user.get("role", "mentor")
    access_token = create_access_token(subject=user_id, role=role)

    # Update last login timestamp
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"lastLoginAt": datetime.utcnow()}}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role,
        userId=user_id,
        name=user.get("name", "")
    )

@router.post("/login-first-time", response_model=FirstLoginResponse)
async def login_first_time(credentials: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Check if user needs to reset temporary password on first login.
    Returns whether password reset is required.
    """
    user = await db.users.find_one({"email": credentials.email.lower()})
    if not user or not verify_password(credentials.password, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"code": "INVALID_CREDENTIALS"}
        )
    
    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
            headers={"code": "ACCOUNT_INACTIVE"}
        )

    requires_reset = user.get("firstLoginPasswordReset", False)
    
    return FirstLoginResponse(
        requiresPasswordReset=requires_reset,
        message="Password reset required" if requires_reset else "Login successful"
    )

@router.post("/reset-temporary-password")
async def reset_temporary_password(
    request: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Reset temporary password on first login.
    User must provide their temporary password and set a new one.
    """
    # Validate new passwords match
    if request.newPassword != request.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
            headers={"code": "PASSWORD_MISMATCH"}
        )

    # Validate password strength
    is_strong, strength_message = validate_password_strength(request.newPassword)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_message,
            headers={"code": "WEAK_PASSWORD"}
        )

    # New first-login accounts are located by email and checked against the
    # stored password hash. Keep supporting older clients that submit only the
    # temporary password stored by the legacy account creation path.
    if request.email:
        user = await db.users.find_one({
            "email": str(request.email).lower(),
            "firstLoginPasswordReset": True
        })
    else:
        user = await db.users.find_one({
            "temporaryPassword": request.tempPassword,
            "firstLoginPasswordReset": True
        })

    if not user or not verify_password(request.tempPassword, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid temporary password",
            headers={"code": "INVALID_TEMP_PASSWORD"}
        )

    # Update user password and clear temporary password
    hashed_password = get_password_hash(request.newPassword)
    result = await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "passwordHash": hashed_password,
                "firstLoginPasswordReset": False,
                "passwordChangedAt": datetime.utcnow(),
                "lastLoginAt": datetime.utcnow(),
                "temporaryPassword": None
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

    # Generate access token for successful password reset
    user_id = str(user["_id"])
    role = user.get("role", "mentor")
    access_token = create_access_token(subject=user_id, role=role)

    return {
        "success": True,
        "message": "Password reset successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "userId": user_id,
        "role": role
    }

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Change password for authenticated user (after first login).
    """
    # Validate new passwords match
    if request.newPassword != request.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
            headers={"code": "PASSWORD_MISMATCH"}
        )

    # Validate password strength
    is_strong, strength_message = validate_password_strength(request.newPassword)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_message,
            headers={"code": "WEAK_PASSWORD"}
        )

    # Verify current password
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user or not verify_password(request.currentPassword, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
            headers={"code": "INVALID_CURRENT_PASSWORD"}
        )

    # Update password
    hashed_password = get_password_hash(request.newPassword)
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {
            "$set": {
                "passwordHash": hashed_password,
                "passwordChangedAt": datetime.utcnow()
            }
        }
    )

    return {
        "success": True,
        "message": "Password changed successfully"
    }

@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return CurrentUserResponse(
        id=current_user["id"],
        name=current_user.get("name", ""),
        email=current_user["email"],
        role=current_user["role"],
        isActive=current_user.get("isActive", True)
    )
