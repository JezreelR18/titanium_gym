import uuid
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.shared.enums import MemberStatus, GenderType


class EmergencyContactBase(BaseModel):
    full_name: str
    relationship: Optional[str] = None
    phone: str
    phone_alt: Optional[str] = None
    email: Optional[str] = None


class EmergencyContactCreate(EmergencyContactBase):
    pass


class EmergencyContactResponse(EmergencyContactBase):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PhysicalStatsBase(BaseModel):
    weight_kg: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    body_fat_pct: Optional[Decimal] = None
    muscle_mass_kg: Optional[Decimal] = None
    bmi: Optional[Decimal] = None
    notes: Optional[str] = None
    measured_at: date


class PhysicalStatsCreate(PhysicalStatsBase):
    pass


class PhysicalStatsResponse(PhysicalStatsBase):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[GenderType] = None
    address: Optional[str] = None
    id_number: Optional[str] = None
    occupation: Optional[str] = None
    note: Optional[str] = None


class MemberCreate(MemberBase):
    emergency_contacts: list[EmergencyContactCreate] = []


class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[GenderType] = None
    address: Optional[str] = None
    id_number: Optional[str] = None
    occupation: Optional[str] = None
    status: Optional[MemberStatus] = None
    note: Optional[str] = None


class MemberResponse(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[GenderType] = None
    address: Optional[str] = None
    id_number: Optional[str] = None
    occupation: Optional[str] = None
    status: MemberStatus
    joined_at: date
    is_active: bool
    note: Optional[str] = None
    emergency_contacts: list[EmergencyContactResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberListResponse(BaseModel):
    id: uuid.UUID
    member_code: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: MemberStatus
    joined_at: date
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}
