from datetime import datetime
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas


def add_months(ym_str: str, months_to_add: int) -> str:
    dt = datetime.strptime(ym_str, "%Y-%m")
    new_dt = dt + relativedelta(months=months_to_add)
    return new_dt.strftime("%Y-%m")


def create_expense_with_entries(
    db: Session, payload: schemas.ExpenseCreate, user_id: str
) -> models.Expense:
    db_expense = models.Expense(
        user_id=user_id,
        entity_id=payload.entity_id,
        description=payload.description,
        amount=payload.amount,
        expense_type=payload.expense_type,
        total_installments=payload.total_installments,
        start_installment=payload.start_installment,
        start_month=payload.start_month,
    )
    db.add(db_expense)
    db.flush()

    entries_to_create = []

    if payload.expense_type == models.ExpenseType.SINGLE:
        entries_to_create.append(
            models.MonthlyEntry(
                user_id=user_id,
                expense_id=db_expense.id,
                entity_id=payload.entity_id,
                reference_month=payload.start_month,
                description=payload.description,
                amount=payload.amount,
                installment_label=None,
                status=payload.status,
            )
        )

    elif payload.expense_type == models.ExpenseType.INSTALLMENT:
        remaining_installments = payload.total_installments - payload.start_installment + 1
        for offset in range(remaining_installments):
            current_num = payload.start_installment + offset
            target_month = add_months(payload.start_month, offset)
            entry_status = payload.status if offset == 0 else models.EntryStatus.PENDING

            entries_to_create.append(
                models.MonthlyEntry(
                    user_id=user_id,
                    expense_id=db_expense.id,
                    entity_id=payload.entity_id,
                    reference_month=target_month,
                    description=payload.description,
                    amount=payload.amount,
                    installment_label=f"{current_num}/{payload.total_installments}",
                    status=entry_status,
                )
            )

    elif payload.expense_type == models.ExpenseType.RECURRING:
        for offset in range(12):
            target_month = add_months(payload.start_month, offset)
            entry_status = payload.status if offset == 0 else models.EntryStatus.PENDING

            entries_to_create.append(
                models.MonthlyEntry(
                    user_id=user_id,
                    expense_id=db_expense.id,
                    entity_id=payload.entity_id,
                    reference_month=target_month,
                    description=payload.description,
                    amount=payload.amount,
                    installment_label="Fixo",
                    status=entry_status,
                )
            )

    db.add_all(entries_to_create)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_monthly_dashboard(
    db: Session, reference_month: str, user_id: str
) -> schemas.DashboardResponse:
    entries = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.user_id == user_id,
            models.MonthlyEntry.reference_month == reference_month,
        )
        .order_by(models.MonthlyEntry.entity_id, models.MonthlyEntry.id)
        .all()
    )

    income_record = (
        db.query(models.MonthlyIncome)
        .filter(
            models.MonthlyIncome.user_id == user_id,
            models.MonthlyIncome.reference_month == reference_month,
        )
        .first()
    )
    income = Decimal(income_record.amount) if income_record else Decimal("0.00")

    total_expenses = sum((Decimal(e.amount) for e in entries), Decimal("0.00"))
    total_paid = sum(
        (Decimal(e.amount) for e in entries if e.status == models.EntryStatus.PAID),
        Decimal("0.00"),
    )
    total_pending = total_expenses - total_paid
    remaining = income - total_expenses
    commitment_pct = round(float((total_expenses / income) * 100), 1) if income > 0 else 0.0

    entity_map = {}
    for entry in entries:
        eid = entry.entity_id
        if eid not in entity_map:
            entity_map[eid] = {
                "entity_id": eid,
                "entity_name": entry.entity.name,
                "color": entry.entity.color,
                "total_amount": Decimal("0.00"),
                "paid_amount": Decimal("0.00"),
                "pending_amount": Decimal("0.00"),
            }
        amt = Decimal(entry.amount)
        entity_map[eid]["total_amount"] += amt
        if entry.status == models.EntryStatus.PAID:
            entity_map[eid]["paid_amount"] += amt
        else:
            entity_map[eid]["pending_amount"] += amt

    by_entity = []
    for item in entity_map.values():
        pct = round(float((item["total_amount"] / total_expenses) * 100), 1) if total_expenses > 0 else 0.0
        by_entity.append(schemas.EntityBreakdown(**item, percentage=pct))

    by_entity.sort(key=lambda x: x.total_amount, reverse=True)

    next_6_months = []
    for i in range(6):
        m = add_months(reference_month, i)
        m_total = (
            db.query(func.coalesce(func.sum(models.MonthlyEntry.amount), 0))
            .filter(
                models.MonthlyEntry.user_id == user_id,
                models.MonthlyEntry.reference_month == m,
            )
            .scalar()
        )
        next_6_months.append(schemas.MonthlyProjection(month=m, total_amount=Decimal(m_total)))

    return schemas.DashboardResponse(
        reference_month=reference_month,
        income=income,
        total_expenses=total_expenses,
        remaining=remaining,
        commitment_percentage=commitment_pct,
        total_paid=total_paid,
        total_pending=total_pending,
        by_entity=by_entity,
        entries=entries,
        next_6_months=next_6_months,
    )