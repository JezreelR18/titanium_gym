from pydantic import BaseModel
from app.modules.users.schemas import UserResponse


class LoginRequest(BaseModel):
    login: str  # email or username
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
