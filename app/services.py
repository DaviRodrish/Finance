"""Regras de negócio compartilhadas entre despesas (a pagar) e cobranças (a receber)."""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from . import models, schemas

ZERO = Decimal("0.00")
RECURRING_MONTHS = 12


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Kind:
    """Descreve um par pai/parcela, para reaproveitar a mesma lógica nos dois fluxos."""
    parent: type
    entry: type
    attr: str       # nome da relação parcela -> pai ("expense" / "receivable")
    done: str       # status final ("paid" / "received")
    done_at: str    # coluna de data do status final
    nf: str         # mensagem de 404

    @property
    def fk(self) -> str:
        return f"{self.attr}_id"


EXPENSE = Kind(models.Expense, models.MonthlyEntry, "expense", "paid", "paid_at", "Lançamento não encontrado")
RECEIVABLE = Kind(models.Receivable, models.ReceivableEntry, "receivable", "received", "received_at", "Cobrança não encontrada")


# ---------- utilitários ----------
def shift_ym(ym: str, offset: int) -> str:
    y, m = map(int, ym.split("-"))
    y, m = divmod(y * 12 + (m - 1) + offset, 12)
    return f"{y:04d}-{m + 1:02d}"


def pct(part: Decimal, whole: Decimal) -> float:
    return round(float(part / whole * 100), 1) if whole > 0 else 0.0


def split_totals(entries, done: str):
    """Retorna (total, concluído, pendente)."""
    total = sum((e.amount for e in entries), ZERO)
    finished = sum((e.amount for e in entries if e.status == done), ZERO)
    return total, finished, total - finished


def owned(db: Session, model, obj_id: int, user_id: str, msg: str):
    obj = db.query(model).filter(model.id == obj_id, model.user_id == user_id).first()
    if not obj:
        raise HTTPException(404, msg)
    return obj


def _entries_query(db: Session, k: Kind, user_id: str):
    return (
        db.query(k.entry)
        .options(joinedload(k.entry.entity), joinedload(getattr(k.entry, k.attr)))
        .filter(k.entry.user_id == user_id)
    )


def month_entries(db: Session, k: Kind, month: str, user_id: str):
    return _entries_query(db, k, user_id).filter(k.entry.reference_month == month).order_by(k.entry.id).all()


def overdue_entries(db: Session, k: Kind, before: str, user_id: str):
    return (
        _entries_query(db, k, user_id)
        .filter(k.entry.status != k.done, k.entry.reference_month < before)
        .order_by(k.entry.reference_month, k.entry.id)
        .all()
    )


# ---------- criação ----------
def _plan(etype: str, start_month: str, total: int, first: int):
    """Lista de (mês, nº da parcela, total de parcelas) que serão geradas."""
    if etype == "recurring":
        return [(shift_ym(start_month, i), 1, 1) for i in range(RECURRING_MONTHS)]
    if etype == "single":
        return [(start_month, 1, 1)]
    return [(shift_ym(start_month, i), n, total) for i, n in enumerate(range(first, total + 1))]


def create_launch(db: Session, k: Kind, user_id: str, p, etype: str = "installment"):
    owned(db, models.Entity, p.entity_id, user_id, "Pessoa/Categoria não encontrada")

    total = p.total_installments if etype == "installment" else 1
    first = p.start_installment if etype == "installment" else 1
    if first > total:
        raise HTTPException(400, "Parcela inicial maior que o total de parcelas")

    items = _plan(etype, p.start_month, total, first)
    extra = {"expense_type": etype}
    parent = k.parent(
        user_id=user_id, entity_id=p.entity_id, description=p.description.strip(),
        total_amount=p.amount * len(items), installment_amount=p.amount,
        total_installments=total, start_month=p.start_month, **extra,
    )
    db.add(parent)
    db.flush()
    db.add_all([
        k.entry(
            **{k.fk: parent.id}, user_id=user_id, entity_id=p.entity_id, description=p.description.strip(),
            reference_month=month, installment_number=num, total_installments=tot,
            amount=p.amount, status="pending",
        )
        for month, num, tot in items
    ])
    db.commit()
    return parent


def extend_recurring(db: Session, expense_id: int, months: int, user_id: str) -> int:
    expense = owned(db, models.Expense, expense_id, user_id, EXPENSE.nf)
    if expense.expense_type != "recurring":
        raise HTTPException(400, "Só despesas fixas podem ser estendidas")

    last = (
        db.query(models.MonthlyEntry)
        .filter(models.MonthlyEntry.expense_id == expense.id)
        .order_by(models.MonthlyEntry.reference_month.desc())
        .first()
    )
    if not last:
        raise HTTPException(400, "Despesa fixa sem parcelas para estender")

    db.add_all([
        models.MonthlyEntry(
            user_id=user_id, expense_id=expense.id, entity_id=expense.entity_id,
            description=last.description, reference_month=shift_ym(last.reference_month, i),
            installment_number=1, total_installments=1, amount=last.amount, status="pending",
        )
        for i in range(1, months + 1)
    ])
    expense.total_amount += last.amount * months
    db.commit()
    return months


