import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    UserCreate, UserUpdate, UserResponse,
    ProfileUpdate, AdminResetPasswordRequest,
    RoleCreate, RoleUpdate, RoleResponse, PermissionResponse,
)
from app.modules.users.models import User, Role
from app.core.security import hash_password, verify_password
from app.shared.exceptions import NotFoundError, ConflictError, BadRequestError, ForbiddenError
from app.shared.pagination import PaginationParams, PaginatedResponse


def _role_to_response(role: Role) -> RoleResponse:
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_active=role.is_active,
        permissions=[
            PermissionResponse.model_validate(rp.permission)
            for rp in role.role_permissions
            if rp.permission
        ],
    )


class UserService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def get_all(
        self, params: PaginationParams, search: str | None = None
    ) -> PaginatedResponse[UserResponse]:
        users, total = await self.repo.get_all(
            offset=params.offset, limit=params.limit, search=search
        )
        return PaginatedResponse.build(
            data=[UserResponse.model_validate(u) for u in users],
            total=total,
            params=params,
        )

    async def get_by_id(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User")
        return user

    async def create(self, data: UserCreate, created_by: uuid.UUID | None = None) -> User:
        if await self.repo.get_by_email(data.email):
            raise ConflictError("El correo electrónico ya está registrado")
        if data.username and await self.repo.get_by_username(data.username):
            raise ConflictError("El nombre de usuario ya está en uso")
        return await self.repo.create(data, created_by)

    async def update(self, user_id: uuid.UUID, data: UserUpdate, updated_by: uuid.UUID) -> User:
        user = await self.get_by_id(user_id)
        if data.email and data.email != user.email:
            existing = await self.repo.get_by_email(data.email)
            if existing and str(existing.id) != str(user_id):
                raise ConflictError("El correo electrónico ya está registrado")
        if data.username and data.username != user.username:
            existing = await self.repo.get_by_username(data.username)
            if existing and str(existing.id) != str(user_id):
                raise ConflictError("El nombre de usuario ya está en uso")
        return await self.repo.update(user, data, updated_by)

    async def delete(self, user_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
        user = await self.get_by_id(user_id)
        if str(user.id) == str(deleted_by):
            raise BadRequestError("You cannot delete your own account")
        await self.repo.soft_delete(user, deleted_by)

    async def update_profile(self, user_id: uuid.UUID, data: ProfileUpdate) -> User:
        user = await self.get_by_id(user_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        await self.repo.db.commit()
        await self.repo.db.refresh(user)
        return await self.repo.get_by_id(user.id)

    async def reset_password_admin(self, target_user_id: uuid.UUID, new_password: str, requester=None) -> None:
        user = await self.get_by_id(target_user_id)
        target_role = (user.role.name if user.role else "").lower()
        requester_role = (requester.role.name if requester and requester.role else "").lower()
        if target_role == "propietario" and requester_role != "propietario":
            raise ForbiddenError("No puedes restablecer la contraseña de un propietario")
        user.password_hash = hash_password(new_password)
        await self.repo.db.commit()

    async def change_password(
        self, user_id: uuid.UUID, current_password: str, new_password: str
    ) -> None:
        user = await self.get_by_id(user_id)
        if not verify_password(current_password, user.password_hash):
            raise BadRequestError("Current password is incorrect")
        user.password_hash = hash_password(new_password)
        await self.repo.db.commit()

    # ── Roles ──────────────────────────────────────────────────────────────

    async def get_roles(self) -> list[RoleResponse]:
        roles = await self.repo.get_all_roles()
        return [_role_to_response(r) for r in roles]

    async def get_role_by_id(self, role_id: uuid.UUID) -> RoleResponse:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError("Role")
        return _role_to_response(role)

    async def create_role(self, data: RoleCreate) -> RoleResponse:
        roles = await self.repo.get_all_roles()
        if any(r.name.lower() == data.name.lower() for r in roles):
            raise ConflictError("Role name already exists")
        role = await self.repo.create_role(data)
        return _role_to_response(role)

    async def update_role(self, role_id: uuid.UUID, data: RoleUpdate) -> RoleResponse:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError("Role")
        if data.name:
            roles = await self.repo.get_all_roles()
            if any(r.name.lower() == data.name.lower() and r.id != role_id for r in roles):
                raise ConflictError("Role name already exists")
        updated = await self.repo.update_role(role, data)
        return _role_to_response(updated)

    async def delete_role(self, role_id: uuid.UUID) -> None:
        role = await self.repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError("Role")
        count = await self.repo.count_users_with_role(role_id)
        if count > 0:
            raise BadRequestError(f"Cannot delete role: {count} active user(s) assigned to it")
        await self.repo.delete_role(role)

    # ── Permissions ─────────────────────────────────────────────────────────

    async def get_permissions(self) -> list[PermissionResponse]:
        perms = await self.repo.get_all_permissions()
        return [PermissionResponse.model_validate(p) for p in perms]
