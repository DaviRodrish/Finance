from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

MONTH_RE = r"^\d{4}-\d{2}$"


class EntityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#3B82F6", max_length=20)


class EntityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str


class ExpenseCreate(BaseModel):
    entity_id: int
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0)
    expense_type: str = Field(default="single", pattern=r"^(single|installment|recurring)$")
    total_installments: int = Field(default=1, ge=1, le=120)
    start_installment: int = Field(default=1, ge=1)
    start_month: str = Field(pattern=MONTH_RE)


class MonthlyEntryUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[str] = Field(default=None, pattern=r"^(pending|paid)$")


class MonthlyEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    expense_id: int
    description: str
    reference_month: str
    installment_label: Optional[str] = None
    amount: Decimal
    status: str
    entity: EntityOut

    @model_validator(mode="before")
    @classmethod
    def _build_label(cls, data):
        if hasattr(data, "installment_label") and data.installment_label is not None:
            return data
        inst_num = getattr(data, "installment_number", None)
        tot_inst = getattr(data, "total_installments", None)
        rec = getattr(data, "receivable", None)
        etype = getattr(rec, "expense_type", None)

        label = None
        if etype == "recurring":
            label = "Fixo"
        elif inst_num and tot_inst and tot_inst > 1:
            label = f"{inst_num}/{tot_inst}"

        return {
            "id": data.id,
            "expense_id": data.expense_id,
            "description": data.description,
            "reference_month": data.reference_month,
            "installment_label": label,
            "amount": data.amount,
            "status": data.status,
            "entity": data.entity,
        }


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
    receivables_pending: Decimal = Decimal("0.00")
    projected_balance: Decimal = Decimal("0.00")
    by_entity: List[EntityBreakdown]
    next_6_months: List[MonthProjection]
    entries: List[MonthlyEntryOut]


class IncomeUpsert(BaseModel):
    reference_month: str = Field(pattern=MONTH_RE)
    amount: Decimal = Field(ge=0)


class ReceivableCreate(BaseModel):
    entity_id: int
    description: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(gt=0)
    expense_type: str = Field(default="single", pattern=r"^(single|installment|recurring)$")
    total_installments: int = Field(default=1, ge=1, le=120)
    start_installment: int = Field(default=1, ge=1)
    start_month: str = Field(pattern=MONTH_RE)


class ReceivableEntryUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[str] = Field(default=None, pattern=r"^(pending|received)$")


class ReceivableEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    receivable_id: int
    description: str
    reference_month: str
    installment_label: Optional[str] = None
    amount: Decimal
    status: str
    entity: EntityOut

    @model_validator(mode="before")
    @classmethod
    def _build_label(cls, data):
        if hasattr(data, "installment_label") and data.installment_label is not None:
            return data
        inst_num = getattr(data, "installment_number", None)
        tot_inst = getattr(data, "total_installments", None)
        label = f"{inst_num}/{tot_inst}" if inst_num and tot_inst and tot_inst > 1 else None
        return {
            "id": data.id,
            "receivable_id": data.receivable_id,
            "description": data.description,
            "reference_month": data.reference_month,
            "installment_label": label,
            "amount": data.amount,
            "status": data.status,
            "entity": data.entity,
        }


class ReceivablesMonthOut(BaseModel):
    reference_month: str
    total_receivable: Decimal
    total_received: Decimal
    total_pending: Decimal
    entries: List[ReceivableEntryOut]


class MonthSummary(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    receivables: Decimal
    balance: Decimal


class YearReport(BaseModel):
    year: int
    months: List[MonthSummary]