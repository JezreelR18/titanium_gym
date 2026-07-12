import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.members.service import MemberService
from app.modules.members.schemas import (
    MemberCreate, MemberUpdate, MemberResponse, MemberListResponse,
    EmergencyContactCreate, EmergencyContactResponse,
    PhysicalStatsCreate, PhysicalStatsResponse,
)
from app.shared.pagination import PaginationParams, PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[MemberListResponse])
async def list_members(
    search: Optional[str] = Query(default=None),
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await MemberService(db).get_all(params, search=search)


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    data: MemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemberService(db).create(data, created_by=current_user.id)


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await MemberService(db).get_by_id(member_id)


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: uuid.UUID,
    data: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemberService(db).update(member_id, data, updated_by=current_user.id)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    member_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await MemberService(db).delete(member_id, deleted_by=current_user.id)


@router.post("/{member_id}/emergency-contacts", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
async def add_emergency_contact(
    member_id: uuid.UUID,
    data: EmergencyContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemberService(db).add_emergency_contact(member_id, data, created_by=current_user.id)


@router.delete("/{member_id}/emergency-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_emergency_contact(
    member_id: uuid.UUID,
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await MemberService(db).delete_emergency_contact(member_id, contact_id)


@router.post("/{member_id}/physical-stats", response_model=PhysicalStatsResponse, status_code=status.HTTP_201_CREATED)
async def add_physical_stats(
    member_id: uuid.UUID,
    data: PhysicalStatsCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await MemberService(db).add_physical_stats(member_id, data, created_by=current_user.id)
