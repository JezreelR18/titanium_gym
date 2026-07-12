import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from app.shared.enums import UserStatus


class PermissionResponse(BaseModel):
    id: uuid.UUID
    name: str
    module: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class RoleBasicResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool = True
    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    permissions: List[PermissionResponse] = []
    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[uuid.UUID] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permission_ids: Optional[List[uuid.UUID]] = None


class UserBase(BaseModel):
    first_name: str
    last_name: str
    username: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role_id: uuid.UUID


def _validate_password(v: str) -> str:
    import re
    errors = []
    if len(v) < 8:
        errors.append("mínimo 8 caracteres")
    if not re.search(r"[A-Z]", v):
        errors.append("al menos una mayúscula")
    if not re.search(r"[a-z]", v):
        errors.append("al menos una minúscula")
    if not re.search(r"\d", v):
        errors.append("al menos un número")
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>/?\\|`~]", v):
        errors.append("al menos un carácter especial (!@#$%...)")
    if errors:
        raise ValueError("La contraseña debe tener: " + ", ".join(errors))
    return v


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role_id: Optional[uuid.UUID] = None
    status: Optional[UserStatus] = None
    note: Optional[str] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    username: Optional[str] = None
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    status: UserStatus
    is_active: bool
    last_login_at: Optional[datetime] = None
    role: RoleBasicResponse
    permissions: List[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        obj = cls.model_validate(user)
        if user.role and hasattr(user.role, "role_permissions"):
            obj.permissions = [
                rp.permission.name
                for rp in user.role.role_permissions
                if rp.permission
            ]
        return obj


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password(v)
