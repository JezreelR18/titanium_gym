import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.modules.inventory.service import InventoryService
from app.modules.inventory.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    MovementCreate, MovementResponse,
    InventorySummary,
)
from app.shared.pagination import PaginationParams, PaginatedResponse
from app.shared.enums import MovementType

router = APIRouter()


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=InventorySummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await InventoryService(db).get_summary()


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await InventoryService(db).get_categories()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await InventoryService(db).create_category(data, current_user.id)


@router.put("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: uuid.UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    return await InventoryService(db).update_category(cat_id, data)


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    cat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_owner),
):
    await InventoryService(db).delete_category(cat_id)


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    search: Optional[str] = Query(default=None),
    category_id: Optional[uuid.UUID] = Query(default=None),
    low_stock: bool = Query(default=False),
    include_inactive: bool = Query(default=False),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await InventoryService(db).get_products(
        params, search=search, category_id=category_id,
        low_stock=low_stock, include_inactive=include_inactive,
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await InventoryService(db).create_product(data, current_user.id)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await InventoryService(db).update_product(product_id, data, current_user.id)


# ── Movements ─────────────────────────────────────────────────────────────────

@router.get("/movements", response_model=PaginatedResponse[MovementResponse])
async def list_movements(
    product_id: Optional[uuid.UUID] = Query(default=None),
    movement_type: Optional[MovementType] = Query(default=None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await InventoryService(db).get_movements(
        params, product_id=product_id, movement_type=movement_type
    )


@router.post("/{product_id}/movement", response_model=MovementResponse, status_code=status.HTTP_201_CREATED)
async def add_movement(
    product_id: uuid.UUID,
    data: MovementCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await InventoryService(db).add_movement(product_id, data, current_user.id)
