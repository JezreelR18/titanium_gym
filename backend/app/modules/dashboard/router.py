from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Optional
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date, desc
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.members.models import Member
from app.modules.memberships.models import MemberMembership, MembershipPlan
from app.modules.attendance.models import AttendanceRecord
from app.modules.sales.models import Sale
from app.shared.enums import MembershipStatus, MemberStatus, SaleStatus

try:
    from app.modules.lockers.models import LockerRental, LockerRentalStatus
    _HAS_LOCKERS = True
except ImportError:
    _HAS_LOCKERS = False

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)


def _today() -> date:
    return datetime.now(_tz).date()


def _local_date(col):
    return cast(func.timezone(LOCAL_TZ, col), Date)


# ── Schemas ────────────────────────────────────────────────────

class KpiCard(BaseModel):
    value: int | float | str
    label: str
    sublabel: Optional[str] = None
    trend: Optional[str] = None   # "up" | "down" | "neutral"


class ExpiringMembership(BaseModel):
    member_id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    plan_name: str
    end_date: date
    days_left: int


class RecentCheckin(BaseModel):
    member_code: str
    first_name: str
    last_name: str
    checked_in_at: datetime


class RecentSale(BaseModel):
    sale_number: str
    total_amount: Decimal
    sale_date: datetime


class BirthdayMember(BaseModel):
    member_id: uuid.UUID
    first_name: str
    last_name: str
    birth_date: date
    age: int
    days_until: int


class DailyCheckin(BaseModel):
    date: str
    count: int


class DashboardData(BaseModel):
    # KPIs
    active_members: int
    new_members_this_month: int
    active_memberships: int
    expiring_soon_count: int      # next 7 days
    checkins_today: int
    checkins_this_week: int
    sales_this_month: int
    revenue_this_month: Decimal
    active_lockers: int

    # Lists
    expiring_memberships: list[ExpiringMembership]
    recent_checkins: list[RecentCheckin]
    recent_sales: list[RecentSale]
    birthdays_this_week: list[BirthdayMember]
    daily_checkins_last_7: list[DailyCheckin]


# ── Endpoint ───────────────────────────────────────────────────

