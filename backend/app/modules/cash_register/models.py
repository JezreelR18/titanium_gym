import uuid
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Date, Numeric, Integer, ForeignKey, Text, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

_utcnow = lambda: datetime.now(timezone.utc)


class ClosingStatus(str, enum.Enum):
    draft = "draft"
    closed = "closed"


class CashClosing(Base):
    __tablename__ = "cash_closings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    closing_date = Column(Date, nullable=False, index=True)
    status = Column(SAEnum(ClosingStatus, name="cash_closing_status", create_type=False),
                    nullable=False, default=ClosingStatus.draft)

    total_sales_count = Column(Integer, nullable=False, default=0)
    total_sales_amount = Column(Numeric(12, 2), nullable=False, default=0)

    # JSON snapshot: [{method: str, display_name: str, count: int, amount: float}]
    payment_breakdown = Column(Text, nullable=False, default="[]")

    cash_sales_amount = Column(Numeric(12, 2), nullable=False, default=0)
    cash_counted_amount = Column(Numeric(12, 2), nullable=False, default=0)
    difference = Column(Numeric(12, 2), nullable=False, default=0)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    denominations = relationship(
        "CashClosingDenomination",
        back_populates="closing",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="CashClosingDenomination.denomination.desc()",
    )


class CashClosingDenomination(Base):
    __tablename__ = "cash_closing_denominations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    closing_id = Column(UUID(as_uuid=True), ForeignKey("cash_closings.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    type = Column(String(10), nullable=False)  # 'bill' or 'coin'
    denomination = Column(Numeric(8, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    closing = relationship("CashClosing", back_populates="denominations", lazy="select")
