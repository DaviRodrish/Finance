from datetime import datetime
from decimal import Decimal
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Controle Financeiro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user_id() -> str:
    # Substitua pela validação real do token JWT do Supabase no seu projeto
    raise NotImplementedError("Configure get_current_user_id com o token do Supabase")


def _shift_ym(ym: str, offset: int) -> str:
    y, m = map(int, ym.split("-"))
    total = y * 12 + (m - 1) + offset
    ny = total // 12
    nm = (total % 12) + 1
    return f"{ny:04d}-{nm:02d}"


def _format_entry(entry: models.MonthlyEntry) -> schemas.MonthlyEntryOut:
    label = None
    if entry.expense and entry.expense.expense_type == "installment" and entry.total_installments > 1:
        label = f"{entry.installment_number}/{entry.total_installments}"
    elif entry.expense and entry.expense.expense_type == "recurring":
        label = "Fixo"

    return schemas.MonthlyEntryOut(
        id=entry.id,
        expense_id=entry.expense_id,
        description=entry.description,
        reference_month=entry.reference_month,
        installment_label=label,
        amount=entry.amount,
        status=entry.status,
        entity=entry.entity,
    )


@app.get("/entities", response_model=list[schemas.EntityOut])
def get_entities(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return (
        db.query(models.Entity)
        .filter(models.Entity.user_id == user_id)
        .order_by(models.Entity.id.asc())
        .all()
    )


@app.post("/entities", response_model=schemas.EntityOut)
def create_entity(
    payload: schemas.EntityCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entity = models.Entity(
        user_id=user_id,
        name=payload.name.strip(),
        color=payload.color,
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@app.put("/income")
def upsert_income(
    payload: schemas.IncomeUpsert,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    income = (
        db.query(models.MonthlyIncome)
        .filter(
            models.MonthlyIncome.user_id == user_id,
            models.MonthlyIncome.reference_month == payload.reference_month,
        )
        .first()
    )
    if income:
        income.amount = payload.amount
    else:
        income = models.MonthlyIncome(
            user_id=user_id,
            reference_month=payload.reference_month,
            amount=payload.amount,
        )
        db.add(income)

    db.commit()
    db.refresh(income)
    return {"reference_month": income.reference_month, "amount": income.amount}


@app.post("/expenses", response_model=schemas.DashboardOut)
def create_expense(
    payload: schemas.ExpenseCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entity = (
        db.query(models.Entity)
        .filter(models.Entity.id == payload.entity_id, models.Entity.user_id == user_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Pessoa/Categoria não encontrada")

    if payload.expense_type == "installment":
        if payload.start_installment > payload.total_installments:
            raise HTTPException(status_code=400, detail="Parcela inicial maior que o total")
        count = payload.total_installments - payload.start_installment + 1
        total_amount = Decimal(payload.amount) * Decimal(count)
        expense = models.Expense(
            user_id=user_id,
            entity_id=entity.id,
            description=payload.description.strip(),
            total_amount=total_amount,
            installment_amount=payload.amount,
            expense_type="installment",
            total_installments=payload.total_installments,
            start_month=payload.start_month,
        )
        db.add(expense)
        db.flush()

        for idx, inst_num in enumerate(range(payload.start_installment, payload.total_installments + 1)):
            db.add(
                models.MonthlyEntry(
                    user_id=user_id,
                    expense_id=expense.id,
                    entity_id=entity.id,
                    description=payload.description.strip(),
                    reference_month=_shift_ym(payload.start_month, idx),
                    installment_number=inst_num,
                    total_installments=payload.total_installments,
                    amount=payload.amount,
                    status="pending",
                )
            )
    elif payload.expense_type == "recurring":
        months_ahead = 12
        total_amount = Decimal(payload.amount) * Decimal(months_ahead)
        expense = models.Expense(
            user_id=user_id,
            entity_id=entity.id,
            description=payload.description.strip(),
            total_amount=total_amount,
            installment_amount=payload.amount,
            expense_type="recurring",
            total_installments=1,
            start_month=payload.start_month,
        )
        db.add(expense)
        db.flush()

        for idx in range(months_ahead):
            db.add(
                models.MonthlyEntry(
                    user_id=user_id,
                    expense_id=expense.id,
                    entity_id=entity.id,
                    description=payload.description.strip(),
                    reference_month=_shift_ym(payload.start_month, idx),
                    installment_number=1,
                    total_installments=1,
                    amount=payload.amount,
                    status="pending",
                )
            )
    else:
        expense = models.Expense(
            user_id=user_id,
            entity_id=entity.id,
            description=payload.description.strip(),
            total_amount=payload.amount,
            installment_amount=payload.amount,
            expense_type="single",
            total_installments=1,
            start_month=payload.start_month,
        )
        db.add(expense)
        db.flush()

        db.add(
            models.MonthlyEntry(
                user_id=user_id,
                expense_id=expense.id,
                entity_id=entity.id,
                description=payload.description.strip(),
                reference_month=payload.start_month,
                installment_number=1,
                total_installments=1,
                amount=payload.amount,
                status="pending",
            )
        )

    db.commit()
    return get_dashboard(payload.start_month, db=db, user_id=user_id)


@app.patch("/entries/{entry_id}", response_model=schemas.MonthlyEntryOut)
def update_entry(
    entry_id: int,
    payload: schemas.MonthlyEntryUpdate,
    apply_future: bool = False,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entry = (
        db.query(models.MonthlyEntry)
        .filter(models.MonthlyEntry.id == entry_id, models.MonthlyEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Registro não encontrado")

    targets = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.user_id == user_id,
            models.MonthlyEntry.expense_id == entry.expense_id,
            models.MonthlyEntry.reference_month >= entry.reference_month,
        )
        .all()
        if apply_future
        else [entry]
    )

    for target in targets:
        if payload.status is not None:
            target.status = payload.status
            target.paid_at = datetime.utcnow() if payload.status == "paid" else None
        if payload.amount is not None:
            target.amount = payload.amount
        if payload.description is not None:
            target.description = payload.description.strip()

    db.commit()
    db.refresh(entry)
    return _format_entry(entry)


@app.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entry = (
        db.query(models.MonthlyEntry)
        .filter(models.MonthlyEntry.id == entry_id, models.MonthlyEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Registro não encontrado")

    expense_id = entry.expense_id
    db.delete(entry)
    db.flush()

    remaining = (
        db.query(models.MonthlyEntry)
        .filter(models.MonthlyEntry.expense_id == expense_id, models.MonthlyEntry.user_id == user_id)
        .count()
    )
    if remaining == 0:
        parent = (
            db.query(models.Expense)
            .filter(models.Expense.id == expense_id, models.Expense.user_id == user_id)
            .first()
        )
        if parent:
            db.delete(parent)

    db.commit()
    return {"message": "Registro removido"}


@app.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    expense = (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id, models.Expense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    db.delete(expense)
    db.commit()
    return {"message": "Lançamento removido"}


@app.post("/entries/pay-entity")
def pay_all_entity(
    reference_month: str,
    entity_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entries = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.user_id == user_id,
            models.MonthlyEntry.reference_month == reference_month,
            models.MonthlyEntry.entity_id == entity_id,
        )
        .all()
    )
    for item in entries:
        item.status = "paid"
        item.paid_at = datetime.utcnow()
    db.commit()
    return {"updated": len(entries)}


@app.get("/dashboard/{reference_month}", response_model=schemas.DashboardOut)
def get_dashboard(
    reference_month: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    income_row = (
        db.query(models.MonthlyIncome)
        .filter(
            models.MonthlyIncome.user_id == user_id,
            models.MonthlyIncome.reference_month == reference_month,
        )
        .first()
    )
    income = Decimal(income_row.amount) if income_row else Decimal("0.00")

    entries = (
        db.query(models.MonthlyEntry)
        .filter(
            models.MonthlyEntry.user_id == user_id,
            models.MonthlyEntry.reference_month == reference_month,
        )
        .order_by(models.MonthlyEntry.id.asc())
        .all()
    )

    total_paid = sum((Decimal(e.amount) for e in entries if e.status == "paid"), Decimal("0.00"))
    total_pending = sum((Decimal(e.amount) for e in entries if e.status != "paid"), Decimal("0.00"))
    total_expenses = total_paid + total_pending
    remaining = income - total_expenses
    commitment_pct = (
        round(float((total_expenses / income) * Decimal("100")), 1)
        if income > 0
        else 0.0
    )

    grouped: dict[int, dict] = {}
    for e in entries:
        ent = e.entity
        if ent.id not in grouped:
            grouped[ent.id] = {
                "entity_id": ent.id,
                "entity_name": ent.name,
                "color": ent.color,
                "total_amount": Decimal("0.00"),
                "paid_amount": Decimal("0.00"),
                "pending_amount": Decimal("0.00"),
            }
        amt = Decimal(e.amount)
        grouped[ent.id]["total_amount"] += amt
        if e.status == "paid":
            grouped[ent.id]["paid_amount"] += amt
        else:
            grouped[ent.id]["pending_amount"] += amt

    by_entity = []
    for item in grouped.values():
        pct = (
            round(float((item["total_amount"] / total_expenses) * Decimal("100")), 1)
            if total_expenses > 0
            else 0.0
        )
        by_entity.append(
            schemas.EntityBreakdown(
                entity_id=item["entity_id"],
                entity_name=item["entity_name"],
                color=item["color"],
                total_amount=item["total_amount"],
                paid_amount=item["paid_amount"],
                pending_amount=item["pending_amount"],
                percentage=pct,
            )
        )

    next_6_months = []
    for offset in range(1, 7):
        m_str = _shift_ym(reference_month, offset)
        m_entries = (
            db.query(models.MonthlyEntry)
            .filter(
                models.MonthlyEntry.user_id == user_id,
                models.MonthlyEntry.reference_month == m_str,
            )
            .all()
        )
        m_total = sum((Decimal(e.amount) for e in m_entries), Decimal("0.00"))
        next_6_months.append(schemas.MonthProjection(month=m_str, total_amount=m_total))

    return schemas.DashboardOut(
        reference_month=reference_month,
        income=income,
        total_expenses=total_expenses,
        total_paid=total_paid,
        total_pending=total_pending,
        remaining=remaining,
        commitment_percentage=commitment_pct,
        by_entity=by_entity,
        next_6_months=next_6_months,
        entries=[_format_entry(e) for e in entries],
    )


@app.get("/receivables/{reference_month}", response_model=schemas.ReceivablesMonthOut)
def get_receivables_month(
    reference_month: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entries = (
        db.query(models.ReceivableEntry)
        .filter(
            models.ReceivableEntry.user_id == user_id,
            models.ReceivableEntry.reference_month == reference_month,
        )
        .order_by(models.ReceivableEntry.id.asc())
        .all()
    )

    total_received = sum((Decimal(e.amount) for e in entries if e.status == "received"), Decimal("0.00"))
    total_pending = sum((Decimal(e.amount) for e in entries if e.status != "received"), Decimal("0.00"))
    total_receivable = total_received + total_pending

    formatted = [
        schemas.ReceivableEntryOut(
            id=e.id,
            receivable_id=e.receivable_id,
            description=e.description,
            reference_month=e.reference_month,
            installment_label=f"{e.installment_number}/{e.total_installments}"
            if e.total_installments > 1
            else None,
            amount=e.amount,
            status=e.status,
            entity=e.entity,
        )
        for e in entries
    ]

    return schemas.ReceivablesMonthOut(
        reference_month=reference_month,
        total_receivable=total_receivable,
        total_received=total_received,
        total_pending=total_pending,
        entries=formatted,
    )


@app.post("/receivables", response_model=schemas.ReceivablesMonthOut)
def create_receivable(
    payload: schemas.ReceivableCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entity = (
        db.query(models.Entity)
        .filter(models.Entity.id == payload.entity_id, models.Entity.user_id == user_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Pessoa/Categoria não encontrada")

    if payload.start_installment > payload.total_installments:
        raise HTTPException(status_code=400, detail="Parcela inicial maior que o total de parcelas")

    remaining_installments = payload.total_installments - payload.start_installment + 1
    total_amount = Decimal(payload.amount) * Decimal(remaining_installments)

    receivable = models.Receivable(
        user_id=user_id,
        entity_id=entity.id,
        description=payload.description.strip(),
        total_amount=total_amount,
        installment_amount=payload.amount,
        total_installments=payload.total_installments,
        start_month=payload.start_month,
    )
    db.add(receivable)
    db.flush()

    for idx, inst_num in enumerate(range(payload.start_installment, payload.total_installments + 1)):
        db.add(
            models.ReceivableEntry(
                user_id=user_id,
                receivable_id=receivable.id,
                entity_id=entity.id,
                description=payload.description.strip(),
                reference_month=_shift_ym(payload.start_month, idx),
                installment_number=inst_num,
                total_installments=payload.total_installments,
                amount=payload.amount,
                status="pending",
            )
        )

    db.commit()
    return get_receivables_month(payload.start_month, db=db, user_id=user_id)


@app.patch("/receivable-entries/{entry_id}", response_model=schemas.ReceivableEntryOut)
def update_receivable_entry(
    entry_id: int,
    payload: schemas.ReceivableEntryUpdate,
    apply_future: bool = False,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entry = (
        db.query(models.ReceivableEntry)
        .filter(models.ReceivableEntry.id == entry_id, models.ReceivableEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    targets = (
        db.query(models.ReceivableEntry)
        .filter(
            models.ReceivableEntry.user_id == user_id,
            models.ReceivableEntry.receivable_id == entry.receivable_id,
            models.ReceivableEntry.reference_month >= entry.reference_month,
        )
        .all()
        if apply_future
        else [entry]
    )

    for target in targets:
        if payload.description is not None:
            target.description = payload.description.strip()
        if payload.amount is not None:
            target.amount = payload.amount
        if payload.status is not None:
            target.status = payload.status
            target.received_at = datetime.utcnow() if payload.status == "received" else None

    db.commit()
    db.refresh(entry)
    return schemas.ReceivableEntryOut(
        id=entry.id,
        receivable_id=entry.receivable_id,
        description=entry.description,
        reference_month=entry.reference_month,
        installment_label=f"{entry.installment_number}/{entry.total_installments}"
        if entry.total_installments > 1
        else None,
        amount=entry.amount,
        status=entry.status,
        entity=entry.entity,
    )


@app.delete("/receivable-entries/{entry_id}")
def delete_receivable_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    entry = (
        db.query(models.ReceivableEntry)
        .filter(models.ReceivableEntry.id == entry_id, models.ReceivableEntry.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    receivable_id = entry.receivable_id
    db.delete(entry)
    db.flush()

    remaining = (
        db.query(models.ReceivableEntry)
        .filter(models.ReceivableEntry.receivable_id == receivable_id, models.ReceivableEntry.user_id == user_id)
        .count()
    )
    if remaining == 0:
        parent = (
            db.query(models.Receivable)
            .filter(models.Receivable.id == receivable_id, models.Receivable.user_id == user_id)
            .first()
        )
        if parent:
            db.delete(parent)

    db.commit()
    return {"message": "Cobrança removida"}


@app.delete("/receivables/{receivable_id}")
def delete_entire_receivable(
    receivable_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    rec = (
        db.query(models.Receivable)
        .filter(models.Receivable.id == receivable_id, models.Receivable.user_id == user_id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    db.delete(rec)
    db.commit()
    return {"message": "Cobrança parcelada removida por completo"}