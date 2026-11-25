from typing import Annotated

from fastapi import APIRouter, Path
from sqlalchemy import func

from .. import models, schemas
from ..deps import Db, User
from ..services import ZERO

router = APIRouter(prefix="/reports", tags=["Relatórios"])


def _sum_by_month(db, model, year: int, user_id: str) -> dict:
    return dict(
        db.query(model.reference_month, func.sum(model.amount))
        .filter(model.user_id == user_id, model.reference_month.like(f"{year}-%"))
        .group_by(model.reference_month)
        .all()
    )


@router.get("/{year}", response_model=schemas.YearReport)
def year_report(year: Annotated[int, Path(ge=2000, le=2100)], db: Db, user_id: User):
    income = _sum_by_month(db, models.MonthlyIncome, year, user_id)
    expenses = _sum_by_month(db, models.MonthlyEntry, year, user_id)
    receivables = _sum_by_month(db, models.ReceivableEntry, year, user_id)

    months = []
    for m in (f"{year}-{i:02d}" for i in range(1, 13)):
        inc = income.get(m, ZERO)
        exp = expenses.get(m, ZERO)
        rec = receivables.get(m, ZERO)
        months.append(
            schemas.MonthSummary(
                month=m,
                income=inc,
                expenses=exp,
                receivables=rec,
                balance=inc - exp,
            )
        )
    return schemas.YearReport(year=year, months=months)
