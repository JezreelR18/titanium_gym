import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.modules.memberships.service import MembershipService
from app.modules.memberships.schemas import PlanCreate, PlanUpdate, PlanResponse, MembershipAssign, MembershipUpdate, MembershipResponse

router = APIRouter()


# ── Plans ──────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(
    active_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await MembershipService(db).get_plans(active_only)


@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await MembershipService(db).create_plan(data, created_by=current_user.id)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await MembershipService(db).get_plan(plan_id)


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    data: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_owner),
):
    return await MembershipService(db).update_plan(plan_id, data, updated_by=current_user.id)


# ── Assignments ────────────────────────────────────────────────

@router.post("/assign", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
async def assign_membership(
    data: MembershipAssign,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MembershipService(db).assign(data, created_by=current_user.id)


@router.get("/member/{member_id}", response_model=list[MembershipResponse])
async def get_member_memberships(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await MembershipService(db).get_member_memberships(member_id)


@router.get("/expiring", response_model=list[MembershipResponse])
async def expiring_soon(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await MembershipService(db).get_expiring_soon(days)


@router.put("/{membership_id}", response_model=MembershipResponse)
async def update_membership(
    membership_id: uuid.UUID,
    data: MembershipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MembershipService(db).update_membership(membership_id, data, updated_by=current_user.id)
