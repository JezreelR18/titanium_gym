import uuid
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.notifications.models import Reminder, NotificationLog
from app.modules.members.models import Member
from app.modules.memberships.models import MemberMembership, MembershipPlan
from app.shared.enums import (
    ReminderType, NotificationChannel, NotificationStatus, MembershipStatus,
)
from app.shared.exceptions import NotFoundError

# Conditionally import locker models (may not exist in older deploys)
try:
    from app.modules.lockers.models import LockerRental, LockerRentalStatus
    _HAS_LOCKERS = True
except ImportError:
    _HAS_LOCKERS = False

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)
_utcnow = lambda: datetime.now(timezone.utc)
_today = lambda: datetime.now(_tz).date()


# ── Schemas ────────────────────────────────────────────────────

class MemberBasic(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    model_config = {"from_attributes": True}


class AlertItem(BaseModel):
    type: str          # membership_expiry | birthday | locker_expiry | payment_due
    severity: str      # critical | warning | info
    title: str
    message: str
    member: Optional[MemberBasic] = None
    extra: Optional[dict] = None


class AlertsResponse(BaseModel):
    critical: list[AlertItem]
    warning: list[AlertItem]
    info: list[AlertItem]
    total: int


class ReminderCreate(BaseModel):
    member_id: Optional[uuid.UUID] = None
    type: ReminderType = ReminderType.custom
    title: str
    message: str
    trigger_date: datetime
    channel: NotificationChannel = NotificationChannel.in_app
    note: Optional[str] = None


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    trigger_date: Optional[datetime] = None
    channel: Optional[NotificationChannel] = None
    note: Optional[str] = None


class ReminderResponse(BaseModel):
    id: uuid.UUID
    member_id: Optional[uuid.UUID] = None
    type: ReminderType
    title: str
    message: str
    trigger_date: datetime
    channel: NotificationChannel
    status: NotificationStatus
    is_sent: bool
    sent_at: Optional[datetime] = None
    note: Optional[str] = None
    created_at: datetime
    member: Optional[MemberBasic] = None
    model_config = {"from_attributes": True}


class LogResponse(BaseModel):
    id: uuid.UUID
    member_id: Optional[uuid.UUID] = None
    title: str
    message: str
    channel: NotificationChannel
    status: NotificationStatus
    sent_at: Optional[datetime] = None
    created_at: datetime
    member: Optional[MemberBasic] = None
    model_config = {"from_attributes": True}


# ── Smart alerts ───────────────────────────────────────────────

@router.get("/alerts", response_model=AlertsResponse)
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today()
    critical: list[AlertItem] = []
    warning: list[AlertItem] = []
    info: list[AlertItem] = []

    # ── Memberships expiring ──
    cutoff_critical = today + timedelta(days=3)
    cutoff_warning  = today + timedelta(days=10)

    mem_res = await db.execute(
        select(MemberMembership, Member, MembershipPlan)
        .join(Member, Member.id == MemberMembership.member_id)
        .join(MembershipPlan, MembershipPlan.id == MemberMembership.plan_id)
        .where(
            MemberMembership.status == MembershipStatus.active,
            MemberMembership.end_date >= today,
            MemberMembership.end_date <= cutoff_warning,
            Member.is_active == True,
        )
        .order_by(MemberMembership.end_date)
    )
    for membership, member, plan in mem_res.all():
        days = (membership.end_date - today).days
        mb = MemberBasic.model_validate(member)
        msg = f"Membresía '{plan.name}' vence {'hoy' if days == 0 else f'en {days} día(s)' } ({membership.end_date.strftime('%d/%m/%Y')})"
        alert = AlertItem(
            type="membership_expiry",
            severity="critical" if membership.end_date <= cutoff_critical else "warning",
            title=f"{member.first_name} {member.last_name}",
            message=msg,
            member=mb,
            extra={"end_date": str(membership.end_date), "days_left": days, "plan": plan.name},
        )
        if membership.end_date <= cutoff_critical:
            critical.append(alert)
        else:
            warning.append(alert)

    # ── Memberships already expired (last 7 days, not renewed) ──
    expired_from = today - timedelta(days=7)
    exp_res = await db.execute(
        select(MemberMembership, Member, MembershipPlan)
        .join(Member, Member.id == MemberMembership.member_id)
        .join(MembershipPlan, MembershipPlan.id == MemberMembership.plan_id)
        .where(
            MemberMembership.status == MembershipStatus.expired,
            MemberMembership.end_date >= expired_from,
            MemberMembership.end_date < today,
            Member.is_active == True,
        )
        .order_by(MemberMembership.end_date.desc())
    )
    for membership, member, plan in exp_res.all():
        days_ago = (today - membership.end_date).days
        mb = MemberBasic.model_validate(member)
        critical.append(AlertItem(
            type="membership_expired",
            severity="critical",
            title=f"{member.first_name} {member.last_name}",
            message=f"Membresía '{plan.name}' venció hace {days_ago} día(s) ({membership.end_date.strftime('%d/%m/%Y')})",
            member=mb,
            extra={"end_date": str(membership.end_date), "days_ago": days_ago, "plan": plan.name},
        ))

    # ── Birthdays this week ──
    today_md = (today.month, today.day)
    week_end = today + timedelta(days=7)

    bday_res = await db.execute(
        select(Member).where(
            Member.birth_date != None,
            Member.is_active == True,
        )
    )
    for member in bday_res.scalars().all():
        bd = member.birth_date
        # Check if birthday falls between today and +7 days (handle year rollover)
        bday_this_year = bd.replace(year=today.year)
        if bday_this_year < today:
            bday_this_year = bd.replace(year=today.year + 1)
        days_to_bday = (bday_this_year - today).days
        if 0 <= days_to_bday <= 7:
            age = bday_this_year.year - bd.year
            mb = MemberBasic.model_validate(member)
            msg = f"Cumple {age} años el {bday_this_year.strftime('%d/%m')}" if days_to_bday > 0 else f"¡Hoy cumple {age} años!"
            severity = "info" if days_to_bday > 0 else "warning"
            alert = AlertItem(
                type="birthday",
                severity=severity,
                title=f"{member.first_name} {member.last_name}",
                message=msg,
                member=mb,
                extra={"birthday": str(bd), "days_until": days_to_bday, "age": age},
            )
            if days_to_bday == 0:
                warning.append(alert)
            else:
                info.append(alert)

    # ── Locker rentals expiring ──
    if _HAS_LOCKERS:
        locker_cutoff_critical = today + timedelta(days=2)
        locker_cutoff_warning  = today + timedelta(days=7)
        lr_res = await db.execute(
            select(LockerRental, Member)
            .join(Member, Member.id == LockerRental.member_id)
            .where(
                LockerRental.status == LockerRentalStatus.active,
                LockerRental.end_date >= today,
                LockerRental.end_date <= locker_cutoff_warning,
            )
            .order_by(LockerRental.end_date)
        )
        for rental, member in lr_res.all():
            days = (rental.end_date - today).days
            mb = MemberBasic.model_validate(member)
            msg = f"Renta de casillero vence {'hoy' if days == 0 else f'en {days} día(s)'} ({rental.end_date.strftime('%d/%m/%Y')})"
            alert = AlertItem(
                type="locker_expiry",
                severity="critical" if rental.end_date <= locker_cutoff_critical else "warning",
                title=f"{member.first_name} {member.last_name}",
                message=msg,
                member=mb,
                extra={"end_date": str(rental.end_date), "days_left": days},
            )
            if rental.end_date <= locker_cutoff_critical:
                critical.append(alert)
            else:
                warning.append(alert)

    all_alerts = critical + warning + info
    return AlertsResponse(
        critical=critical,
        warning=warning,
        info=info,
        total=len(all_alerts),
    )


# ── Reminders CRUD ─────────────────────────────────────────────

@router.get("/reminders", response_model=list[ReminderResponse])
async def list_reminders(
    include_sent: bool = Query(default=False),
    type_filter: Optional[ReminderType] = Query(default=None, alias="type"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Reminder).options(selectinload(Reminder.member))
    if not include_sent:
        q = q.where(Reminder.is_sent == False)
    if type_filter:
        q = q.where(Reminder.type == type_filter)
    q = q.order_by(Reminder.trigger_date)
    res = await db.execute(q)
    return res.scalars().all()


@router.post("/reminders", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    reminder = Reminder(**data.model_dump(), created_by=current_user.id)
    db.add(reminder)
    await db.commit()
    res = await db.execute(
        select(Reminder).options(selectinload(Reminder.member)).where(Reminder.id == reminder.id)
    )
    return res.scalar_one()


@router.put("/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(Reminder).options(selectinload(Reminder.member)).where(Reminder.id == reminder_id)
    )
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise NotFoundError("Recordatorio")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(reminder, k, v)
    await db.commit()
    res2 = await db.execute(
        select(Reminder).options(selectinload(Reminder.member)).where(Reminder.id == reminder_id)
    )
    return res2.scalar_one()


@router.put("/reminders/{reminder_id}/mark-sent", response_model=ReminderResponse)
async def mark_reminder_sent(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(Reminder).options(selectinload(Reminder.member)).where(Reminder.id == reminder_id)
    )
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise NotFoundError("Recordatorio")
    reminder.is_sent = True
    reminder.sent_at = _utcnow()
    reminder.status = NotificationStatus.sent

    # Write to log
    log = NotificationLog(
        reminder_id=reminder.id,
        member_id=reminder.member_id,
        channel=reminder.channel,
        title=reminder.title,
        message=reminder.message,
        status=NotificationStatus.sent,
        sent_at=_utcnow(),
    )
    db.add(log)
    await db.commit()

    res2 = await db.execute(
        select(Reminder).options(selectinload(Reminder.member)).where(Reminder.id == reminder_id)
    )
    return res2.scalar_one()


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = res.scalar_one_or_none()
    if not reminder:
        raise NotFoundError("Recordatorio")
    await db.delete(reminder)
    await db.commit()


# ── Notification log ───────────────────────────────────────────

@router.get("/log", response_model=list[LogResponse])
async def get_log(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(NotificationLog)
        .options(selectinload(NotificationLog.member))
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
    )
    return res.scalars().all()


# ── Alert count (for badge) ────────────────────────────────────

@router.get("/alerts/count")
async def alert_count(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = _today()
    cutoff = today + timedelta(days=10)

    # Expiring memberships
    mem_count = await db.execute(
        select(func.count()).select_from(MemberMembership).join(Member).where(
            MemberMembership.status == MembershipStatus.active,
            MemberMembership.end_date >= today,
            MemberMembership.end_date <= cutoff,
            Member.is_active == True,
        )
    )
    # Expired memberships (last 7 days)
    exp_count = await db.execute(
        select(func.count()).select_from(MemberMembership).join(Member).where(
            MemberMembership.status == MembershipStatus.expired,
            MemberMembership.end_date >= today - timedelta(days=7),
            MemberMembership.end_date < today,
            Member.is_active == True,
        )
    )
    # Birthdays this week
    bday_res = await db.execute(select(Member).where(Member.birth_date != None, Member.is_active == True))
    bday_count = 0
    for m in bday_res.scalars().all():
        bday_this_year = m.birth_date.replace(year=today.year)
        if bday_this_year < today:
            bday_this_year = m.birth_date.replace(year=today.year + 1)
        if 0 <= (bday_this_year - today).days <= 7:
            bday_count += 1

    total = mem_count.scalar_one() + exp_count.scalar_one() + bday_count
    return {"count": total}
