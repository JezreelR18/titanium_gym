import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.modules.members.repository import MemberRepository
from app.modules.members.schemas import MemberCreate, MemberUpdate, EmergencyContactCreate, PhysicalStatsCreate, MemberResponse, MemberListResponse
from app.shared.exceptions import NotFoundError, ConflictError
from app.shared.pagination import PaginationParams, PaginatedResponse


class MemberService:
    def __init__(self, db: AsyncSession):
        self.repo = MemberRepository(db)

    async def get_all(self, params: PaginationParams, search: str | None = None) -> PaginatedResponse[MemberListResponse]:
        members, total = await self.repo.get_all(offset=params.offset, limit=params.limit, search=search)
        return PaginatedResponse.build(
            data=[MemberListResponse.model_validate(m) for m in members],
            total=total,
            params=params,
        )

    async def get_by_id(self, member_id: uuid.UUID) -> MemberResponse:
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        return MemberResponse.model_validate(member)

    async def _next_member_code(self) -> str:
        result = await self.repo.db.execute(text("SELECT nextval('member_code_seq')"))
        n = result.scalar_one()
        return f"MB-{n:05d}"

    async def create(self, data: MemberCreate, created_by: uuid.UUID) -> MemberResponse:
        member_code = await self._next_member_code()
        member = await self.repo.create(data, created_by, member_code=member_code)
        return MemberResponse.model_validate(member)

    async def update(self, member_id: uuid.UUID, data: MemberUpdate, updated_by: uuid.UUID) -> MemberResponse:
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        member = await self.repo.update(member, data, updated_by)
        return MemberResponse.model_validate(member)

    async def delete(self, member_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        await self.repo.soft_delete(member, deleted_by)

    async def add_emergency_contact(self, member_id: uuid.UUID, data: EmergencyContactCreate, created_by: uuid.UUID):
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        return await self.repo.add_emergency_contact(member_id, data, created_by)

    async def delete_emergency_contact(self, member_id: uuid.UUID, contact_id: uuid.UUID) -> None:
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        deleted = await self.repo.delete_emergency_contact(contact_id)
        if not deleted:
            raise NotFoundError("EmergencyContact")

    async def add_physical_stats(self, member_id: uuid.UUID, data: PhysicalStatsCreate, created_by: uuid.UUID):
        member = await self.repo.get_by_id(member_id)
        if not member:
            raise NotFoundError("Member")
        return await self.repo.add_physical_stats(member_id, data, created_by)
