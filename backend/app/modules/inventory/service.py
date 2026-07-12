import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    MovementCreate, MovementResponse,
    InventorySummary,
)
from app.shared.exceptions import NotFoundError, ConflictError, BadRequestError
from app.shared.pagination import PaginationParams, PaginatedResponse
from app.shared.enums import MovementType


class InventoryService:
    def __init__(self, db: AsyncSession):
        self.repo = InventoryRepository(db)

    # ── Categories ────────────────────────────────────────────────────────────

    async def get_categories(self) -> list[CategoryResponse]:
        cats = await self.repo.get_all_categories()
        return [CategoryResponse.model_validate(c) for c in cats]

    async def create_category(self, data: CategoryCreate, created_by: uuid.UUID) -> CategoryResponse:
        cat = await self.repo.create_category(data, created_by)
        return CategoryResponse.model_validate(cat)

    async def update_category(self, cat_id: uuid.UUID, data: CategoryUpdate) -> CategoryResponse:
        cat = await self.repo.get_category_by_id(cat_id)
        if not cat:
            raise NotFoundError("Category")
        updated = await self.repo.update_category(cat, data)
        return CategoryResponse.model_validate(updated)

    async def delete_category(self, cat_id: uuid.UUID) -> None:
        cat = await self.repo.get_category_by_id(cat_id)
        if not cat:
            raise NotFoundError("Category")
        count = await self.repo.count_products_in_category(cat_id)
        if count > 0:
            raise BadRequestError(f"No se puede eliminar: {count} producto(s) usan esta categoría")
        await self.repo.delete_category(cat)

    # ── Products ──────────────────────────────────────────────────────────────

    async def get_products(
        self,
        params: PaginationParams,
        search: str | None = None,
        category_id: uuid.UUID | None = None,
        low_stock: bool = False,
        include_inactive: bool = False,
    ) -> PaginatedResponse[ProductResponse]:
        products, total = await self.repo.get_all_products(
            offset=params.offset,
            limit=params.limit,
            search=search,
            category_id=category_id,
            low_stock=low_stock,
            include_inactive=include_inactive,
        )
        return PaginatedResponse.build(
            data=[ProductResponse.model_validate(p) for p in products],
            total=total,
            params=params,
        )

    async def create_product(self, data: ProductCreate, created_by: uuid.UUID) -> ProductResponse:
        if data.sku:
            existing = await self.repo.get_product_by_sku(data.sku)
            if existing:
                raise ConflictError("Ya existe un producto con ese SKU")
        product = await self.repo.create_product(data, created_by)
        return ProductResponse.model_validate(product)

    async def update_product(self, product_id: uuid.UUID, data: ProductUpdate, updated_by: uuid.UUID) -> ProductResponse:
        product = await self.repo.get_product_by_id(product_id)
        if not product:
            raise NotFoundError("Product")
        if data.sku and data.sku != product.sku:
            existing = await self.repo.get_product_by_sku(data.sku)
            if existing:
                raise ConflictError("Ya existe un producto con ese SKU")
        updated = await self.repo.update_product(product, data, updated_by)
        return ProductResponse.model_validate(updated)

    # ── Movements ─────────────────────────────────────────────────────────────

    async def add_movement(
        self, product_id: uuid.UUID, data: MovementCreate, created_by: uuid.UUID
    ) -> MovementResponse:
        product = await self.repo.get_product_by_id(product_id)
        if not product:
            raise NotFoundError("Product")

        qty = abs(data.quantity)

        if data.type == MovementType.sale:  # noqa
            if product.stock < qty:
                raise BadRequestError(
                    f"Stock insuficiente. Disponible: {product.stock} {product.unit}(s)"
                )

        if data.type == MovementType.adjustment:
            new_stock = product.stock + data.quantity
            if new_stock < 0:
                raise BadRequestError(
                    f"El ajuste dejaría el stock en negativo (actual: {product.stock})"
                )

        movement = await self.repo.apply_movement(product, data, created_by)

        # Re-fetch movement with product loaded
        movements, _ = await self.repo.get_movements(
            offset=0, limit=1, product_id=product_id
        )
        # find the movement we just created
        m = next((mv for mv in movements if mv.id == movement.id), movements[0])
        return MovementResponse.model_validate(m)

    async def get_movements(
        self,
        params: PaginationParams,
        product_id: uuid.UUID | None = None,
        movement_type: MovementType | None = None,
    ) -> PaginatedResponse[MovementResponse]:
        movements, total = await self.repo.get_movements(
            offset=params.offset,
            limit=params.limit,
            product_id=product_id,
            movement_type=movement_type,
        )
        return PaginatedResponse.build(
            data=[MovementResponse.model_validate(m) for m in movements],
            total=total,
            params=params,
        )

    # ── Summary ───────────────────────────────────────────────────────────────

    async def get_summary(self) -> InventorySummary:
        data = await self.repo.get_summary()
        return InventorySummary(**data)
