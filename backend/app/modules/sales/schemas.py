import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional, List
from app.shared.enums import SaleStatus, PaymentStatus, DebtStatus


class PaymentMethodResponse(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}


class SaleDetailCreate(BaseModel):
    product_id: Optional[uuid.UUID] = None
    membership_plan_id: Optional[uuid.UUID] = None
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")

    @field_validator("quantity", "unit_price")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Must be greater than 0")
        return v


class SalePaymentCreate(BaseModel):
    payment_method_id: uuid.UUID
    amount: Decimal
    reference_code: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v


class SaleCreate(BaseModel):
    member_id: Optional[uuid.UUID] = None
    create_anonymous_debt: bool = False
    details: List[SaleDetailCreate]
    payments: List[SalePaymentCreate] = []
    note: Optional[str] = None


class DebtPaymentCreate(BaseModel):
    payment_method_id: uuid.UUID
    amount: Decimal
    reference_code: Optional[str] = None
    note: Optional[str] = None


class SaleDetailResponse(BaseModel):
    id: uuid.UUID
    product_id: Optional[uuid.UUID] = None
    membership_plan_id: Optional[uuid.UUID] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    discount_amount: Decimal
    subtotal: Decimal
    model_config = {"from_attributes": True}


class SalePaymentResponse(BaseModel):
    id: uuid.UUID
    payment_method: PaymentMethodResponse
    amount: Decimal
    reference_code: Optional[str] = None
    paid_at: datetime
    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id: uuid.UUID
    member_id: Optional[uuid.UUID] = None
    member_name: Optional[str] = None
    sale_number: str
    sale_date: datetime
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    change_amount: Decimal
    status: SaleStatus
    payment_status: PaymentStatus
    details: List[SaleDetailResponse] = []
    payments: List[SalePaymentResponse] = []
    note: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class SaleListResponse(BaseModel):
    id: uuid.UUID
    sale_number: str
    member_id: Optional[uuid.UUID] = None
    member_name: Optional[str] = None
    sale_date: datetime
    total_amount: Decimal
    paid_amount: Decimal
    change_amount: Decimal
    status: SaleStatus
    payment_status: PaymentStatus
    model_config = {"from_attributes": True}


class DebtResponse(BaseModel):
    id: uuid.UUID
    member_id: Optional[uuid.UUID] = None
    member_name: Optional[str] = None
    sale_id: Optional[uuid.UUID] = None
    sale_number: Optional[str] = None
    concept: str
    original_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: DebtStatus
    due_date: Optional[datetime] = None
    is_overdue: bool
    created_at: datetime
    model_config = {"from_attributes": True}
