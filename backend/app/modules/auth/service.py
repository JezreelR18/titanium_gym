from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.repository import UserRepository
from app.modules.auth.schemas import LoginRequest, TokenResponse
from app.modules.users.schemas import UserResponse
from app.core.security import verify_password, create_access_token
from app.shared.exceptions import UnauthorizedError


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def login(self, data: LoginRequest) -> TokenResponse:
        if "@" in data.login:
            user = await self.repo.get_by_email(data.login)
        else:
            user = await self.repo.get_by_username(data.login)

        if not user or not verify_password(data.password, user.password_hash):
            raise UnauthorizedError("Credenciales incorrectas")

        if not user.is_active:
            raise UnauthorizedError("Account is disabled")

        await self.repo.update_last_login(user)
        token = create_access_token(subject=str(user.id))

        return TokenResponse(
            access_token=token,
            user=UserResponse.from_user(user),
        )
