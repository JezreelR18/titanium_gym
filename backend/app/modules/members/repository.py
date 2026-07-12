import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.modules.members.models import Member, MemberEmergencyContact, MemberPhysicalStats
from app.modules.members.schemas import MemberCreate, MemberUpdate, EmergencyContactCreate, PhysicalStatsCreate


class MemberRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, member_id: uuid.UUID) -> Member | None:
        result = await self.db.execute(
            select(Member)
            .options(selectinload(Member.emergency_contacts))
            .where(Member.id == member_id, Member.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def get_all(self, offset: int, limit: int, search: str | None = None) -> tuple[list[Member], int]:
        base_query = select(Member).where(Member.deleted_at.is_(None))
        count_query = select(func.count()).select_from(Member).where(Member.deleted_at.is_(None))

        if search:
            pattern = f"%{search}%"
            condition = or_(
                Member.first_name.ilike(pattern),
                Member.last_name.ilike(pattern),
                Member.email.ilike(pattern),
                Member.phone.ilike(pattern),
                Member.id_number.ilike(pattern),
            )
            base_query = base_query.where(condition)
            count_query = count_query.where(condition)

        base_query = base_query.order_by(Member.created_at.desc()).offset(offset).limit(limit)

        result = await self.db.execute(base_query)
        count_result = await self.db.execute(count_query)
        return result.scalars().all(), count_result.scalar_one()

    async def create(self, data: MemberCreate, created_by: uuid.UUID | None = None, member_code: str = "") -> Member:
        member = Member(
            member_code=member_code,
            first_name=data.first_name,
            last_name=data.last_name,
            email=data.email,
            phone=data.phone,
            birth_date=data.birth_date,
            gender=data.gender,
            address=data.address,
            id_number=data.id_number,
            occupation=data.occupation,
            note=data.note,
            created_by=created_by,
        )
        self.db.add(member)
        await self.db.flush()

        for ec in data.emergency_contacts:
            self.db.add(MemberEmergencyContact(
                member_id=member.id,
                **ec.model_dump(),
                created_by=created_by,
            ))

        await self.db.commit()
        return await self.get_by_id(member.id)

    async def update(self, member: Member, data: MemberUpdate, updated_by: uuid.UUID) -> Member:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(member, field, value)
        member.updated_by = updated_by
        await self.db.commit()
        return await self.get_by_id(member.id)

    async def soft_delete(self, member: Member, deleted_by: uuid.UUID) -> None:
        member.deleted_at = datetime.now(timezone.utc)
        member.deleted_by = deleted_by
        member.is_active = False
        await self.db.commit()

    async def add_emergency_contact(self, member_id: uuid.UUID, data: EmergencyContactCreate, created_by: uuid.UUID) -> MemberEmergencyContact:
        contact = MemberEmergencyContact(member_id=member_id, **data.model_dump(), created_by=created_by)
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_emergency_contact(self, contact_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(MemberEmergencyContact).where(MemberEmergencyContact.id == contact_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            return False
        await self.db.delete(contact)
        await self.db.commit()
        return True

    async def add_physical_stats(self, member_id: uuid.UUID, data: PhysicalStatsCreate, created_by: uuid.UUID) -> MemberPhysicalStats:
        stats = MemberPhysicalStats(member_id=member_id, **data.model_dump(), created_by=created_by)
        self.db.add(stats)
        await self.db.commit()
        await self.db.refresh(stats)
        return stats
