import uuid
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.lockers.models import Locker, LockerRental, LockerStatus, LockerRentalStatus
from app.shared.exceptions import NotFoundError, BadRequestError, ConflictError

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)
_utcnow = lambda: datetime.now(timezone.utc)
_today = lambda: datetime.now(_tz).date()


# ── Schemas ────────────────────────────────────────────────────

class LockerCreate(BaseModel):
    number: str
    zone: Optional[str] = None
    has_lock: bool = False
    note: Optional[str] = None


class LockerUpdate(BaseModel):
    number: Optional[str] = None
    zone: Optional[str] = None
    status: Optional[LockerStatus] = None
    has_lock: Optional[bool] = None
    note: Optional[str] = None


class MemberBasic(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    model_config = {"from_attributes": True}


class RentalBasic(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    start_date: date
    end_date: date
    price: Decimal
    currency: str
    includes_lock: bool
    deposit_amount: Decimal
    deposit_returned: bool
    status: LockerRentalStatus
    note: Optional[str] = None
    member: Optional[MemberBasic] = None
    model_config = {"from_attributes": True}


class LockerResponse(BaseModel):
    id: uuid.UUID
    number: str
    zone: Optional[str] = None
    status: LockerStatus
    has_lock: bool
    note: Optional[str] = None
    active_rental: Optional[RentalBasic] = None
    model_config = {"from_attributes": True}


class RentalCreate(BaseModel):
    member_id: uuid.UUID
    start_date: date
    end_date: date
    price: Decimal
    currency: str = "MXN"
    includes_lock: bool = False
    deposit_amount: Decimal = Decimal("0")
    note: Optional[str] = None


class RentalUpdate(BaseModel):
    end_date: Optional[date] = None
    price: Optional[Decimal] = None
    includes_lock: Optional[bool] = None
    deposit_amount: Optional[Decimal] = None
    deposit_returned: Optional[bool] = None
    status: Optional[LockerRentalStatus] = None
    note: Optional[str] = None


class RentalWithLocker(BaseModel):
    id: uuid.UUID
    locker_id: uuid.UUID
    member_id: uuid.UUID
    start_date: date
    end_date: date
    price: Decimal
    currency: str
    includes_lock: bool
    deposit_amount: Decimal
    deposit_returned: bool
    status: LockerRentalStatus
    note: Optional[str] = None
    member: Optional[MemberBasic] = None
    locker: Optional["LockerSimple"] = None
    model_config = {"from_attributes": True}


class LockerSimple(BaseModel):
    id: uuid.UUID
    number: str
    zone: Optional[str] = None
    model_config = {"from_attributes": True}


RentalWithLocker.model_rebuild()


# ── Helpers ────────────────────────────────────────────────────

async def _get_locker(locker_id: uuid.UUID, db: AsyncSession) -> Locker:
    res = await db.execute(select(Locker).where(Locker.id == locker_id))
    locker = res.scalar_one_or_none()
    if not locker:
        raise NotFoundError("Casillero")
    return locker


async def _active_rental(locker_id: uuid.UUID, db: AsyncSession) -> Optional[LockerRental]:
    res = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member))
        .where(LockerRental.locker_id == locker_id, LockerRental.status == LockerRentalStatus.active)
    )
    return res.scalar_one_or_none()


async def _locker_response(locker: Locker, db: AsyncSession) -> LockerResponse:
    rental = await _active_rental(locker.id, db)
    data = LockerResponse.model_validate(locker)
    if rental:
        data.active_rental = RentalBasic.model_validate(rental)
        if rental.member:
            data.active_rental.member = MemberBasic.model_validate(rental.member)
    return data


# ── Locker CRUD ────────────────────────────────────────────────

@router.get("", response_model=list[LockerResponse])
async def list_lockers(
    zone: Optional[str] = Query(default=None),
    status_filter: Optional[LockerStatus] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Locker)
    if zone:
        q = q.where(Locker.zone == zone)
    if status_filter:
        q = q.where(Locker.status == status_filter)
    q = q.order_by(Locker.zone.nullslast(), Locker.number)
    res = await db.execute(q)
    lockers = res.scalars().all()
    return [await _locker_response(l, db) for l in lockers]


@router.post("", response_model=LockerResponse, status_code=status.HTTP_201_CREATED)
async def create_locker(
    data: LockerCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Check duplicate number
    dup = await db.execute(select(Locker).where(Locker.number == data.number))
    if dup.scalar_one_or_none():
        raise ConflictError(f"El casillero '{data.number}' ya existe")
    locker = Locker(**data.model_dump(), created_by=current_user.id)
    db.add(locker)
    await db.commit()
    await db.refresh(locker)
    return await _locker_response(locker, db)


@router.put("/{locker_id}", response_model=LockerResponse)
async def update_locker(
    locker_id: uuid.UUID,
    data: LockerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    locker = await _get_locker(locker_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(locker, k, v)
    await db.commit()
    await db.refresh(locker)
    return await _locker_response(locker, db)


# ── Rentals ────────────────────────────────────────────────────

@router.get("/rentals", response_model=list[RentalWithLocker])
async def list_rentals(
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = (
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
    )
    if active_only:
        q = q.where(LockerRental.status == LockerRentalStatus.active)
    q = q.order_by(LockerRental.end_date)
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/rentals/expiring", response_model=list[RentalWithLocker])
async def expiring_rentals(
    days: int = Query(default=7, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today()
    cutoff = today + timedelta(days=days)
    res = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
        .where(
            LockerRental.status == LockerRentalStatus.active,
            LockerRental.end_date >= today,
            LockerRental.end_date <= cutoff,
        )
        .order_by(LockerRental.end_date)
    )
    return res.scalars().all()


@router.post("/{locker_id}/rent", response_model=RentalWithLocker, status_code=status.HTTP_201_CREATED)
async def rent_locker(
    locker_id: uuid.UUID,
    data: RentalCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    locker = await _get_locker(locker_id, db)
    if locker.status != LockerStatus.available:
        raise BadRequestError(f"El casillero no está disponible (estado: {locker.status.value})")

    rental = LockerRental(
        locker_id=locker_id,
        member_id=data.member_id,
        start_date=data.start_date,
        end_date=data.end_date,
        price=data.price,
        currency=data.currency,
        includes_lock=data.includes_lock,
        deposit_amount=data.deposit_amount,
        note=data.note,
        created_by=current_user.id,
    )
    db.add(rental)
    locker.status = LockerStatus.rented
    await db.commit()

    res = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
        .where(LockerRental.id == rental.id)
    )
    return res.scalar_one()


@router.put("/rentals/{rental_id}", response_model=RentalWithLocker)
async def update_rental(
    rental_id: uuid.UUID,
    data: RentalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    res = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
        .where(LockerRental.id == rental_id)
    )
    rental = res.scalar_one_or_none()
    if not rental:
        raise NotFoundError("Renta")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(rental, k, v)
    rental.updated_by = current_user.id

    # If cancelled, free the locker
    if data.status == LockerRentalStatus.cancelled:
        locker = await _get_locker(rental.locker_id, db)
        locker.status = LockerStatus.available

    await db.commit()
    res2 = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
        .where(LockerRental.id == rental_id)
    )
    return res2.scalar_one()


@router.get("/{locker_id}/rentals", response_model=list[RentalWithLocker])
async def locker_rental_history(
    locker_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(LockerRental)
        .options(selectinload(LockerRental.member), selectinload(LockerRental.locker))
        .where(LockerRental.locker_id == locker_id)
        .order_by(LockerRental.start_date.desc())
    )
    return res.scalars().all()