# ---------- edição / remoção / baixa ----------
def update_entry(db: Session, k: Kind, entry_id: int, data, apply_future: bool, user_id: str):
    entry = owned(db, k.entry, entry_id, user_id, k.nf)
    fk = getattr(k.entry, k.fk)
    targets = (
        db.query(k.entry)
        .filter(k.entry.user_id == user_id, fk == getattr(entry, k.fk),
                k.entry.reference_month >= entry.reference_month)
        .all()
        if apply_future else [entry]
    )
    changes = {f: v.strip() if isinstance(v, str) else v for f, v in data.model_dump().items() if v is not None}
    for target in targets:
        for field, value in changes.items():
            setattr(target, field, value)
        if "status" in changes:
            setattr(target, k.done_at, _now_utc() if changes["status"] == k.done else None)
    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, k: Kind, entry_id: int, user_id: str):
    """Remove a parcela; se era a última do pai, remove o pai também."""
    entry = owned(db, k.entry, entry_id, user_id, k.nf)
    parent_id = getattr(entry, k.fk)
    db.delete(entry)
    db.flush()
    if not db.query(k.entry).filter(getattr(k.entry, k.fk) == parent_id).first():
        parent = db.get(k.parent, parent_id)
        if parent:
            db.delete(parent)
    db.commit()


def delete_parent(db: Session, k: Kind, parent_id: int, user_id: str):
    db.delete(owned(db, k.parent, parent_id, user_id, k.nf))
    db.commit()


def settle_entity(db: Session, k: Kind, month: str, entity_id: int, user_id: str) -> int:
    """Marca como pago/recebido tudo que ainda está pendente de uma pessoa no mês."""
    updated = (
        db.query(k.entry)
        .filter(k.entry.user_id == user_id, k.entry.reference_month == month,
                k.entry.entity_id == entity_id, k.entry.status != k.done)
        .update({"status": k.done, k.done_at: _now_utc()}, synchronize_session="fetch")
    )
    db.commit()
    return updated


# ---------- leituras agregadas ----------
def receivables_month(db: Session, month: str, user_id: str) -> schemas.ReceivablesMonthOut:
    entries = month_entries(db, RECEIVABLE, month, user_id)
    total, received, pending = split_totals(entries, "received")
    return schemas.ReceivablesMonthOut(
        reference_month=month, total_receivable=total, total_received=received,
        total_pending=pending, entries=entries,
    )


def dashboard(db: Session, month: str, user_id: str) -> schemas.DashboardOut:
    entries = month_entries(db, EXPENSE, month, user_id)
    income_row = (
        db.query(models.MonthlyIncome)
        .filter(models.MonthlyIncome.user_id == user_id, models.MonthlyIncome.reference_month == month)
        .first()
    )
    income = income_row.amount if income_row else ZERO
    total, paid, pending = split_totals(entries, "paid")
    remaining = income - total
    _, _, receivables_pending = split_totals(month_entries(db, RECEIVABLE, month, user_id), "received")

    groups: dict = {}
    for e in entries:
        g = groups.setdefault(e.entity_id, {
            "entity_id": e.entity_id, "entity_name": e.entity.name, "color": e.entity.color,
            "total_amount": ZERO, "paid_amount": ZERO, "pending_amount": ZERO,
        })
        g["total_amount"] += e.amount
        g["paid_amount" if e.status == "paid" else "pending_amount"] += e.amount
    by_entity = [schemas.EntityBreakdown(**g, percentage=pct(g["total_amount"], total)) for g in groups.values()]

    months = [shift_ym(month, i) for i in range(1, 7)]
    sums = dict(
        db.query(models.MonthlyEntry.reference_month, func.sum(models.MonthlyEntry.amount))
        .filter(models.MonthlyEntry.user_id == user_id, models.MonthlyEntry.reference_month.in_(months))
        .group_by(models.MonthlyEntry.reference_month)
        .all()
    )

    return schemas.DashboardOut(
        reference_month=month, income=income, total_expenses=total, total_paid=paid,
        total_pending=pending, remaining=remaining, commitment_percentage=pct(total, income),
        receivables_pending=receivables_pending, projected_balance=remaining + receivables_pending,
        by_entity=by_entity,
        next_6_months=[schemas.MonthProjection(month=m, total_amount=sums.get(m, ZERO)) for m in months],
        entries=entries,
    )