@router.get("/summary", response_model=DashboardData)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())

    # ── Active members ──
    r = await db.execute(
        select(func.count(Member.id)).where(Member.is_active == True, Member.deleted_at == None)
    )
    active_members = r.scalar_one()

    # ── New members this month ──
    r = await db.execute(
        select(func.count(Member.id)).where(
            Member.is_active == True,
            Member.joined_at >= month_start,
        )
    )
    new_members_this_month = r.scalar_one()

    # ── Active memberships ──
    r = await db.execute(
        select(func.count(MemberMembership.id)).where(
            MemberMembership.status == MembershipStatus.active,
            MemberMembership.end_date >= today,
        )
    )
    active_memberships = r.scalar_one()

    # ── Expiring in 7 days ──
    cutoff = today + timedelta(days=7)
    r = await db.execute(
        select(func.count(MemberMembership.id)).where(
            MemberMembership.status == MembershipStatus.active,
            MemberMembership.end_date >= today,
            MemberMembership.end_date <= cutoff,
        )
    )
    expiring_soon_count = r.scalar_one()

    # ── Expiring memberships detail ──
    r = await db.execute(
        select(MemberMembership, Member, MembershipPlan)
        .join(Member, Member.id == MemberMembership.member_id)
        .join(MembershipPlan, MembershipPlan.id == MemberMembership.plan_id)
        .where(
            MemberMembership.status == MembershipStatus.active,
            MemberMembership.end_date >= today,
            MemberMembership.end_date <= cutoff,
            Member.is_active == True,
        )
        .order_by(MemberMembership.end_date)
        .limit(10)
    )
    expiring_memberships = [
        ExpiringMembership(
            member_id=m.id,
            member_code=m.member_code,
            first_name=m.first_name,
            last_name=m.last_name,
            plan_name=p.name,
            end_date=mm.end_date,
            days_left=(mm.end_date - today).days,
        )
        for mm, m, p in r.all()
    ]

    # ── Check-ins today ──
    r = await db.execute(
        select(func.count(AttendanceRecord.id)).where(
            _local_date(AttendanceRecord.checked_in_at) == today
        )
    )
    checkins_today = r.scalar_one()

    # ── Check-ins this week ──
    r = await db.execute(
        select(func.count(AttendanceRecord.id)).where(
            _local_date(AttendanceRecord.checked_in_at) >= week_start
        )
    )
    checkins_this_week = r.scalar_one()

    # ── Daily checkins last 7 days ──
    r = await db.execute(
        select(
            _local_date(AttendanceRecord.checked_in_at).label("day"),
            func.count(AttendanceRecord.id).label("cnt"),
        )
        .where(_local_date(AttendanceRecord.checked_in_at) >= today - timedelta(days=6))
        .group_by("day")
        .order_by("day")
    )
    daily_checkins_last_7 = [DailyCheckin(date=str(row.day), count=row.cnt) for row in r]

    # ── Recent check-ins ──
    r = await db.execute(
        select(AttendanceRecord, Member)
        .join(Member, Member.id == AttendanceRecord.member_id)
        .order_by(AttendanceRecord.checked_in_at.desc())
        .limit(6)
    )
    recent_checkins = [
        RecentCheckin(
            member_code=m.member_code,
            first_name=m.first_name,
            last_name=m.last_name,
            checked_in_at=ar.checked_in_at,
        )
        for ar, m in r.all()
    ]

    # ── Sales this month ──
    r = await db.execute(
        select(func.count(Sale.id)).where(
            Sale.status == SaleStatus.confirmed,
            _local_date(Sale.sale_date) >= month_start,
        )
    )
    sales_this_month = r.scalar_one()

    # ── Revenue this month ──
    r = await db.execute(
        select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
            Sale.status == SaleStatus.confirmed,
            _local_date(Sale.sale_date) >= month_start,
        )
    )
    revenue_this_month = r.scalar_one()

    # ── Recent sales ──
    r = await db.execute(
        select(Sale)
        .where(Sale.status == SaleStatus.confirmed)
        .order_by(Sale.sale_date.desc())
        .limit(5)
    )
    recent_sales = [
        RecentSale(
            sale_number=s.sale_number,
            total_amount=s.total_amount,
            sale_date=s.sale_date,
        )
        for s in r.scalars().all()
    ]

    # ── Active lockers ──
    active_lockers = 0
    if _HAS_LOCKERS:
        r = await db.execute(
            select(func.count(LockerRental.id)).where(
                LockerRental.status == LockerRentalStatus.active
            )
        )
        active_lockers = r.scalar_one()

    # ── Birthdays this week ──
    r = await db.execute(
        select(Member).where(Member.birth_date != None, Member.is_active == True)
    )
    birthdays_this_week = []
    for member in r.scalars().all():
        bd = member.birth_date
        bday_this_year = bd.replace(year=today.year)
        if bday_this_year < today:
            bday_this_year = bd.replace(year=today.year + 1)
        days_until = (bday_this_year - today).days
        if 0 <= days_until <= 7:
            birthdays_this_week.append(BirthdayMember(
                member_id=member.id,
                first_name=member.first_name,
                last_name=member.last_name,
                birth_date=bd,
                age=bday_this_year.year - bd.year,
                days_until=days_until,
            ))
    birthdays_this_week.sort(key=lambda x: x.days_until)

    return DashboardData(
        active_members=active_members,
        new_members_this_month=new_members_this_month,
        active_memberships=active_memberships,
        expiring_soon_count=expiring_soon_count,
        checkins_today=checkins_today,
        checkins_this_week=checkins_this_week,
        sales_this_month=sales_this_month,
        revenue_this_month=revenue_this_month,
        active_lockers=active_lockers,
        expiring_memberships=expiring_memberships,
        recent_checkins=recent_checkins,
        recent_sales=recent_sales,
        birthdays_this_week=birthdays_this_week,
        daily_checkins_last_7=daily_checkins_last_7,
    )
