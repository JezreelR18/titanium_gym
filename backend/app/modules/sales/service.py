import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from app.modules.sales.models import Sale, SaleDetail, SalePayment, Debt, DebtPayment, PaymentMethod
from app.modules.sales.schemas import (
    SaleCreate, SaleResponse, SaleListResponse,
    DebtPaymentCreate, DebtResponse,
)
from app.modules.inventory.models import Product, InventoryMovement
from app.modules.members.models import Member
from app.shared.exceptions import NotFoundError, BadRequestError
from app.shared.pagination import PaginationParams, PaginatedResponse
from app.shared.enums import SaleStatus, PaymentStatus, DebtStatus, MovementType


def _member_name(first: str | None, last: str | None) -> str | None:
    if first or last:
        return f"{first or ''} {last or ''}".strip()
    return None


class SalesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_sale_number(self) -> str:
        year = datetime.now().year
        result = await self.db.execute(
            text("SELECT COUNT(*) FROM sales WHERE EXTRACT(YEAR FROM sale_date) = :year"),
            {"year": year},
        )
        count = result.scalar_one() + 1
        return f"TG-{year}-{count:05d}"

    async def _load_sale(self, sale_id: uuid.UUID) -> Sale:
        result = await self.db.execute(
            select(Sale)
            .options(
                selectinload(Sale.details),
                selectinload(Sale.payments),
            )
            .where(Sale.id == sale_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: SaleCreate, cashier_id: uuid.UUID) -> SaleResponse:
        sale_number = await self._next_sale_number()

        subtotal = Decimal("0")
        details_to_add = []
        product_adjustments: list[tuple[uuid.UUID, int]] = []

        for item in data.details:
            discount_amount = (item.unit_price * item.quantity * item.discount_pct / 100).quantize(Decimal("0.01"))
            item_subtotal = (item.unit_price * item.quantity - discount_amount).quantize(Decimal("0.01"))
            subtotal += item_subtotal
            details_to_add.append({
                "product_id": item.product_id,
                "membership_plan_id": item.membership_plan_id,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount_pct": item.discount_pct,
                "discount_amount": discount_amount,
                "subtotal": item_subtotal,
                "created_by": cashier_id,
            })
            if item.product_id:
                product_adjustments.append((item.product_id, int(item.quantity)))

        total_amount = subtotal
        paid_amount = sum(p.amount for p in data.payments) if data.payments else Decimal("0")
        change_amount = max(paid_amount - total_amount, Decimal("0"))

        if paid_amount >= total_amount:
            payment_status = PaymentStatus.paid
        elif paid_amount > 0:
            payment_status = PaymentStatus.partial
        else:
            payment_status = PaymentStatus.pending

        sale = Sale(
            member_id=data.member_id,
            cashier_id=cashier_id,
            sale_number=sale_number,
            subtotal=subtotal,
            discount_amount=Decimal("0"),
            tax_amount=Decimal("0"),
            total_amount=total_amount,
            paid_amount=min(paid_amount, total_amount),
            change_amount=change_amount,
            status=SaleStatus.confirmed,
            payment_status=payment_status,
            note=data.note,
            created_by=cashier_id,
        )
        self.db.add(sale)
        await self.db.flush()

        for d in details_to_add:
            self.db.add(SaleDetail(sale_id=sale.id, **d))

        for p in data.payments:
            self.db.add(SalePayment(
                sale_id=sale.id,
                payment_method_id=p.payment_method_id,
                amount=p.amount,
                reference_code=p.reference_code,
                created_by=cashier_id,
            ))

        # Reduce stock and create inventory movements for each product sold
        for product_id, qty in product_adjustments:
            prod_result = await self.db.execute(select(Product).where(Product.id == product_id))
            product = prod_result.scalar_one_or_none()
            if product:
                product.stock = max(product.stock - qty, 0)
                self.db.add(InventoryMovement(
                    product_id=product_id,
                    type=MovementType.sale,
                    quantity=qty,
                    unit_price=None,
                    total_price=None,
                    reference=sale_number,
                    sale_id=sale.id,
                    note=f"Venta {sale_number}",
                    created_by=cashier_id,
                ))

        should_create_debt = (
            payment_status != PaymentStatus.paid
            and (data.member_id is not None or data.create_anonymous_debt)
        )
        if should_create_debt:
            remaining = total_amount - min(paid_amount, total_amount)
            self.db.add(Debt(
                member_id=data.member_id,
                sale_id=sale.id,
                concept=f"Venta {sale_number}",
                original_amount=total_amount,
                paid_amount=min(paid_amount, total_amount),
                remaining_amount=remaining,
                status=DebtStatus.partial if paid_amount > 0 else DebtStatus.pending,
                created_by=cashier_id,
            ))

        await self.db.commit()

        sale = await self._load_sale(sale.id)
        member_name = None
        if data.member_id:
            m = (await self.db.execute(select(Member).where(Member.id == data.member_id))).scalar_one_or_none()
            if m:
                member_name = _member_name(m.first_name, m.last_name)

        resp = SaleResponse.model_validate(sale)
        resp.member_name = member_name
        return resp

    async def get_by_id(self, sale_id: uuid.UUID) -> SaleResponse:
        sale = await self._load_sale(sale_id)
        if not sale:
            raise NotFoundError("Sale")

        member_name = None
        if sale.member_id:
            m = (await self.db.execute(select(Member).where(Member.id == sale.member_id))).scalar_one_or_none()
            if m:
                member_name = _member_name(m.first_name, m.last_name)

        resp = SaleResponse.model_validate(sale)
        resp.member_name = member_name
        return resp

    async def get_all(
        self,
        params: PaginationParams,
        search: str | None = None,
        payment_status: str | None = None,
    ) -> PaginatedResponse[SaleListResponse]:
        q = (
            select(Sale, Member.first_name, Member.last_name)
            .outerjoin(Member, Sale.member_id == Member.id)
            .order_by(Sale.sale_date.desc())
        )
        count_q = select(func.count()).select_from(Sale)

        if search:
            like = f"%{search}%"
            name_filter = (Member.first_name + " " + Member.last_name).ilike(like)
            q = q.where((Sale.sale_number.ilike(like)) | name_filter)
            count_q = count_q.outerjoin(Member, Sale.member_id == Member.id).where(
                (Sale.sale_number.ilike(like)) | name_filter
            )

        if payment_status:
            q = q.where(Sale.payment_status == payment_status)
            count_q = count_q.where(Sale.payment_status == payment_status)

        q = q.offset(params.offset).limit(params.limit)

        rows = (await self.db.execute(q)).all()
        total = (await self.db.execute(count_q)).scalar_one()

        data = [
            SaleListResponse(
                id=sale.id,
                sale_number=sale.sale_number,
                member_id=sale.member_id,
                member_name=_member_name(first, last),
                sale_date=sale.sale_date,
                total_amount=sale.total_amount,
                paid_amount=sale.paid_amount,
                change_amount=sale.change_amount,
                status=sale.status,
                payment_status=sale.payment_status,
            )
            for sale, first, last in rows
        ]
        return PaginatedResponse.build(data=data, total=total, params=params)

    async def cancel(self, sale_id: uuid.UUID, updated_by: uuid.UUID) -> SaleResponse:
        sale = await self._load_sale(sale_id)
        if not sale:
            raise NotFoundError("Sale")
        if sale.status == SaleStatus.cancelled:
            raise BadRequestError("Sale is already cancelled")
        sale.status = SaleStatus.cancelled
        sale.updated_by = updated_by
        await self.db.commit()
        sale = await self._load_sale(sale_id)
        resp = SaleResponse.model_validate(sale)
        return resp

    async def get_all_debts(
        self,
        params: PaginationParams,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> PaginatedResponse[DebtResponse]:
        q = (
            select(Debt, Member.first_name, Member.last_name, Sale.sale_number)
            .outerjoin(Member, Debt.member_id == Member.id)
            .outerjoin(Sale, Debt.sale_id == Sale.id)
            .order_by(Debt.created_at.desc())
        )
        count_q = (
            select(func.count())
            .select_from(Debt)
            .outerjoin(Member, Debt.member_id == Member.id)
        )

        if status_filter == "active":
            active_statuses = [DebtStatus.pending, DebtStatus.partial]
            q = q.where(Debt.status.in_(active_statuses))
            count_q = count_q.where(Debt.status.in_(active_statuses))
        elif status_filter:
            q = q.where(Debt.status == status_filter)
            count_q = count_q.where(Debt.status == status_filter)

        if search:
            like = f"%{search}%"
            name_filter = (Member.first_name + " " + Member.last_name).ilike(like)
            q = q.where(name_filter)
            count_q = count_q.where(name_filter)

        q = q.offset(params.offset).limit(params.limit)

        rows = (await self.db.execute(q)).all()
        total = (await self.db.execute(count_q)).scalar_one()

        data = [
            DebtResponse(
                id=debt.id,
                member_id=debt.member_id,
                member_name=_member_name(first, last),
                sale_id=debt.sale_id,
                sale_number=sale_num,
                concept=debt.concept,
                original_amount=debt.original_amount,
                paid_amount=debt.paid_amount,
                remaining_amount=debt.remaining_amount,
                status=debt.status,
                due_date=debt.due_date,
                is_overdue=debt.is_overdue,
                created_at=debt.created_at,
            )
            for debt, first, last, sale_num in rows
        ]
        return PaginatedResponse.build(data=data, total=total, params=params)

    async def get_member_debts(self, member_id: uuid.UUID) -> list[DebtResponse]:
        rows = (await self.db.execute(
            select(Debt, Sale.sale_number)
            .outerjoin(Sale, Debt.sale_id == Sale.id)
            .where(Debt.member_id == member_id)
            .order_by(Debt.created_at.desc())
        )).all()
        return [
            DebtResponse(
                id=d.id,
                member_id=d.member_id,
                sale_id=d.sale_id,
                sale_number=sale_num,
                concept=d.concept,
                original_amount=d.original_amount,
                paid_amount=d.paid_amount,
                remaining_amount=d.remaining_amount,
                status=d.status,
                due_date=d.due_date,
                is_overdue=d.is_overdue,
                created_at=d.created_at,
            )
            for d, sale_num in rows
        ]

    async def pay_debt(self, debt_id: uuid.UUID, data: DebtPaymentCreate, paid_by: uuid.UUID) -> DebtResponse:
        debt = (await self.db.execute(select(Debt).where(Debt.id == debt_id))).scalar_one_or_none()
        if not debt:
            raise NotFoundError("Debt")
        if debt.status == DebtStatus.paid:
            raise BadRequestError("Debt is already paid")
        if data.amount > debt.remaining_amount:
            raise BadRequestError(f"Amount exceeds remaining balance of {debt.remaining_amount}")

        self.db.add(DebtPayment(
            debt_id=debt_id,
            payment_method_id=data.payment_method_id,
            amount=data.amount,
            reference_code=data.reference_code,
            note=data.note,
            created_by=paid_by,
        ))

        debt.paid_amount += data.amount
        debt.remaining_amount -= data.amount
        debt.status = DebtStatus.paid if debt.remaining_amount == 0 else DebtStatus.partial
        debt.updated_by = paid_by
        await self.db.commit()

        # Update sale payment_status if this debt is now paid
        if debt.sale_id and debt.status == DebtStatus.paid:
            sale = (await self.db.execute(select(Sale).where(Sale.id == debt.sale_id))).scalar_one_or_none()
            if sale:
                sale.paid_amount = sale.total_amount
                sale.payment_status = PaymentStatus.paid
                await self.db.commit()

        await self.db.refresh(debt)

        member_name = None
        if debt.member_id:
            m = (await self.db.execute(select(Member).where(Member.id == debt.member_id))).scalar_one_or_none()
            if m:
                member_name = _member_name(m.first_name, m.last_name)

        sale_num = None
        if debt.sale_id:
            s = (await self.db.execute(select(Sale.sale_number).where(Sale.id == debt.sale_id))).scalar_one_or_none()
            sale_num = s

        return DebtResponse(
            id=debt.id,
            member_id=debt.member_id,
            member_name=member_name,
            sale_id=debt.sale_id,
            sale_number=sale_num,
            concept=debt.concept,
            original_amount=debt.original_amount,
            paid_amount=debt.paid_amount,
            remaining_amount=debt.remaining_amount,
            status=debt.status,
            due_date=debt.due_date,
            is_overdue=debt.is_overdue,
            created_at=debt.created_at,
        )

    async def get_payment_methods(self) -> list:
        result = await self.db.execute(
            select(PaymentMethod).where(PaymentMethod.is_active == True)
        )
        return result.scalars().all()
