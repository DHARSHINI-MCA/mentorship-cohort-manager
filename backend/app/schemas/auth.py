from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    userId: str
    name: str
    mustChangePassword: bool = False

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

class TokenData(BaseModel):
    userId: Optional[str] = None
    role: Optional[str] = None

class CurrentUserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    isActive: bool
