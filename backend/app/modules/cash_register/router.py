import json
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.sales.models import Sale, SalePayment, PaymentMethod
from app.modules.cash_register.models import CashClosing, CashClosingDenomination, ClosingStatus
from app.shared.enums import SaleStatus

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)

METHOD_LABELS = {
    "cash": "Efectivo",
    "card": "Tarjeta",
    "bank_transfer": "Transferencia",
    "credit": "Crédito",
    "qr_code": "QR / Digital",
}


def _today() -> date:
    return datetime.now(_tz).date()


def _local_date(col):
    return cast(func.timezone(LOCAL_TZ, col), Date)


# ── Schemas ────────────────────────────────────────────────────

class PaymentBreakdownItem(BaseModel):
    method: str
    display_name: str
    count: int
    amount: Decimal


class SalesSummary(BaseModel):
    closing_date: date
    total_sales_count: int
    total_sales_amount: Decimal
    cash_sales_amount: Decimal
    payment_breakdown: list[PaymentBreakdownItem]
    existing_closing: Optional[dict] = None


class DenominationIn(BaseModel):
    type: str          # 'bill' | 'coin'
    denomination: Decimal
    quantity: int


class ClosingCreate(BaseModel):
    closing_date: date
    denominations: list[DenominationIn]
    notes: Optional[str] = None


class DenominationOut(BaseModel):
    id: uuid.UUID
    type: str
    denomination: Decimal
    quantity: int
    subtotal: Decimal

    class Config:
        from_attributes = True


class ClosingOut(BaseModel):
    id: uuid.UUID
    closing_date: date
    status: str
    total_sales_count: int
    total_sales_amount: Decimal
    payment_breakdown: list[PaymentBreakdownItem]
    cash_sales_amount: Decimal
    cash_counted_amount: Decimal
    difference: Decimal
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime]
    denominations: list[DenominationOut]

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────

async def _build_sales_summary(db: AsyncSession, target_date: date) -> tuple[int, Decimal, Decimal, list[PaymentBreakdownItem]]:
    """Return (count, total_amount, cash_amount, payment_breakdown) for a given date."""
    # All confirmed sales for the date
    sale_ids_q = await db.execute(
        select(Sale.id).where(
            Sale.status == SaleStatus.confirmed,
            _local_date(Sale.sale_date) == target_date,
        )
    )
    sale_ids = [r[0] for r in sale_ids_q.all()]
    total_count = len(sale_ids)

    if not sale_ids:
        return 0, Decimal("0"), Decimal("0"), []

    total_amount_q = await db.execute(
        select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
            Sale.status == SaleStatus.confirmed,
            _local_date(Sale.sale_date) == target_date,
        )
    )
    total_amount = Decimal(str(total_amount_q.scalar_one()))

    # Breakdown by payment method
    breakdown_q = await db.execute(
        select(
            PaymentMethod.name,
            func.count(SalePayment.id).label("cnt"),
            func.coalesce(func.sum(SalePayment.amount), 0).label("total"),
        )
        .join(PaymentMethod, PaymentMethod.id == SalePayment.payment_method_id)
        .where(SalePayment.sale_id.in_(sale_ids))
        .group_by(PaymentMethod.name)
        .order_by(func.sum(SalePayment.amount).desc())
    )
    breakdown: list[PaymentBreakdownItem] = []
    cash_total = Decimal("0")
    for row in breakdown_q.all():
        method = row.name
        amount = Decimal(str(row.total))
        item = PaymentBreakdownItem(
            method=method,
            display_name=METHOD_LABELS.get(method, method),
            count=row.cnt,
            amount=amount,
        )
        breakdown.append(item)
        if method == "cash":
            cash_total = amount

    return total_count, total_amount, cash_total, breakdown


def _serialize_breakdown(breakdown: list[PaymentBreakdownItem]) -> str:
    return json.dumps([b.model_dump(mode="json") for b in breakdown])


def _deserialize_breakdown(raw: str) -> list[PaymentBreakdownItem]:
    try:
        items = json.loads(raw or "[]")
        return [PaymentBreakdownItem(**i) for i in items]
    except Exception:
        return []


def _closing_to_out(closing: CashClosing) -> ClosingOut:
    return ClosingOut(
        id=closing.id,
        closing_date=closing.closing_date,
        status=closing.status,
        total_sales_count=closing.total_sales_count,
        total_sales_amount=closing.total_sales_amount,
        payment_breakdown=_deserialize_breakdown(closing.payment_breakdown),
        cash_sales_amount=closing.cash_sales_amount,
        cash_counted_amount=closing.cash_counted_amount,
        difference=closing.difference,
        notes=closing.notes,
        created_at=closing.created_at,
        updated_at=closing.updated_at,
        closed_at=closing.closed_at,
        denominations=[
            DenominationOut(
                id=d.id,
                type=d.type,
                denomination=d.denomination,
                quantity=d.quantity,
                subtotal=d.subtotal,
            )
            for d in closing.denominations
        ],
    )


# ── Endpoints ──────────────────────────────────────────────────

