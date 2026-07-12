import uuid
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, cast, Date
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.classes.models import ClassCategory, GymClass, ClassSchedule, ClassEnrollment
from app.shared.enums import ClassStatus, EnrollmentStatus
from app.shared.exceptions import NotFoundError, BadRequestError, ConflictError

router = APIRouter()

LOCAL_TZ = "America/Mexico_City"
_tz = ZoneInfo(LOCAL_TZ)
_utcnow = lambda: datetime.now(timezone.utc)


def _local_date(col):
    return cast(func.timezone(LOCAL_TZ, col), Date)


def _today() -> date:
    return datetime.now(_tz).date()


# ── Schemas ────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color_hex: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color_hex: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    color_hex: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class ClassCreate(BaseModel):
    name: str
    category_id: Optional[uuid.UUID] = None
    trainer_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    duration_minutes: int
    max_capacity: Optional[int] = None
    room: Optional[str] = None
    note: Optional[str] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    trainer_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    max_capacity: Optional[int] = None
    room: Optional[str] = None
    note: Optional[str] = None
    is_active: Optional[bool] = None


class TrainerBasic(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    model_config = {"from_attributes": True}


class ClassResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    duration_minutes: int
    max_capacity: Optional[int] = None
    room: Optional[str] = None
    is_active: bool
    note: Optional[str] = None
    category: Optional[CategoryResponse] = None
    trainer: Optional[TrainerBasic] = None
    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    class_id: uuid.UUID
    scheduled_at: datetime
    note: Optional[str] = None


class ScheduleUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    status: Optional[ClassStatus] = None
    cancellation_reason: Optional[str] = None
    note: Optional[str] = None


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    scheduled_at: datetime
    status: ClassStatus
    enrolled_count: int
    cancellation_reason: Optional[str] = None
    note: Optional[str] = None
    gym_class: Optional[ClassResponse] = None
    model_config = {"from_attributes": True}


class MemberBasic(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    model_config = {"from_attributes": True}


class EnrollmentResponse(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    status: EnrollmentStatus
    enrolled_at: datetime
    attended_at: Optional[datetime] = None
    note: Optional[str] = None
    member: Optional[MemberBasic] = None
    model_config = {"from_attributes": True}


class EnrollRequest(BaseModel):
    member_id: uuid.UUID
    note: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────

async def _load_schedule(schedule_id: uuid.UUID, db: AsyncSession) -> ClassSchedule:
    res = await db.execute(
        select(ClassSchedule)
        .options(
            selectinload(ClassSchedule.gym_class).selectinload(GymClass.category),
            selectinload(ClassSchedule.gym_class).selectinload(GymClass.trainer),
        )
        .where(ClassSchedule.id == schedule_id)
    )
    s = res.scalar_one_or_none()
    if not s:
        raise NotFoundError("Horario")
    return s


async def _load_class(class_id: uuid.UUID, db: AsyncSession) -> GymClass:
    res = await db.execute(
        select(GymClass)
        .options(selectinload(GymClass.category), selectinload(GymClass.trainer))
        .where(GymClass.id == class_id)
    )
    c = res.scalar_one_or_none()
    if not c:
        raise NotFoundError("Clase")
    return c


# ── Categories ─────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    res = await db.execute(select(ClassCategory).order_by(ClassCategory.name))
    return res.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cat = ClassCategory(**data.model_dump(), created_by=current_user.id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: uuid.UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(select(ClassCategory).where(ClassCategory.id == cat_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Categoría")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    return cat


# ── Classes ────────────────────────────────────────────────────

@router.get("", response_model=list[ClassResponse])
async def list_classes(
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(GymClass).options(selectinload(GymClass.category), selectinload(GymClass.trainer))
    if active_only:
        q = q.where(GymClass.is_active == True)
    res = await db.execute(q.order_by(GymClass.name))
    return res.scalars().all()


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    data: ClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    gym_class = GymClass(**data.model_dump(), created_by=current_user.id)
    db.add(gym_class)
    await db.commit()
    return await _load_class(gym_class.id, db)


@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    gym_class = await _load_class(class_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(gym_class, k, v)
    gym_class.updated_by = current_user.id
    await db.commit()
    return await _load_class(class_id, db)


# ── Schedules ──────────────────────────────────────────────────

@router.get("/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    class_id: Optional[uuid.UUID] = Query(default=None),
    upcoming_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(ClassSchedule).options(
        selectinload(ClassSchedule.gym_class).selectinload(GymClass.category),
        selectinload(ClassSchedule.gym_class).selectinload(GymClass.trainer),
    )
    filters = []
    if date_from:
        filters.append(_local_date(ClassSchedule.scheduled_at) >= date_from)
    if date_to:
        filters.append(_local_date(ClassSchedule.scheduled_at) <= date_to)
    if class_id:
        filters.append(ClassSchedule.class_id == class_id)
    if upcoming_only:
        filters.append(ClassSchedule.scheduled_at >= _utcnow())
        filters.append(ClassSchedule.status == ClassStatus.scheduled)
    if filters:
        q = q.where(and_(*filters))
    res = await db.execute(q.order_by(ClassSchedule.scheduled_at))
    return res.scalars().all()


@router.post("/schedules", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    res = await db.execute(select(GymClass).where(GymClass.id == data.class_id, GymClass.is_active == True))
    if not res.scalar_one_or_none():
        raise NotFoundError("Clase")
    schedule = ClassSchedule(
        class_id=data.class_id,
        scheduled_at=data.scheduled_at,
        note=data.note,
        created_by=current_user.id,
    )
    db.add(schedule)
    await db.commit()
    return await _load_schedule(schedule.id, db)


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    schedule = await _load_schedule(schedule_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(schedule, k, v)
    schedule.updated_by = current_user.id
    await db.commit()
    return await _load_schedule(schedule_id, db)


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_schedule(
    schedule_id: uuid.UUID,
    reason: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    schedule = await _load_schedule(schedule_id, db)
    if schedule.status == ClassStatus.cancelled:
        raise BadRequestError("El horario ya está cancelado")
    schedule.status = ClassStatus.cancelled
    schedule.cancellation_reason = reason
    await db.commit()


# ── Enrollments ────────────────────────────────────────────────

@router.get("/schedules/{schedule_id}/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(ClassEnrollment)
        .options(selectinload(ClassEnrollment.member))
        .where(
            ClassEnrollment.schedule_id == schedule_id,
            ClassEnrollment.status != EnrollmentStatus.cancelled,
        )
        .order_by(ClassEnrollment.enrolled_at)
    )
    return res.scalars().all()


@router.post("/schedules/{schedule_id}/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll(
    schedule_id: uuid.UUID,
    data: EnrollRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    schedule = await _load_schedule(schedule_id, db)
    if schedule.status == ClassStatus.cancelled:
        raise BadRequestError("No se puede inscribir en un horario cancelado")
    if schedule.gym_class and schedule.gym_class.max_capacity:
        if schedule.enrolled_count >= schedule.gym_class.max_capacity:
            raise BadRequestError("La clase ya está llena")
    dup = await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.schedule_id == schedule_id,
            ClassEnrollment.member_id == data.member_id,
            ClassEnrollment.status != EnrollmentStatus.cancelled,
        )
    )
    if dup.scalar_one_or_none():
        raise ConflictError("El miembro ya está inscrito en este horario")
    enrollment = ClassEnrollment(
        schedule_id=schedule_id,
        member_id=data.member_id,
        note=data.note,
        enrolled_at=_utcnow(),
        created_by=current_user.id,
    )
    db.add(enrollment)
    schedule.enrolled_count += 1
    await db.commit()
    res = await db.execute(
        select(ClassEnrollment)
        .options(selectinload(ClassEnrollment.member))
        .where(ClassEnrollment.id == enrollment.id)
    )
    return res.scalar_one()


@router.put("/enrollments/{enrollment_id}/attend", response_model=EnrollmentResponse)
async def mark_attended(
    enrollment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(
        select(ClassEnrollment)
        .options(selectinload(ClassEnrollment.member))
        .where(ClassEnrollment.id == enrollment_id)
    )
    enrollment = res.scalar_one_or_none()
    if not enrollment:
        raise NotFoundError("Inscripción")
    enrollment.status = EnrollmentStatus.attended
    enrollment.attended_at = _utcnow()
    await db.commit()
    res2 = await db.execute(
        select(ClassEnrollment)
        .options(selectinload(ClassEnrollment.member))
        .where(ClassEnrollment.id == enrollment_id)
    )
    return res2.scalar_one()


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_enrollment(
    enrollment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    res = await db.execute(select(ClassEnrollment).where(ClassEnrollment.id == enrollment_id))
    enrollment = res.scalar_one_or_none()
    if not enrollment:
        raise NotFoundError("Inscripción")
    if enrollment.status == EnrollmentStatus.cancelled:
        raise BadRequestError("Ya está cancelada")
    enrollment.status = EnrollmentStatus.cancelled
    s_res = await db.execute(select(ClassSchedule).where(ClassSchedule.id == enrollment.schedule_id))
    schedule = s_res.scalar_one_or_none()
    if schedule and schedule.enrolled_count > 0:
        schedule.enrolled_count -= 1
    await db.commit()
