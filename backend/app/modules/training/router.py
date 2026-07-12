import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.modules.training.models import MuscleGroup, Exercise, Routine, RoutineExercise, MemberRoutine
from app.shared.enums import DifficultyLevel, RoutineStatus

router = APIRouter()

# ── Schemas ────────────────────────────────────────────────────

class MuscleGroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class MuscleGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class MuscleGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ExerciseCreate(BaseModel):
    muscle_group_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    video_url: Optional[str] = None


class ExerciseUpdate(BaseModel):
    muscle_group_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    video_url: Optional[str] = None
    is_active: Optional[bool] = None


class ExerciseResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    video_url: Optional[str] = None
    is_active: bool
    muscle_group: Optional[MuscleGroupResponse] = None
    model_config = {"from_attributes": True}


class RoutineExerciseCreate(BaseModel):
    exercise_id: uuid.UUID
    day_of_week: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    rest_seconds: Optional[int] = None
    duration_seconds: Optional[int] = None
    order_index: int = 0
    notes: Optional[str] = None


class RoutineExerciseResponse(BaseModel):
    id: uuid.UUID
    exercise_id: uuid.UUID
    exercise: ExerciseResponse
    day_of_week: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    rest_seconds: Optional[int] = None
    duration_seconds: Optional[int] = None
    order_index: int
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class RoutineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    difficulty: Optional[DifficultyLevel] = None
    is_template: bool = False
    note: Optional[str] = None


class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    difficulty: Optional[DifficultyLevel] = None
    is_template: Optional[bool] = None
    is_active: Optional[bool] = None
    note: Optional[str] = None


class RoutineResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    is_template: bool
    is_active: bool
    note: Optional[str] = None
    exercises: list[RoutineExerciseResponse] = []
    model_config = {"from_attributes": True}


class AssignRoutine(BaseModel):
    member_id: uuid.UUID
    routine_id: uuid.UUID
    ends_at: Optional[date] = None
    note: Optional[str] = None