@router.get("/summary", response_model=SalesSummary)
async def get_summary(
    target_date: Optional[date] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    if target_date is None:
        target_date = _today()

    count, total, cash_total, breakdown = await _build_sales_summary(db, target_date)

    # Check for existing closing
    existing_q = await db.execute(
        select(CashClosing)
        .where(CashClosing.closing_date == target_date)
        .options(selectinload(CashClosing.denominations))
    )
    existing = existing_q.scalar_one_or_none()
    existing_dict = None
    if existing:
        existing_dict = _closing_to_out(existing).model_dump(mode="json")

    return SalesSummary(
        closing_date=target_date,
        total_sales_count=count,
        total_sales_amount=total,
        cash_sales_amount=cash_total,
        payment_breakdown=breakdown,
        existing_closing=existing_dict,
    )


@router.get("/", response_model=list[ClosingOut])
async def list_closings(
    skip: int = 0,
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = await db.execute(
        select(CashClosing)
        .options(selectinload(CashClosing.denominations))
        .order_by(CashClosing.closing_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return [_closing_to_out(c) for c in q.scalars().all()]


@router.get("/{closing_id}", response_model=ClosingOut)
async def get_closing(
    closing_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = await db.execute(
        select(CashClosing)
        .where(CashClosing.id == closing_id)
        .options(selectinload(CashClosing.denominations))
    )
    closing = q.scalar_one_or_none()
    if not closing:
        raise HTTPException(status_code=404, detail="Corte no encontrado")
    return _closing_to_out(closing)


@router.post("/", response_model=ClosingOut, status_code=201)
async def create_or_update_closing(
    body: ClosingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check for existing draft (can update), closed (cannot)
    q = await db.execute(
        select(CashClosing)
        .where(CashClosing.closing_date == body.closing_date)
        .options(selectinload(CashClosing.denominations))
    )
    existing = q.scalar_one_or_none()
    if existing and existing.status == ClosingStatus.closed:
        raise HTTPException(status_code=409, detail="Ya existe un corte cerrado para esta fecha")

    # Get fresh sales data
    count, total, cash_total, breakdown = await _build_sales_summary(db, body.closing_date)

    # Calculate cash counted from denominations
    cash_counted = sum(Decimal(str(d.denomination)) * d.quantity for d in body.denominations)
    difference = cash_counted - cash_total

    if existing:
        # Update existing draft
        closing = existing
        closing.total_sales_count = count
        closing.total_sales_amount = total
        closing.payment_breakdown = _serialize_breakdown(breakdown)
        closing.cash_sales_amount = cash_total
        closing.cash_counted_amount = cash_counted
        closing.difference = difference
        closing.notes = body.notes
        closing.updated_at = datetime.now(timezone.utc)
        # Replace denominations
        for d in list(closing.denominations):
            await db.delete(d)
        await db.flush()
    else:
        closing = CashClosing(
            closing_date=body.closing_date,
            status=ClosingStatus.draft,
            total_sales_count=count,
            total_sales_amount=total,
            payment_breakdown=_serialize_breakdown(breakdown),
            cash_sales_amount=cash_total,
            cash_counted_amount=cash_counted,
            difference=difference,
            notes=body.notes,
            created_by=current_user.id,
        )
        db.add(closing)
        await db.flush()

    # Add denominations
    for d in body.denominations:
        if d.quantity < 0:
            raise HTTPException(status_code=422, detail="Las cantidades no pueden ser negativas")
        subtotal = Decimal(str(d.denomination)) * d.quantity
        denom = CashClosingDenomination(
            closing_id=closing.id,
            type=d.type,
            denomination=d.denomination,
            quantity=d.quantity,
            subtotal=subtotal,
        )
        db.add(denom)

    await db.commit()
    await db.refresh(closing)
    # Reload with denominations
    q = await db.execute(
        select(CashClosing)
        .where(CashClosing.id == closing.id)
        .options(selectinload(CashClosing.denominations))
    )
    closing = q.scalar_one()
    return _closing_to_out(closing)


@router.put("/{closing_id}/close", response_model=ClosingOut)
async def close_closing(
    closing_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = await db.execute(
        select(CashClosing)
        .where(CashClosing.id == closing_id)
        .options(selectinload(CashClosing.denominations))
    )
    closing = q.scalar_one_or_none()
    if not closing:
        raise HTTPException(status_code=404, detail="Corte no encontrado")
    if closing.status == ClosingStatus.closed:
        raise HTTPException(status_code=409, detail="El corte ya está cerrado")

    now = datetime.now(timezone.utc)
    closing.status = ClosingStatus.closed
    closing.closed_at = now
    closing.closed_by = current_user.id
    closing.updated_at = now
    await db.commit()
    await db.refresh(closing)
    q = await db.execute(
        select(CashClosing)
        .where(CashClosing.id == closing.id)
        .options(selectinload(CashClosing.denominations))
    )
    return _closing_to_out(q.scalar_one())


@router.delete("/{closing_id}", status_code=204)
async def delete_closing(
    closing_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = await db.execute(select(CashClosing).where(CashClosing.id == closing_id))
    closing = q.scalar_one_or_none()
    if not closing:
        raise HTTPException(status_code=404, detail="Corte no encontrado")
    if closing.status == ClosingStatus.closed:
        raise HTTPException(status_code=409, detail="No se puede eliminar un corte cerrado")
    await db.delete(closing)
    await db.commit()
