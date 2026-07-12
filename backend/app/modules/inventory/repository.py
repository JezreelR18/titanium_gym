import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.modules.inventory.models import ProductCategory, Product, InventoryMovement
from app.modules.inventory.schemas import (
    CategoryCreate, CategoryUpdate,
    ProductCreate, ProductUpdate,
    MovementCreate,
)
from app.shared.enums import MovementType


class InventoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Categories ────────────────────────────────────────────────────────────

    async def get_all_categories(self) -> list[ProductCategory]:
        result = await self.db.execute(
            select(ProductCategory).order_by(ProductCategory.name)
        )
        return result.scalars().all()

    async def get_category_by_id(self, cat_id: uuid.UUID) -> ProductCategory | None:
        result = await self.db.execute(
            select(ProductCategory).where(ProductCategory.id == cat_id)
        )
        return result.scalar_one_or_none()

    async def create_category(self, data: CategoryCreate, created_by: uuid.UUID) -> ProductCategory:
        cat = ProductCategory(**data.model_dump(), created_by=created_by)
        self.db.add(cat)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def update_category(self, cat: ProductCategory, data: CategoryUpdate) -> ProductCategory:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(cat, field, value)
        await self.db.commit()
        await self.db.refresh(cat)
        return cat

    async def delete_category(self, cat: ProductCategory) -> None:
        await self.db.delete(cat)
        await self.db.commit()

    async def count_products_in_category(self, cat_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Product).where(
                Product.category_id == cat_id, Product.is_active == True
            )
        )
        return result.scalar_one()

    # ── Products ──────────────────────────────────────────────────────────────

    async def get_all_products(
        self,
        offset: int = 0,
        limit: int = 20,
        search: str | None = None,
        category_id: uuid.UUID | None = None,
        low_stock: bool = False,
        include_inactive: bool = False,
    ) -> tuple[list[Product], int]:
        base = select(Product)
        count_base = select(func.count()).select_from(Product)

        if not include_inactive:
            base = base.where(Product.is_active == True)
            count_base = count_base.where(Product.is_active == True)

        if search:
            pattern = f"%{search}%"
            cond = or_(Product.name.ilike(pattern), Product.sku.ilike(pattern))
            base = base.where(cond)
            count_base = count_base.where(cond)

        if category_id:
            base = base.where(Product.category_id == category_id)
            count_base = count_base.where(Product.category_id == category_id)

        if low_stock:
            base = base.where(Product.stock <= Product.min_stock_alert)
            count_base = count_base.where(Product.stock <= Product.min_stock_alert)

        result = await self.db.execute(base.order_by(Product.name).offset(offset).limit(limit))
        count_result = await self.db.execute(count_base)
        return result.scalars().all(), count_result.scalar_one()

    async def get_product_by_id(self, product_id: uuid.UUID) -> Product | None:
        result = await self.db.execute(
            select(Product).where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_product_by_sku(self, sku: str) -> Product | None:
        result = await self.db.execute(
            select(Product).where(Product.sku == sku)
        )
        return result.scalar_one_or_none()

    async def create_product(self, data: ProductCreate, created_by: uuid.UUID) -> Product:
        product = Product(**data.model_dump(), created_by=created_by)
        self.db.add(product)
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def update_product(self, product: Product, data: ProductUpdate, updated_by: uuid.UUID) -> Product:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(product, field, value)
        product.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(product)
        return product

    async def apply_movement(self, product: Product, data: MovementCreate, created_by: uuid.UUID) -> InventoryMovement:
        qty = abs(data.quantity)

        if data.type == MovementType.purchase:
            product.stock += qty
        elif data.type == MovementType.return_:  # value = 'return'
            product.stock += qty
        elif data.type == MovementType.sale:
            product.stock -= qty
        elif data.type == MovementType.adjustment:
            product.stock += data.quantity

        total = (data.unit_price * qty) if data.unit_price else None

        movement = InventoryMovement(
            product_id=product.id,
            type=data.type,
            quantity=data.quantity,
            unit_price=data.unit_price,
            total_price=total,
            reference=data.reference,
            note=data.note,
            created_by=created_by,
        )
        self.db.add(movement)
        await self.db.commit()
        await self.db.refresh(movement)
        return movement

    # ── Movements ─────────────────────────────────────────────────────────────

    async def get_movements(
        self,
        offset: int = 0,
        limit: int = 30,
        product_id: uuid.UUID | None = None,
        movement_type: MovementType | None = None,
    ) -> tuple[list[InventoryMovement], int]:
        base = (
            select(InventoryMovement)
            .options(selectinload(InventoryMovement.product))
            .order_by(InventoryMovement.created_at.desc())
        )
        count_base = select(func.count()).select_from(InventoryMovement)

        if product_id:
            base = base.where(InventoryMovement.product_id == product_id)
            count_base = count_base.where(InventoryMovement.product_id == product_id)

        if movement_type:
            base = base.where(InventoryMovement.type == movement_type)
            count_base = count_base.where(InventoryMovement.type == movement_type)

        result = await self.db.execute(base.offset(offset).limit(limit))
        count_result = await self.db.execute(count_base)
        return result.scalars().all(), count_result.scalar_one()

    # ── Summary ───────────────────────────────────────────────────────────────

    async def get_summary(self) -> dict:
        total = await self.db.execute(select(func.count()).select_from(Product))
        active = await self.db.execute(
            select(func.count()).select_from(Product).where(Product.is_active == True)
        )
        low = await self.db.execute(
            select(func.count()).select_from(Product).where(
                Product.is_active == True,
                Product.stock <= Product.min_stock_alert,
                Product.stock > 0,
            )
        )
        out = await self.db.execute(
            select(func.count()).select_from(Product).where(
                Product.is_active == True, Product.stock == 0
            )
        )
        return {
            "total_products": total.scalar_one(),
            "active_products": active.scalar_one(),
            "low_stock_count": low.scalar_one(),
            "out_of_stock_count": out.scalar_one(),
        }
