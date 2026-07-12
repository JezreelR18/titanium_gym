from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import decode_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.modules.users.models import User, Role, RolePermission, Permission

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception
    return user


def _user_has_permission(user, perm_name: str) -> bool:
    if not user.role or not hasattr(user.role, "role_permissions"):
        return False
    return any(
        rp.permission and rp.permission.name == perm_name
        for rp in user.role.role_permissions
    )


async def require_owner(current_user=Depends(get_current_user)):
    role = getattr(current_user.role, "name", "").lower()
    if role not in ("propietario", "administrador"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
    return current_user


def require_permission(perm_name: str):
    async def _check(current_user=Depends(get_current_user)):
        role = getattr(current_user.role, "name", "").lower()
        if role == "propietario" or _user_has_permission(current_user, perm_name):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Se requiere el permiso: {perm_name}",
        )
    return _check
