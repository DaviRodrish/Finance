from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class EntityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#3B82F6", max_length=20)


class EntityOut(BaseModel):
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    entity_id: int
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0)
    expense_type: str = Field(default="single", pattern=r"^(single|installment|recurring)$")
    total_installments: int = Field(default=1, ge=1, le=120)
    start_installment: int = Field(default=1, ge=1)
    start_month: str = Field(pattern=r"^\d{4}-\d{2}$")


class MonthlyEntryUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[str] = Field(default=None, pattern=r"^(pending|paid)$")


class MonthlyEntryOut(BaseModel):
    id: int
    expense_id: int
    description: str
    reference_month: str
    installment_label: Optional[str] = None
    amount: Decimal
    status: str
    entity: EntityOut

    class Config:
        from_attributes = True


class EntityBreakdown(BaseModel):
    entity_id: int
    entity_name: str
    color: str
    total_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    percentage: float


class MonthProjection(BaseModel):
    month: str
    total_amount: Decimal


class DashboardOut(BaseModel):
    reference_month: str
    income: Decimal
    total_expenses: Decimal
    total_paid: Decimal
    total_pending: Decimal
    remaining: Decimal
    commitment_percentage: float
    by_entity: List[EntityBreakdown]
    next_6_months: List[MonthProjection]
    entries: List[MonthlyEntryOut]


class IncomeUpsert(BaseModel):
    reference_month: str = Field(pattern=r"^\d{4}-\d{2}$")
    amount: Decimal = Field(ge=0)


class ReceivableCreate(BaseModel):
    entity_id: int
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0)
    total_installments: int = Field(default=1, ge=1, le=120)
    start_installment: int = Field(default=1, ge=1)
    start_month: str = Field(pattern=r"^\d{4}-\d{2}$")


class ReceivableEntryUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[str] = Field(default=None, pattern=r"^(pending|received)$")


class ReceivableEntryOut(BaseModel):
    id: int
    receivable_id: int
    description: str
    reference_month: str
    installment_label: Optional[str] = None
    amount: Decimal
    status: str
    entity: EntityOut

    class Config:
        from_attributes = True


class ReceivablesMonthOut(BaseModel):
    reference_month: str
    total_receivable: Decimal
    total_received: Decimal
    total_pending: Decimal
    entries: List[ReceivableEntryOut]