import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Text, ForeignKey, Integer, SmallInteger, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.shared.enums import DifficultyLevel, RoutineStatus


class MuscleGroup(Base):
    __tablename__ = "muscle_groups"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    exercises: Mapped[list["Exercise"]] = relationship("Exercise", back_populates="muscle_group")


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    muscle_group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("muscle_groups.id"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    difficulty: Mapped[DifficultyLevel | None] = mapped_column(SAEnum(DifficultyLevel, name="difficulty_level", create_type=False))
    video_url: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    muscle_group: Mapped["MuscleGroup"] = relationship("MuscleGroup", back_populates="exercises", lazy="joined")


class Routine(Base):
    __tablename__ = "routines"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    goal: Mapped[str | None] = mapped_column(String(100))
    duration_weeks: Mapped[int | None] = mapped_column(Integer)
    days_per_week: Mapped[int | None] = mapped_column(SmallInteger)
    difficulty: Mapped[DifficultyLevel | None] = mapped_column(SAEnum(DifficultyLevel, name="difficulty_level", create_type=False))
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    exercises: Mapped[list["RoutineExercise"]] = relationship("RoutineExercise", back_populates="routine", cascade="all, delete-orphan")


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("exercises.id"), nullable=False)
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger)
    sets: Mapped[int | None] = mapped_column(Integer)
    reps: Mapped[int | None] = mapped_column(Integer)
    rest_seconds: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    order_index: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    routine: Mapped["Routine"] = relationship("Routine", back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship("Exercise", lazy="joined")


class MemberRoutine(Base):
    __tablename__ = "member_routines"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    routine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routines.id"), nullable=False)
    assigned_at: Mapped[date] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    ends_at: Mapped[date | None] = mapped_column(TIMESTAMP(timezone=True))
    status: Mapped[RoutineStatus] = mapped_column(SAEnum(RoutineStatus, name="routine_status", create_type=False), default=RoutineStatus.active, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    routine: Mapped["Routine"] = relationship("Routine", lazy="joined")
