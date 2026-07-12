import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.sales.service import SalesService
from app.modules.sales.schemas import (
    SaleCreate, SaleResponse, SaleListResponse,
    DebtPaymentCreate, DebtResponse, PaymentMethodResponse,
)
from app.shared.pagination import PaginationParams, PaginatedResponse

router = APIRouter()


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
async def list_payment_methods(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await SalesService(db).get_payment_methods()


# Static /debts path MUST be defined before /{sale_id}
@router.get("/debts", response_model=PaginatedResponse[DebtResponse])
async def list_all_debts(
    params: PaginationParams = Depends(),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await SalesService(db).get_all_debts(params, status_filter=status_filter, search=search)


@router.get("/debts/member/{member_id}", response_model=list[DebtResponse])
async def member_debts(member_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await SalesService(db).get_member_debts(member_id)


@router.post("/debts/{debt_id}/pay", response_model=DebtResponse)
async def pay_debt(
    debt_id: uuid.UUID,
    data: DebtPaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SalesService(db).pay_debt(debt_id, data, paid_by=current_user.id)


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SalesService(db).create(data, cashier_id=current_user.id)


@router.get("", response_model=PaginatedResponse[SaleListResponse])
async def list_sales(
    params: PaginationParams = Depends(),
    search: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await SalesService(db).get_all(params, search=search, payment_status=payment_status)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await SalesService(db).get_by_id(sale_id)


@router.post("/{sale_id}/cancel", response_model=SaleResponse)
async def cancel_sale(
    sale_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SalesService(db).cancel(sale_id, updated_by=current_user.id)
