import uuid
from datetime import datetime, timezone
from sqlalchemy import Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.shared.enums import AttendanceMethod

_utcnow = lambda: datetime.now(timezone.utc)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    checked_out_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    method: Mapped[AttendanceMethod] = mapped_column(SAEnum(AttendanceMethod, name="attendance_method", create_type=False), default=AttendanceMethod.manual, nullable=False)
    registered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
