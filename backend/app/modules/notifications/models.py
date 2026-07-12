import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.shared.enums import ReminderType, NotificationChannel, NotificationStatus

if TYPE_CHECKING:
    from app.modules.members.models import Member

_utcnow = lambda: datetime.now(timezone.utc)


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"))
    type: Mapped[ReminderType] = mapped_column(SAEnum(ReminderType, name="reminder_type", create_type=False), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    trigger_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="notification_channel", create_type=False), default=NotificationChannel.in_app, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(SAEnum(NotificationStatus, name="notification_status", create_type=False), default=NotificationStatus.pending, nullable=False)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)
    system_commentary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    member: Mapped[Optional["Member"]] = relationship("Member", foreign_keys=[member_id], lazy="select")


class NotificationLog(Base):
    __tablename__ = "notification_logs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reminder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("reminders.id"))
    member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel, name="notification_channel", create_type=False), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(SAEnum(NotificationStatus, name="notification_status", create_type=False), default=NotificationStatus.pending, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=_utcnow, nullable=False)

    member: Mapped[Optional["Member"]] = relationship("Member", foreign_keys=[member_id], lazy="select")
