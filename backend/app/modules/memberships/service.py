import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.memberships.repository import MembershipRepository
from app.modules.memberships.schemas import PlanCreate, PlanUpdate, PlanResponse, MembershipAssign, MembershipUpdate, MembershipResponse
from app.shared.exceptions import NotFoundError, BadRequestError


class MembershipService:
    def __init__(self, db: AsyncSession):
        self.repo = MembershipRepository(db)

    async def get_plans(self, active_only: bool = False) -> list[PlanResponse]:
        plans = await self.repo.get_all_plans(active_only)
        return [PlanResponse.model_validate(p) for p in plans]

    async def get_plan(self, plan_id: uuid.UUID) -> PlanResponse:
        plan = await self.repo.get_plan_by_id(plan_id)
        if not plan:
            raise NotFoundError("Membership plan")
        return PlanResponse.model_validate(plan)

    async def create_plan(self, data: PlanCreate, created_by: uuid.UUID) -> PlanResponse:
        plan = await self.repo.create_plan(data, created_by)
        return PlanResponse.model_validate(plan)

    async def update_plan(self, plan_id: uuid.UUID, data: PlanUpdate, updated_by: uuid.UUID) -> PlanResponse:
        plan = await self.repo.get_plan_by_id(plan_id)
        if not plan:
            raise NotFoundError("Membership plan")
        plan = await self.repo.update_plan(plan, data, updated_by)
        return PlanResponse.model_validate(plan)

    async def assign(self, data: MembershipAssign, created_by: uuid.UUID) -> MembershipResponse:
        plan = await self.repo.get_plan_by_id(data.plan_id)
        if not plan:
            raise NotFoundError("Membership plan")
        if not plan.is_active:
            raise BadRequestError("This plan is no longer active")
        membership = await self.repo.assign(data, plan, created_by)
        return MembershipResponse.model_validate(membership)

    async def get_member_memberships(self, member_id: uuid.UUID) -> list[MembershipResponse]:
        memberships = await self.repo.get_member_memberships(member_id)
        return [MembershipResponse.model_validate(m) for m in memberships]

    async def update_membership(self, membership_id: uuid.UUID, data: MembershipUpdate, updated_by: uuid.UUID) -> MembershipResponse:
        membership = await self.repo.get_membership_by_id(membership_id)
        if not membership:
            raise NotFoundError("Membership")
        membership = await self.repo.update_membership(membership, data, updated_by)
        return MembershipResponse.model_validate(membership)

    async def get_expiring_soon(self, days: int = 7) -> list[MembershipResponse]:
        memberships = await self.repo.get_expiring_soon(days)
        return [MembershipResponse.model_validate(m) for m in memberships]
