import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.modules.memberships.repository import MembershipRepository
from app.modules.memberships.schemas import PlanCreate, PlanUpdate, PlanResponse, MembershipAssign, MembershipUpdate, MembershipResponse
from app.modules.memberships.models import MemberMembership
from app.modules.memberships.models import MembershipPlan
from app.shared.exceptions import NotFoundError, BadRequestError
from app.shared.enums import SaleStatus, PaymentStatus, DebtStatus


class MembershipService:
    def __init__(self, db: AsyncSession):
        self.repo = MembershipRepository(db)
        self.db = db

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
        await self._create_membership_sale(membership, plan, data, created_by)
        # Re-fetch with joined plan
        result = await self.db.execute(
            select(MemberMembership).where(MemberMembership.id == membership.id)
        )
        membership = result.scalar_one()
        return MembershipResponse.model_validate(membership)

    async def _create_membership_sale(
        self,
        membership: MemberMembership,
        plan: MembershipPlan,
        data: MembershipAssign,
        created_by: uuid.UUID,
    ) -> None:
        from app.modules.sales.models import Sale, SaleDetail, SalePayment, Debt

        year = datetime.now().year
        count_result = await self.db.execute(
            text("SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM sale_date) = :year"),
            {"year": year},
        )
        sale_number = f"TG-{year}-{(count_result.scalar_one() + 1):05d}"

        final_price = membership.final_price
        paid = data.paid_amount.quantize(Decimal("0.01"))
        discount_amount = (plan.price - final_price).quantize(Decimal("0.01"))
        remaining = (final_price - paid).quantize(Decimal("0.01"))

        if paid > final_price:
            raise BadRequestError("El monto pagado no puede ser mayor al precio final")

        payment_status = (
            PaymentStatus.paid if remaining == 0
            else PaymentStatus.partial if paid > 0
            else PaymentStatus.pending
        )

        sale = Sale(
            member_id=data.member_id,
            cashier_id=created_by,
            sale_number=sale_number,
            subtotal=final_price,
            discount_amount=discount_amount,
            total_amount=final_price,
            paid_amount=paid,
            change_amount=Decimal("0"),
            status=SaleStatus.confirmed,
            payment_status=payment_status,
            note=data.note,
            created_by=created_by,
        )
        self.db.add(sale)
        await self.db.flush()

        detail = SaleDetail(
            sale_id=sale.id,
            membership_plan_id=plan.id,
            description=f"Membresía: {plan.name}",
            quantity=Decimal("1"),
            unit_price=plan.price,
            discount_pct=data.discount_pct,
            discount_amount=discount_amount,
            subtotal=final_price,
            created_by=created_by,
        )
        self.db.add(detail)

        if paid > 0 and data.payment_method_id:
            payment = SalePayment(
                sale_id=sale.id,
                payment_method_id=data.payment_method_id,
                amount=paid,
                reference_code=data.reference_code,
                created_by=created_by,
            )
            self.db.add(payment)

        if remaining > 0:
            due_date = datetime.combine(
                membership.end_date,
                datetime.min.time(),
            ).replace(tzinfo=timezone.utc)
            debt = Debt(
                member_id=data.member_id,
                sale_id=sale.id,
                membership_id=membership.id,
                concept=f"Membresía: {plan.name}",
                original_amount=final_price,
                paid_amount=paid,
                remaining_amount=remaining,
                status=DebtStatus.pending,
                due_date=due_date,
                created_by=created_by,
            )
            self.db.add(debt)

        await self.db.commit()

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
