from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str  # "admin" | "nominator" | "mentor"
    isActive: bool = True

class UserCreate(UserBase):
    password: str

class UserCreateWithTempPassword(BaseModel):
    """Used by admin to create users with temporary passwords"""
    name: str
    email: EmailStr
    role: str  # "nominator" | "mentor" | "trainee"
    location: Optional[str] = None
    timezone: Optional[str] = None
    createdBy: str  # admin user id

class NominatorCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    assignedCohortIds: Optional[List[str]] = []

class CohortNominatorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    employeeId: str = Field(min_length=1, max_length=64)
    email: EmailStr

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    employeeId: Optional[str] = None
    isActive: bool
    createdAt: datetime
    firstLoginPasswordReset: bool = False

class ActivateMentorLoginRequest(BaseModel):
    password: str

class ResetPasswordRequest(BaseModel):
    """First login password reset"""
    email: Optional[EmailStr] = None
    tempPassword: str
    newPassword: str
    confirmPassword: str

class ChangePasswordRequest(BaseModel):
    """Subsequent password changes"""
    currentPassword: str
    newPassword: str
    confirmPassword: str

class FirstLoginResponse(BaseModel):
    requiresPasswordReset: bool
    message: str
