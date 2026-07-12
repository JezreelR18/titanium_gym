from pydantic import BaseModel
from typing import TypeVar, Generic, List
from fastapi import Query

T = TypeVar("T")


class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1),
        limit: int = Query(default=20, ge=1, le=1000),
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def build(cls, data: List[T], total: int, params: PaginationParams):
        import math
        return cls(
            data=data,
            total=total,
            page=params.page,
            limit=params.limit,
            pages=math.ceil(total / params.limit) if total > 0 else 1,
        )
