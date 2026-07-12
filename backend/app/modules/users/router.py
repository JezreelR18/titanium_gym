import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner, require_permission
from app.modules.users.service import UserService
from app.modules.users.schemas import (
    UserCreate, UserUpdate, UserResponse,
    ProfileUpdate, AdminResetPasswordRequest,
    RoleResponse, RoleCreate, RoleUpdate,
    PermissionResponse, ChangePasswordRequest,
)
from app.shared.pagination import PaginationParams, PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    search: Optional[str] = Query(default=None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).get_all(params, search=search)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await UserService(db).create(data, created_by=current_user.id)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return UserResponse.from_user(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = await UserService(db).update_profile(current_user.id, data)
    return UserResponse.from_user(user)


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).get_permissions()


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await UserService(db).get_roles()


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).create_role(data)


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).get_role_by_id(role_id)


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: uuid.UUID,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).update_role(role_id, data)


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    await UserService(db).delete_role(role_id)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await UserService(db).get_by_id(user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await UserService(db).update(user_id, data, updated_by=current_user.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    await UserService(db).delete(user_id, deleted_by=current_user.id)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: uuid.UUID,
    data: AdminResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("users.reset_password")),
):
    await UserService(db).reset_password_admin(user_id, data.new_password, requester=current_user)


@router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user_id: uuid.UUID,
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await UserService(db).change_password(user_id, data.current_password, data.new_password)
