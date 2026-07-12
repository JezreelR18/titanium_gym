import uuid
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date, extract
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.attendance.models import AttendanceRecord
from app.modules.members.models import Member
from app.modules.memberships.models import MemberMembership
from app.shared.enums import AttendanceMethod, MembershipStatus
from app.shared.exceptions import NotFoundError, BadRequestError
from app.shared.pagination import PaginationParams, PaginatedResponse

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)


def _today_local() -> date:
    return datetime.now(_tz).date()


def _local_date(col):
    """Convert a UTC timestamptz column to local date for filtering."""
    return cast(func.timezone(LOCAL_TZ, col), Date)


# ── Schemas ────────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    member_id: uuid.UUID
    method: AttendanceMethod = AttendanceMethod.manual
    note: Optional[str] = None


class MemberBasic(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    model_config = {"from_attributes": True}


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member: Optional[MemberBasic] = None
    checked_in_at: datetime
    checked_out_at: Optional[datetime] = None
    method: AttendanceMethod
    note: Optional[str] = None
    model_config = {"from_attributes": True}


class DayCount(BaseModel):
    date: str
    count: int


class HourCount(BaseModel):
    hour: int
    count: int


class AttendanceStats(BaseModel):
    today: int
    this_week: int
    this_month: int
    daily_last_7: list[DayCount]
    peak_hours: list[HourCount]


# ── Helper ─────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _build_response(record: AttendanceRecord, db: AsyncSession) -> AttendanceResponse:
    res = await db.execute(select(Member).where(Member.id == record.member_id))
    member = res.scalar_one_or_none()
    data = AttendanceResponse.model_validate(record)
    if member:
        data.member = MemberBasic.model_validate(member)
    return data


# ── Check-in ───────────────────────────────────────────────────

@router.post("/check-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def check_in(
    data: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Verify member exists
    res = await db.execute(select(Member).where(Member.id == data.member_id, Member.is_active == True))
    member = res.scalar_one_or_none()
    if not member:
        raise NotFoundError("Miembro")

    # Check active membership (warning — we still allow check-in but flag it)
    today = date.today()
    mem_res = await db.execute(
        select(MemberMembership).where(
            and_(
                MemberMembership.member_id == data.member_id,
                MemberMembership.status == MembershipStatus.active,
                MemberMembership.start_date <= today,
                MemberMembership.end_date >= today,
            )
        )
    )
    active_membership = mem_res.scalar_one_or_none()
    if not active_membership:
        raise BadRequestError("El miembro no tiene una membresía activa vigente")

    record = AttendanceRecord(
        member_id=data.member_id,
        method=data.method,
        note=data.note,
        registered_by=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return await _build_response(record, db)


# ── Check-out ──────────────────────────────────────────────────

@router.put("/{record_id}/check-out", response_model=AttendanceResponse)
async def check_out(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(AttendanceRecord).where(AttendanceRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("Registro de asistencia")
    record.checked_out_at = _now_utc()
    await db.commit()
    await db.refresh(record)
    return await _build_response(record, db)


# ── Today's check-ins ──────────────────────────────────────────

@router.get("/today", response_model=list[AttendanceResponse])
async def today_attendance(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today_local()
    result = await db.execute(
        select(AttendanceRecord)
        .where(_local_date(AttendanceRecord.checked_in_at) == today)
        .order_by(AttendanceRecord.checked_in_at.desc())
    )
    records = result.scalars().all()
    return [await _build_response(r, db) for r in records]


# ── History (paginated + filterable) ──────────────────────────

@router.get("/", response_model=PaginatedResponse[AttendanceResponse])
async def list_attendance(
    member_id: Optional[uuid.UUID] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    filters = []
    if member_id:
        filters.append(AttendanceRecord.member_id == member_id)
    if date_from:
        filters.append(_local_date(AttendanceRecord.checked_in_at) >= date_from)
    if date_to:
        filters.append(_local_date(AttendanceRecord.checked_in_at) <= date_to)

    base_q = select(AttendanceRecord).where(*filters) if filters else select(AttendanceRecord)

    total_res = await db.execute(select(func.count()).select_from(base_q.subquery()))
    total = total_res.scalar_one()

    result = await db.execute(
        base_q.order_by(AttendanceRecord.checked_in_at.desc())
        .offset(params.offset)
        .limit(params.limit)
    )
    records = result.scalars().all()
    items = [await _build_response(r, db) for r in records]
    return PaginatedResponse.build(items, total, params)


# ── Stats ──────────────────────────────────────────────────────

@router.get("/stats", response_model=AttendanceStats)
async def attendance_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today_local()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    async def _count(d_from: date, d_to: date) -> int:
        res = await db.execute(
            select(func.count(AttendanceRecord.id)).where(
                and_(
                    _local_date(AttendanceRecord.checked_in_at) >= d_from,
                    _local_date(AttendanceRecord.checked_in_at) <= d_to,
                )
            )
        )
        return res.scalar_one()

    today_count = await _count(today, today)
    week_count = await _count(week_start, today)
    month_count = await _count(month_start, today)

    # Daily counts last 7 days
    local_day_col = _local_date(AttendanceRecord.checked_in_at).label("day")
    daily_rows = await db.execute(
        select(local_day_col, func.count(AttendanceRecord.id).label("cnt"))
        .where(_local_date(AttendanceRecord.checked_in_at) >= today - timedelta(days=6))
        .group_by("day")
        .order_by("day")
    )
    daily_last_7 = [DayCount(date=str(r.day), count=r.cnt) for r in daily_rows]

    # Peak hours in local time (last 30 days)
    local_ts_col = func.timezone(LOCAL_TZ, AttendanceRecord.checked_in_at)
    hour_rows = await db.execute(
        select(
            extract("hour", local_ts_col).label("hr"),
            func.count(AttendanceRecord.id).label("cnt"),
        )
        .where(_local_date(AttendanceRecord.checked_in_at) >= today - timedelta(days=30))
        .group_by("hr")
        .order_by("hr")
    )
    peak_hours = [HourCount(hour=int(r.hr), count=r.cnt) for r in hour_rows]

    return AttendanceStats(
        today=today_count,
        this_week=week_count,
        this_month=month_count,
        daily_last_7=daily_last_7,
        peak_hours=peak_hours,
    )


# ── Member history ─────────────────────────────────────────────

@router.get("/member/{member_id}", response_model=list[AttendanceResponse])
async def member_attendance(
    member_id: uuid.UUID,
    limit: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.member_id == member_id)
        .order_by(AttendanceRecord.checked_in_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return [await _build_response(r, db) for r in records]
