from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from .models import ExpenseType, EntryStatus


# --- Entities (Pessoa / Categoria) ---
class EntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#3B82F6")


class EntityOut(EntityCreate):
    id: int

    class Config:
        from_attributes = True


# --- Expenses (Lançamento) ---
class ExpenseCreate(BaseModel):
    entity_id: int
    description: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0)
    expense_type: ExpenseType = ExpenseType.SINGLE
    total_installments: int = Field(default=1, ge=1, le=120)
    start_installment: int = Field(default=1, ge=1)
    start_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")  # Ex: "2026-11"
    status: EntryStatus = EntryStatus.PENDING


# --- Monthly Entries (Linhas da tabela mensal) ---
class MonthlyEntryUpdate(BaseModel):
    status: Optional[EntryStatus] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    description: Optional[str] = None


class MonthlyEntryOut(BaseModel):
    id: int
    expense_id: int
    reference_month: str
    description: str
    amount: Decimal
    installment_label: Optional[str]
    status: EntryStatus
    entity: EntityOut

    class Config:
        from_attributes = True


# --- Income (Ganhos) ---
class IncomeUpsert(BaseModel):
    reference_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    amount: Decimal = Field(..., ge=0)


# --- KPIs & Dashboard ---
class EntityBreakdown(BaseModel):
    entity_id: int
    entity_name: str
    color: str
    total_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    percentage: float


class MonthlyProjection(BaseModel):
    month: str
    total_amount: Decimal


class DashboardResponse(BaseModel):
    reference_month: str
    income: Decimal
    total_expenses: Decimal
    remaining: Decimal
    commitment_percentage: float
    total_paid: Decimal
    total_pending: Decimal
    by_entity: List[EntityBreakdown]
    entries: List[MonthlyEntryOut]
    next_6_months: List[MonthlyProjection]