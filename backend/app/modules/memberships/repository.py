import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.modules.memberships.models import MembershipPlan, MemberMembership
from app.modules.memberships.schemas import PlanCreate, PlanUpdate, MembershipAssign, MembershipUpdate
from app.shared.enums import MembershipStatus


class MembershipRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Plans ──────────────────────────────────────────────────

    async def get_plan_by_id(self, plan_id: uuid.UUID) -> MembershipPlan | None:
        result = await self.db.execute(select(MembershipPlan).where(MembershipPlan.id == plan_id))
        return result.scalar_one_or_none()

    async def get_all_plans(self, active_only: bool = False) -> list[MembershipPlan]:
        q = select(MembershipPlan)
        if active_only:
            q = q.where(MembershipPlan.is_active == True)
        result = await self.db.execute(q.order_by(MembershipPlan.price))
        return result.scalars().all()

    async def create_plan(self, data: PlanCreate, created_by: uuid.UUID) -> MembershipPlan:
        plan = MembershipPlan(**data.model_dump(), created_by=created_by)
        self.db.add(plan)
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    async def update_plan(self, plan: MembershipPlan, data: PlanUpdate, updated_by: uuid.UUID) -> MembershipPlan:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(plan, field, value)
        plan.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(plan)
        return plan

    # ── Member Memberships ─────────────────────────────────────

    async def get_membership_by_id(self, membership_id: uuid.UUID) -> MemberMembership | None:
        result = await self.db.execute(select(MemberMembership).where(MemberMembership.id == membership_id))
        return result.scalar_one_or_none()

    async def get_member_memberships(self, member_id: uuid.UUID) -> list[MemberMembership]:
        result = await self.db.execute(
            select(MemberMembership)
            .where(MemberMembership.member_id == member_id)
            .order_by(MemberMembership.created_at.desc())
        )
        return result.scalars().all()

    async def get_active_membership(self, member_id: uuid.UUID) -> MemberMembership | None:
        result = await self.db.execute(
            select(MemberMembership).where(
                MemberMembership.member_id == member_id,
                MemberMembership.status == MembershipStatus.active,
            )
        )
        return result.scalar_one_or_none()

    async def assign(self, data: MembershipAssign, plan: MembershipPlan, created_by: uuid.UUID) -> MemberMembership:
        end_date = data.start_date + timedelta(days=plan.duration_days)
        discount = data.discount_pct / Decimal("100")
        final_price = plan.price * (1 - discount)

        membership = MemberMembership(
            member_id=data.member_id,
            plan_id=data.plan_id,
            start_date=data.start_date,
            end_date=end_date,
            discount_pct=data.discount_pct,
            final_price=final_price.quantize(Decimal("0.01")),
            auto_renew=data.auto_renew,
            note=data.note,
            status=MembershipStatus.active,
            created_by=created_by,
        )
        self.db.add(membership)
        await self.db.commit()
        await self.db.refresh(membership)
        return membership

    async def update_membership(self, membership: MemberMembership, data: MembershipUpdate, updated_by: uuid.UUID) -> MemberMembership:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(membership, field, value)
        membership.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(membership)
        return membership

    async def get_expiring_soon(self, days: int = 7) -> list[MemberMembership]:
        from datetime import date
        today = date.today()
        cutoff = today + timedelta(days=days)
        result = await self.db.execute(
            select(MemberMembership).where(
                MemberMembership.status == MembershipStatus.active,
                MemberMembership.end_date <= cutoff,
                MemberMembership.end_date >= today,
            )
        )
        return result.scalars().all()
