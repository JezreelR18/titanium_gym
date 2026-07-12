import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, Text, ForeignKey, Date, Numeric, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.modules.members.models import Member


class LockerStatus(str, enum.Enum):
    available  = "available"
    rented     = "rented"
    maintenance = "maintenance"
    reserved   = "reserved"


class LockerRentalStatus(str, enum.Enum):
    active    = "active"
    expired   = "expired"
    cancelled = "cancelled"


class Locker(Base):
    __tablename__ = "lockers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    zone: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[LockerStatus] = mapped_column(
        SAEnum(LockerStatus, name="locker_status", create_type=False),
        default=LockerStatus.available, nullable=False,
    )
    has_lock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.utcnow(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow(), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    rentals: Mapped[list["LockerRental"]] = relationship("LockerRental", back_populates="locker", order_by="LockerRental.start_date.desc()")


class LockerRental(Base):
    __tablename__ = "locker_rentals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    locker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lockers.id"), nullable=False)
    member_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("members.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN", nullable=False)
    includes_lock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    deposit_returned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[LockerRentalStatus] = mapped_column(
        SAEnum(LockerRentalStatus, name="locker_rental_status", create_type=False),
        default=LockerRentalStatus.active, nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.utcnow(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow(), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    locker: Mapped["Locker"] = relationship("Locker", back_populates="rentals", lazy="select")
    member: Mapped[Optional["Member"]] = relationship("Member", foreign_keys=[member_id], lazy="select")
