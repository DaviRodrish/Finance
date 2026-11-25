from datetime import date

from fastapi import APIRouter, Query

from .. import models, schemas
from .. import services as sv
from ..deps import Db, MonthPath, MonthQuery, OptMonthQuery, User

router = APIRouter(tags=["Despesas"])
K = sv.EXPENSE


@router.put("/income", response_model=schemas.IncomeUpsert)
def upsert_income(payload: schemas.IncomeUpsert, db: Db, user_id: User):
    income = (
        db.query(models.MonthlyIncome)
        .filter(
            models.MonthlyIncome.user_id == user_id,
            models.MonthlyIncome.reference_month == payload.reference_month,
        )
        .first()
    ) or models.MonthlyIncome(
        user_id=user_id,
        reference_month=payload.reference_month,
    )
    income.amount = payload.amount
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.get("/dashboard/{reference_month}", response_model=schemas.DashboardOut)
def get_dashboard(reference_month: MonthPath, db: Db, user_id: User):
    return sv.dashboard(db, reference_month, user_id)


@router.post("/expenses", response_model=schemas.DashboardOut)
def create_expense(payload: schemas.ExpenseCreate, db: Db, user_id: User):
    sv.create_launch(db, K, user_id, payload, payload.expense_type)
    return sv.dashboard(db, payload.start_month, user_id)


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Db, user_id: User):
    sv.delete_parent(db, K, expense_id, user_id)
    return {"message": "Lançamento removido"}


@router.post("/expenses/{expense_id}/extend")
def extend_expense(expense_id: int, db: Db, user_id: User, months: int = Query(12, ge=1, le=60)):
    return {"added": sv.extend_recurring(db, expense_id, months, user_id)}


@router.get("/entries/overdue", response_model=list[schemas.MonthlyEntryOut])
def overdue_entries(db: Db, user_id: User, before: OptMonthQuery = None):
    """Parcelas pendentes de meses anteriores a `before` (padrão: mês atual)."""
    return sv.overdue_entries(db, K, before or date.today().strftime("%Y-%m"), user_id)


@router.post("/entries/pay-entity")
def pay_all_entity(reference_month: MonthQuery, entity_id: int, db: Db, user_id: User):
    return {"updated": sv.settle_entity(db, K, reference_month, entity_id, user_id)}


@router.patch("/entries/{entry_id}", response_model=schemas.MonthlyEntryOut)
def update_entry(
    entry_id: int,
    payload: schemas.MonthlyEntryUpdate,
    db: Db,
    user_id: User,
    apply_future: bool = False,
):
    return sv.update_entry(db, K, entry_id, payload, apply_future, user_id)


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Db, user_id: User):
    sv.delete_entry(db, K, entry_id, user_id)
    return {"message": "Registro removido"}