import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional, List
from app.shared.enums import MovementType


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


# ── Products ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    unit: str = "unidad"
    location: Optional[str] = None
    price: Decimal
    min_stock_alert: int = 5
    note: Optional[str] = None

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price must be >= 0")
        return v


class ProductUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    price: Optional[Decimal] = None
    min_stock_alert: Optional[int] = None
    is_active: Optional[bool] = None
    note: Optional[str] = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    unit: str
    location: Optional[str] = None
    price: Decimal
    stock: int
    min_stock_alert: int
    is_active: bool
    note: Optional[str] = None
    category: Optional[CategoryResponse] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Movements ─────────────────────────────────────────────────────────────────

class MovementCreate(BaseModel):
    type: MovementType
    quantity: int
    unit_price: Optional[Decimal] = None
    reference: Optional[str] = None
    note: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def quantity_nonzero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("Quantity cannot be zero")
        return v


class ProductBasicResponse(BaseModel):
    id: uuid.UUID
    name: str
    unit: str
    model_config = {"from_attributes": True}


class MovementResponse(BaseModel):
    id: uuid.UUID
    product: ProductBasicResponse
    type: MovementType
    quantity: int
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    reference: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Summary ───────────────────────────────────────────────────────────────────

class InventorySummary(BaseModel):
    total_products: int
    active_products: int
    low_stock_count: int
    out_of_stock_count: int
