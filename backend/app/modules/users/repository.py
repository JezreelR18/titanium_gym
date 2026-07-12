import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.modules.users.models import User, Role, Permission, RolePermission
from app.modules.users.schemas import UserCreate, UserUpdate, RoleCreate, RoleUpdate
from app.core.security import hash_password


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _with_perms(self):
        return (
            selectinload(User.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(self._with_perms())
            .where(User.id == user_id, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(self._with_perms())
            .where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(self._with_perms())
            .where(User.username == username, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        search: str | None = None,
    ) -> tuple[list[User], int]:
        base = select(User).where(User.deleted_at.is_(None))
        count_base = select(func.count()).select_from(User).where(User.deleted_at.is_(None))

        if search:
            pattern = f"%{search}%"
            cond = or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.email.ilike(pattern),
                User.username.ilike(pattern),
            )
            base = base.where(cond)
            count_base = count_base.where(cond)

        result = await self.db.execute(base.offset(offset).limit(limit))
        count_result = await self.db.execute(count_base)
        return result.scalars().all(), count_result.scalar_one()

    async def create(self, data: UserCreate, created_by: uuid.UUID | None = None) -> User:
        user = User(
            role_id=data.role_id,
            first_name=data.first_name,
            last_name=data.last_name,
            username=data.username or None,
            email=data.email,
            password_hash=hash_password(data.password),
            phone=data.phone,
            avatar_url=data.avatar_url,
            created_by=created_by,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, data: UserUpdate, updated_by: uuid.UUID) -> User:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(user, field, value)
        user.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def soft_delete(self, user: User, deleted_by: uuid.UUID) -> None:
        user.deleted_at = datetime.now(timezone.utc)
        user.deleted_by = deleted_by
        user.is_active = False
        await self.db.commit()

    async def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.commit()

    # ── Roles ──────────────────────────────────────────────────────────────

    async def get_all_roles(self) -> list[Role]:
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.name)
        )
        return result.scalars().all()

    async def get_role_by_id(self, role_id: uuid.UUID) -> Role | None:
        result = await self.db.execute(
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(Role.id == role_id)
        )
        return result.scalar_one_or_none()

    async def create_role(self, data: RoleCreate) -> Role:
        role = Role(name=data.name, description=data.description)
        self.db.add(role)
        await self.db.flush()
        for perm_id in data.permission_ids:
            self.db.add(RolePermission(role_id=role.id, permission_id=perm_id))
        await self.db.commit()
        return await self.get_role_by_id(role.id)

    async def update_role(self, role: Role, data: RoleUpdate) -> Role:
        if data.name is not None:
            role.name = data.name
        if data.description is not None:
            role.description = data.description
        if data.is_active is not None:
            role.is_active = data.is_active

        if data.permission_ids is not None:
            existing = await self.db.execute(
                select(RolePermission).where(RolePermission.role_id == role.id)
            )
            for rp in existing.scalars().all():
                await self.db.delete(rp)
            await self.db.flush()
            for perm_id in data.permission_ids:
                self.db.add(RolePermission(role_id=role.id, permission_id=perm_id))

        await self.db.commit()
        return await self.get_role_by_id(role.id)

    async def delete_role(self, role: Role) -> None:
        existing = await self.db.execute(
            select(RolePermission).where(RolePermission.role_id == role.id)
        )
        for rp in existing.scalars().all():
            await self.db.delete(rp)
        await self.db.delete(role)
        await self.db.commit()

    async def count_users_with_role(self, role_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User).where(
                User.role_id == role_id,
                User.deleted_at.is_(None),
                User.is_active == True,
            )
        )
        return result.scalar_one()

    # ── Permissions ─────────────────────────────────────────────────────────

    async def get_all_permissions(self) -> list[Permission]:
        result = await self.db.execute(
            select(Permission).order_by(Permission.module, Permission.name)
        )
        return result.scalars().all()