class MemberRoutineResponse(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    routine: RoutineResponse
    status: RoutineStatus
    note: Optional[str] = None
    assigned_at: datetime
    ends_at: Optional[date] = None
    model_config = {"from_attributes": True}


class MemberRoutineUpdate(BaseModel):
    status: Optional[RoutineStatus] = None
    note: Optional[str] = None


class RoutineMemberResponse(BaseModel):
    assignment_id: uuid.UUID
    member_id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    status: RoutineStatus
    assigned_at: datetime
    ends_at: Optional[date] = None
    note: Optional[str] = None


# ── Muscle groups ──────────────────────────────────────────────

@router.get("/muscle-groups", response_model=list[MuscleGroupResponse])
async def list_muscle_groups(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(MuscleGroup).order_by(MuscleGroup.name))
    return result.scalars().unique().all()


@router.post("/muscle-groups", response_model=MuscleGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_muscle_group(data: MuscleGroupCreate, db: AsyncSession = Depends(get_db), current_user=Depends(require_owner)):
    existing = await db.execute(select(MuscleGroup).where(MuscleGroup.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ya existe un grupo muscular con ese nombre")
    group = MuscleGroup(**data.model_dump())
    db.add(group)
    await db.commit()
    result = await db.execute(select(MuscleGroup).where(MuscleGroup.id == group.id))
    return result.scalar_one()


@router.put("/muscle-groups/{group_id}", response_model=MuscleGroupResponse)
async def update_muscle_group(group_id: uuid.UUID, data: MuscleGroupUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_owner)):
    result = await db.execute(select(MuscleGroup).where(MuscleGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo muscular no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    await db.commit()
    result = await db.execute(select(MuscleGroup).where(MuscleGroup.id == group.id))
    return result.scalar_one()


@router.delete("/muscle-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_muscle_group(group_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(require_owner)):
    result = await db.execute(select(MuscleGroup).where(MuscleGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo muscular no encontrado")
    from sqlalchemy import func
    count_q = await db.execute(
        select(func.count()).select_from(Exercise).where(Exercise.muscle_group_id == group_id)
    )
    if count_q.scalar_one() > 0:
        raise HTTPException(status_code=409, detail="No se puede eliminar: hay ejercicios asignados a este grupo")
    await db.delete(group)
    await db.commit()


# ── Exercises ──────────────────────────────────────────────────

@router.get("/exercises", response_model=list[ExerciseResponse])
async def list_exercises(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Exercise).options(selectinload(Exercise.muscle_group)).order_by(Exercise.name)
    )
    return result.scalars().unique().all()


@router.post("/exercises", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(data: ExerciseCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    ex = Exercise(**data.model_dump(), created_by=current_user.id)
    db.add(ex)
    await db.commit()
    result = await db.execute(
        select(Exercise).options(selectinload(Exercise.muscle_group)).where(Exercise.id == ex.id)
    )
    return result.scalar_one()


@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(exercise_id: uuid.UUID, data: ExerciseUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Exercise).where(Exercise.id == exercise_id))
    ex = result.scalar_one_or_none()
    if not ex:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(ex, field, value)
    await db.commit()
    result = await db.execute(
        select(Exercise).options(selectinload(Exercise.muscle_group)).where(Exercise.id == ex.id)
    )
    return result.scalar_one()


# ── Routines ───────────────────────────────────────────────────

async def _load_routine(db: AsyncSession, routine_id: uuid.UUID) -> Routine | None:
    result = await db.execute(
        select(Routine)
        .options(
            selectinload(Routine.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscle_group)
        )
        .where(Routine.id == routine_id)
    )
    return result.scalar_one_or_none()


@router.get("/routines", response_model=list[RoutineResponse])
async def list_routines(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Routine)
        .options(
            selectinload(Routine.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscle_group)
        )
        .where(Routine.is_active == True)
        .order_by(Routine.created_at.desc())
    )
    return result.scalars().unique().all()


@router.post("/routines", response_model=RoutineResponse, status_code=status.HTTP_201_CREATED)
async def create_routine(data: RoutineCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    routine = Routine(**data.model_dump(), trainer_id=current_user.id, created_by=current_user.id)
    db.add(routine)
    await db.commit()
    return await _load_routine(db, routine.id)


@router.get("/routines/{routine_id}", response_model=RoutineResponse)
async def get_routine(routine_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    routine = await _load_routine(db, routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


@router.put("/routines/{routine_id}", response_model=RoutineResponse)
async def update_routine(routine_id: uuid.UUID, data: RoutineUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Routine).where(Routine.id == routine_id))
    routine = result.scalar_one_or_none()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(routine, field, value)
    await db.commit()
    return await _load_routine(db, routine.id)


@router.post("/routines/{routine_id}/exercises", response_model=RoutineExerciseResponse, status_code=status.HTTP_201_CREATED)
async def add_exercise_to_routine(routine_id: uuid.UUID, data: RoutineExerciseCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    re = RoutineExercise(routine_id=routine_id, **data.model_dump())
    db.add(re)
    await db.commit()
    result = await db.execute(
        select(RoutineExercise)
        .options(selectinload(RoutineExercise.exercise).selectinload(Exercise.muscle_group))
        .where(RoutineExercise.id == re.id)
    )
    return result.scalar_one()


@router.delete("/routine-exercises/{re_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_exercise_from_routine(re_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(RoutineExercise).where(RoutineExercise.id == re_id))
    re = result.scalar_one_or_none()
    if not re:
        raise HTTPException(status_code=404, detail="No encontrado")
    await db.delete(re)
    await db.commit()


# ── Routine → assigned members ────────────────────────────────

@router.get("/routine/{routine_id}/members", response_model=list[RoutineMemberResponse])
async def get_routine_members(routine_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from app.modules.members.models import Member
    result = await db.execute(
        select(
            MemberRoutine.id.label("assignment_id"),
            MemberRoutine.member_id,
            Member.member_code,
            Member.first_name,
            Member.last_name,
            MemberRoutine.status,
            MemberRoutine.assigned_at,
            MemberRoutine.ends_at,
            MemberRoutine.note,
        )
        .join(Member, Member.id == MemberRoutine.member_id)
        .where(MemberRoutine.routine_id == routine_id)
        .order_by(MemberRoutine.assigned_at.desc())
    )
    rows = result.mappings().all()
    return [RoutineMemberResponse(**dict(r)) for r in rows]


# ── Member assignments ─────────────────────────────────────────

@router.post("/assign", response_model=MemberRoutineResponse, status_code=status.HTTP_201_CREATED)
async def assign_routine(data: AssignRoutine, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    from datetime import datetime, timezone
    mr = MemberRoutine(
        member_id=data.member_id,
        routine_id=data.routine_id,
        ends_at=data.ends_at,
        note=data.note,
        created_by=current_user.id,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(mr)
    await db.commit()
    result = await db.execute(
        select(MemberRoutine)
        .options(
            selectinload(MemberRoutine.routine)
            .selectinload(Routine.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscle_group)
        )
        .where(MemberRoutine.id == mr.id)
    )
    return result.scalar_one()


@router.get("/member/{member_id}", response_model=list[MemberRoutineResponse])
async def get_member_routines(member_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(MemberRoutine)
        .options(
            selectinload(MemberRoutine.routine)
            .selectinload(Routine.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscle_group)
        )
        .where(MemberRoutine.member_id == member_id)
        .order_by(MemberRoutine.assigned_at.desc())
    )
    return result.scalars().unique().all()


@router.put("/member-routines/{mr_id}", response_model=MemberRoutineResponse)
async def update_member_routine(mr_id: uuid.UUID, data: MemberRoutineUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(MemberRoutine).where(MemberRoutine.id == mr_id))
    mr = result.scalar_one_or_none()
    if not mr:
        raise HTTPException(status_code=404, detail="No encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(mr, field, value)
    await db.commit()
    result = await db.execute(
        select(MemberRoutine)
        .options(
            selectinload(MemberRoutine.routine)
            .selectinload(Routine.exercises)
            .selectinload(RoutineExercise.exercise)
            .selectinload(Exercise.muscle_group)
        )
        .where(MemberRoutine.id == mr.id)
    )
    return result.scalar_one()
