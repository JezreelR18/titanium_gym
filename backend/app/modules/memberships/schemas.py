import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional
from app.shared.enums import MembershipStatus


class PlanBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_days: int
    price: Decimal
    currency: str = "USD"
    max_classes_per_week: Optional[int] = None
    includes_personal_training: bool = False
    includes_locker: bool = False
    note: Optional[str] = None


class PlanCreate(PlanBase):
    @field_validator("duration_days")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("duration_days must be greater than 0")
        return v


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_days: Optional[int] = None
    price: Optional[Decimal] = None
    max_classes_per_week: Optional[int] = None
    includes_personal_training: Optional[bool] = None
    includes_locker: Optional[bool] = None
    is_active: Optional[bool] = None
    note: Optional[str] = None


class PlanResponse(PlanBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MembershipAssign(BaseModel):
    member_id: uuid.UUID
    plan_id: uuid.UUID
    start_date: date
    discount_pct: Decimal = Decimal("0")
    auto_renew: bool = False
    note: Optional[str] = None


class MembershipUpdate(BaseModel):
    status: Optional[MembershipStatus] = None
    freeze_start: Optional[date] = None
    freeze_end: Optional[date] = None
    auto_renew: Optional[bool] = None
    note: Optional[str] = None


class MembershipResponse(BaseModel):
    id: uuid.UUID
    member_id: uuid.UUID
    plan: PlanResponse
    start_date: date
    end_date: date
    status: MembershipStatus
    discount_pct: Decimal
    final_price: Decimal
    auto_renew: bool
    freeze_start: Optional[date] = None
    freeze_end: Optional[date] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
